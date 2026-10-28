import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { PlatformSecret } from '../../database/entities/platform-secret.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';

export type AiProvider = 'anthropic' | 'gemini';
export type AiConfig = { provider: AiProvider; model: string; geminiModel: string; anthropicKey: string | null; geminiKey: string | null };

const KEYS = { provider: 'ai.provider', model: 'ai.model', geminiModel: 'ai.gemini_model', anthropicKey: 'ai.anthropic_key', geminiKey: 'ai.gemini_key' } as const;
type Field = keyof typeof KEYS;
const SECRET_FIELDS: Field[] = ['anthropicKey', 'geminiKey'];
const CACHE_MS = 30_000;

/**
 * ความลับระดับเจ้าของระบบ (ตั้งที่ /hub) — ตอนนี้ใช้กับ AI อ่านหนังสือ
 * ค่าที่ตั้งใน hub ชนะค่าใน .env · ไม่ตั้ง = ใช้ .env เหมือนเดิม (ระบบเดิมไม่พัง)
 * เข้ารหัสด้วย AES-256-GCM จาก SECRETS_KEY (ไม่มี = JWT_SECRET) — เปลี่ยน secret นี้แล้วค่าเดิมถอดไม่ได้ ต้องตั้ง key ใหม่ใน hub
 */
@Injectable()
export class PlatformSecretsService {
  private readonly logger = new Logger(PlatformSecretsService.name);
  private cache: { at: number; values: Partial<Record<Field, string>> } | null = null;

  constructor(
    @InjectRepository(PlatformSecret) private readonly repo: Repository<PlatformSecret>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
  ) {}

  private cryptoKey(): Buffer {
    const base = process.env.SECRETS_KEY || process.env.JWT_SECRET;
    if (!base) throw new Error('ไม่มี SECRETS_KEY / JWT_SECRET สำหรับเข้ารหัส');
    return createHash('sha256').update(`platform-secrets:${base}`).digest();
  }

  private encrypt(plain: string): string {
    const iv = randomBytes(12);
    const c = createCipheriv('aes-256-gcm', this.cryptoKey(), iv);
    const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
    return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join(':');
  }

  private decrypt(stored: string): string | null {
    try {
      const [iv, tag, enc] = stored.split(':').map((s) => Buffer.from(s, 'base64'));
      const d = createDecipheriv('aes-256-gcm', this.cryptoKey(), iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(enc), d.final()]).toString('utf8');
    } catch {
      return null; // secret เปลี่ยน / ข้อมูลเสีย → ถือว่าไม่ได้ตั้ง (ใช้ .env แทน)
    }
  }

  private async load(): Promise<Partial<Record<Field, string>>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.values;
    const rows = await this.repo.find();
    const values: Partial<Record<Field, string>> = {};
    for (const f of Object.keys(KEYS) as Field[]) {
      const row = rows.find((r) => r.key === KEYS[f]);
      if (!row) continue;
      const v = this.decrypt(row.valueEnc);
      if (v == null) this.logger.warn(`ถอดรหัส ${row.key} ไม่ได้ (SECRETS_KEY/JWT_SECRET เปลี่ยน?) — ใช้ค่าใน .env แทน`);
      else values[f] = v;
    }
    this.cache = { at: Date.now(), values };
    return values;
  }

  /** ค่าที่ใช้จริงตอนเรียก AI — hub ก่อน แล้วค่อย .env */
  async getAiConfig(): Promise<AiConfig> {
    const v = await this.load();
    const provider = (v.provider || process.env.AI_EXTRACT_PROVIDER || 'anthropic').toLowerCase() === 'gemini' ? 'gemini' : 'anthropic';
    return {
      provider,
      model: v.model || process.env.AI_EXTRACT_MODEL || 'claude-opus-5-5',
      geminiModel: v.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      anthropicKey: v.anthropicKey || process.env.ANTHROPIC_API_KEY || null,
      geminiKey: v.geminiKey || process.env.GEMINI_API_KEY || null,
    };
  }

  /** สถานะสำหรับหน้า hub — ไม่ส่ง key ออกไป มีแค่ 4 ตัวท้ายกับที่มา */
  async aiStatus() {
    const v = await this.load();
    const rows = await this.repo.find();
    const meta = (f: Field) => rows.find((r) => r.key === KEYS[f]);
    const keyInfo = (f: 'anthropicKey' | 'geminiKey', envName: string) => {
      const env = process.env[envName];
      if (v[f]) return { configured: true, source: 'hub' as const, hint: meta(f)?.hint ?? null, updatedAt: meta(f)?.updatedAt ?? null };
      if (env) return { configured: true, source: 'env' as const, hint: `…${env.slice(-4)}`, updatedAt: null };
      return { configured: false, source: null, hint: null, updatedAt: null };
    };
    const cfg = await this.getAiConfig();
    return {
      provider: cfg.provider,
      model: cfg.model,
      geminiModel: cfg.geminiModel,
      anthropic: keyInfo('anthropicKey', 'ANTHROPIC_API_KEY'),
      gemini: keyInfo('geminiKey', 'GEMINI_API_KEY'),
    };
  }

  /** undefined = ไม่เปลี่ยน · '' = ลบ (กลับไปใช้ .env) */
  async updateAi(input: Partial<Record<Field, string>>, user: { id?: string; username?: string; organizationId?: string }) {
    const changed: string[] = [];
    for (const f of Object.keys(KEYS) as Field[]) {
      const raw = input[f];
      if (raw === undefined) continue;
      const value = raw.trim();
      if (f === 'anthropicKey' && value && !value.startsWith('sk-ant-')) throw new BadRequestException('Claude API key ต้องขึ้นต้นด้วย sk-ant-');
      if (value.length > 400) throw new BadRequestException('ค่ายาวเกินไป');
      if (!value) {
        await this.repo.delete({ key: KEYS[f] });
      } else {
        const hint = SECRET_FIELDS.includes(f) ? `…${value.slice(-4)}` : value.slice(0, 20);
        await this.repo.save({ key: KEYS[f], valueEnc: this.encrypt(value), hint, updatedBy: user.id ?? null });
      }
      changed.push(`${f}${value ? '' : ' (ลบ)'}`);
    }
    this.cache = null;
    if (changed.length) {
      // บันทึกว่าใครเปลี่ยนอะไร — ไม่เก็บค่า key ลง log
      await this.auditRepo.save(this.auditRepo.create({
        organizationId: user.organizationId ?? null, userId: user.id ?? null, userName: user.username ?? null,
        action: 'update_ai_settings', module: 'hub', resourceType: 'platform_secret', resourceTitle: 'ตั้งค่า AI อ่านหนังสือ',
        newValues: { changed },
      } as Partial<AuditLog>)).catch((e) => this.logger.warn(`audit ไม่สำเร็จ: ${(e as Error).message}`));
    }
    return this.aiStatus();
  }

  /** ทดสอบว่า key ใช้ได้ — เรียกรายการโมเดล (ไม่เสียค่า token) */
  async testAi(provider: AiProvider) {
    const cfg = await this.getAiConfig();
    if (provider === 'anthropic') {
      if (!cfg.anthropicKey) return { ok: false, message: 'ยังไม่ได้ตั้ง Claude API key' };
      try {
        const client = new Anthropic({ apiKey: cfg.anthropicKey, timeout: 15_000, maxRetries: 0 });
        const page = await client.models.list({ limit: 50 });
        const ids = page.data.map((m) => m.id);
        const hasModel = ids.includes(cfg.model);
        return { ok: true, message: hasModel ? `ใช้ได้ · พบรุ่น ${cfg.model}` : `key ใช้ได้ แต่ไม่พบรุ่น ${cfg.model} ในบัญชีนี้` };
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError) return { ok: false, message: 'key ไม่ถูกต้อง หรือถูกยกเลิกแล้ว' };
        if (e instanceof Anthropic.PermissionDeniedError) return { ok: false, message: 'key นี้ไม่มีสิทธิ์ใช้งาน (เช็กเครดิต/สิทธิ์ใน console)' };
        if (e instanceof Anthropic.APIError) return { ok: false, message: `ผู้ให้บริการตอบกลับผิดพลาด (${e.status})` };
        return { ok: false, message: 'เชื่อมต่อผู้ให้บริการไม่ได้' };
      }
    }
    if (!cfg.geminiKey) return { ok: false, message: 'ยังไม่ได้ตั้ง Gemini API key' };
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=50', {
        headers: { 'x-goog-api-key': cfg.geminiKey }, signal: AbortSignal.timeout(15_000),
      });
      if (r.status === 400 || r.status === 401 || r.status === 403) return { ok: false, message: 'key ไม่ถูกต้อง หรือไม่มีสิทธิ์' };
      if (!r.ok) return { ok: false, message: `ผู้ให้บริการตอบกลับผิดพลาด (${r.status})` };
      return { ok: true, message: 'ใช้ได้' };
    } catch {
      return { ok: false, message: 'เชื่อมต่อผู้ให้บริการไม่ได้' };
    }
  }
}
