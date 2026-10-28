import { Injectable, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as path from 'path';
import { fetchLegacy, saveBackup, syncLegacy, verifyLegacy, DEFAULT_LEGACY_URL, SyncResult } from './legacy-sync';

type Job = {
  status: 'running' | 'done' | 'failed';
  startedAt: string;
  finishedAt?: string;
  by: string;
  log: string[];
  result?: SyncResult & { problems: number };
  error?: string;
};

/**
 * ปุ่ม "อัปเดตจากระบบเดิม" ของแอดมินประปา — รันเบื้องหลัง (ใช้เวลา 1-2 นาที เกินเวลารอของ Cloudflare) แล้วหน้าเว็บถามสถานะเป็นระยะ
 * รหัสเข้าระบบเดิมเก็บที่ water_rate.legacy_sync (ไม่อยู่ใน entity → GET rate ไม่หลุดรหัสออกไป) และไม่ส่งรหัสผ่านกลับ frontend
 * ไม่ลบบิลที่สร้างในระบบเรา (ต่างจาก --purge-test ของสคริปต์) — แค่รายงาน
 */
@Injectable()
export class WaterLegacySyncService {
  private readonly logger = new Logger(WaterLegacySyncService.name);
  private readonly jobs = new Map<string, Job>();
  // เก็บสำรองข้อมูลดิบไว้บน volume ถาวร (นอก bucket ที่เปิดให้ดาวน์โหลด) · มีข้อมูลส่วนบุคคล
  private readonly backupRoot = path.join(process.env.STORAGE_FS_ROOT || path.join(process.cwd(), '.storage'), 'prapa-backup');

  constructor(private readonly ds: DataSource) {}

  private async readConfig(orgId: string): Promise<any> {
    const [row] = await this.ds.query(`SELECT legacy_sync FROM water_rate WHERE organization_id = $1 LIMIT 1`, [orgId]);
    return row?.legacy_sync || {};
  }

  private async patchConfig(orgId: string, patch: Record<string, any>) {
    const res = await this.ds.query(
      `UPDATE water_rate SET legacy_sync = coalesce(legacy_sync, '{}'::jsonb) || $2::jsonb WHERE organization_id = $1`,
      [orgId, JSON.stringify(patch)]);
    if (!(Array.isArray(res) ? res[1] : 0)) {
      await this.ds.query(`INSERT INTO water_rate (organization_id, legacy_sync) VALUES ($1, $2::jsonb)`, [orgId, JSON.stringify(patch)]);
    }
  }

  async getState(orgId: string) {
    const c = await this.readConfig(orgId);
    return {
      url: c.url || DEFAULT_LEGACY_URL,
      org: c.org || '',
      user: c.user || '',
      hasPassword: !!c.password,
      lastRun: c.lastRun || null,
      job: this.jobs.get(orgId) || null,
    };
  }

  async saveConfig(orgId: string, dto: { url?: string; org?: string; user?: string; password?: string }) {
    const patch: Record<string, any> = {};
    if (dto.url !== undefined) patch.url = dto.url.trim() || DEFAULT_LEGACY_URL;
    if (dto.org !== undefined) patch.org = dto.org.trim();
    if (dto.user !== undefined) patch.user = dto.user.trim();
    if (dto.password) patch.password = dto.password;
    await this.patchConfig(orgId, patch);
    return this.getState(orgId);
  }

  async start(orgId: string, by: string) {
    if (this.jobs.get(orgId)?.status === 'running') throw new ConflictException('กำลังอัปเดตจากระบบเดิมอยู่แล้ว — รอให้เสร็จก่อน');
    const c = await this.readConfig(orgId);
    if (!c.org || !c.user || !c.password) throw new BadRequestException('ยังไม่ได้ตั้งรหัสเข้าระบบเดิม');
    const job: Job = { status: 'running', startedAt: new Date().toISOString(), by, log: [] };
    this.jobs.set(orgId, job);
    void this.run(orgId, c, job);
    return job;
  }

  private async run(orgId: string, c: any, job: Job) {
    const log = (s: string) => { job.log.push(s); if (job.log.length > 500) job.log.splice(0, job.log.length - 500); };
    try {
      const data = await fetchLegacy({ url: c.url, org: c.org, user: c.user, password: c.password }, {}, log);
      try { saveBackup(data, path.join(this.backupRoot, orgId), log, 5); }
      catch (e) { log(`⚠ เก็บสำรองข้อมูลดิบไม่สำเร็จ: ${(e as Error).message}`); }

      const qr = this.ds.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        const q = (sql: string, params?: any[]) => qr.query(sql, params);
        const result = await syncLegacy(q, orgId, data, { purge: false }, log);
        // แถวตารางรอบ: โชว์ 3 รอบล่าสุด (รอบที่ไม่ตรงโชว์เสมอ)
        const problems = await verifyLegacy(q, orgId, data, { showFrom: data.rounds[Math.max(0, data.rounds.length - 3)] }, log);
        await qr.commitTransaction();
        job.result = { ...result, problems };
      } catch (e) {
        await qr.rollbackTransaction();
        throw e;
      } finally {
        await qr.release();
      }
      job.status = 'done';
      log('✓ บันทึกแล้ว');
    } catch (e) {
      job.status = 'failed';
      job.error = (e as Error).message || String(e);
      log(`✗ ${job.error}`);
      this.logger.warn(`legacy sync ${orgId} failed: ${job.error}`);
    }
    job.finishedAt = new Date().toISOString();
    await this.patchConfig(orgId, {
      lastRun: { at: job.finishedAt, by: job.by, status: job.status, result: job.result || null, error: job.error || null },
    }).catch(() => undefined);
  }
}
