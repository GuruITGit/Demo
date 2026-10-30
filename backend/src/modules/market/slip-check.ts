import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityTarget, IsNull, Not } from 'typeorm';
import { PayConfig } from './pay-config';
import { nextReceiptNo } from './receipt';
import { verifySlip } from '../water/slip-verify';
import { StorageService } from '../storage/storage.service';

/** ชื่อผู้รับในสลิปตรงกับชื่อบัญชี อบต. ไหม (ไม่สนคำนำหน้า/ช่องว่าง/เครื่องหมาย; ยอมให้ชื่อใดชื่อหนึ่งเป็นส่วนของอีกชื่อ) */
export const payeeLike = (payee: string, receiver: string) => {
  const k = (v: string) => String(v || '').replace(/^(นางสาว|น\.ส\.|นาย|นาง|บริษัท|องค์การบริหารส่วนตำบล|อบต\.?)/g, '').replace(/[\s.()\-]/g, '').toLowerCase();
  const a = k(payee), b = k(receiver);
  if (!a || !b) return false;
  return a === b || (a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b));
};

/** ตรวจสลิปกับผู้ให้บริการ + เทียบยอด/ผู้รับ/เลขอ้างอิง — คืน ok=false พร้อมเหตุผลถ้าไม่ผ่าน (ใช้ทั้งตอนประชาชนส่งและปุ่มตรวจทั้งหมดของเจ้าหน้าที่) */
export async function checkSlip(cfg: PayConfig, buffer: Buffer, mime: string, total: number): Promise<{ ok: boolean; reason: string; transRef: string | null }> {
  if (!cfg.slipProvider || !cfg.slipToken) return { ok: false, reason: 'ยังไม่ได้เปิดตรวจสลิปอัตโนมัติ เจ้าหน้าที่จะตรวจให้', transRef: null };
  const r = await verifySlip(cfg.slipProvider, cfg.slipToken, buffer, mime);
  if (!r.ok) return { ok: false, reason: `ตรวจสลิปไม่ผ่าน: ${r.error || 'อ่านสลิปไม่ได้'}`, transRef: null };
  if (Math.abs((r.amount ?? 0) - total) > 0.009) return { ok: false, reason: `ยอดในสลิป ${r.amount ?? '-'} บาท ไม่ตรงกับยอดที่ต้องชำระ ${total} บาท`, transRef: null };
  if (cfg.payeeName && !(r.receiverName && payeeLike(cfg.payeeName, r.receiverName))) return { ok: false, reason: 'บัญชีผู้รับในสลิปไม่ใช่บัญชีของ อบต.', transRef: null };
  if (!r.transRef) return { ok: false, reason: 'ไม่พบเลขอ้างอิงในสลิป', transRef: null };
  return { ok: true, reason: '', transRef: r.transRef };
}

export interface SlipBatchResult { label: string; count: number; amount: number; ok: boolean; reason: string; receiptNos: string[] }

const MAX_PER_CLICK = 30;
const mimeOf = (key: string) => (/\.png$/i.test(key) ? 'image/png' : /\.webp$/i.test(key) ? 'image/webp' : 'image/jpeg');

/**
 * ตรวจสลิปโอนที่รอตรวจ "ทั้งหมดในคลิกเดียว" — สลิปใบเดียวอาจครอบคลุมหลายบิล (รวมยอดก่อนเทียบ)
 * ผ่าน → ชำระแล้ว + ออกใบเสร็จ · ไม่ผ่าน → ยังรอตรวจ พร้อมเหตุผลให้เจ้าหน้าที่ตัดสินเอง (ไม่ปฏิเสธอัตโนมัติ)
 */
export async function verifyPendingSlips(
  ds: DataSource, storage: StorageService, cfg: PayConfig, orgId: string,
  entity: EntityTarget<any>, prefix: 'MK' | 'WS', label: (b: any) => string,
): Promise<{ results: SlipBatchResult[]; remaining: number }> {
  if (!cfg.slipProvider || !cfg.slipToken) throw new BadRequestException('ยังไม่ได้ผูกโทเคนตรวจสลิป — ตั้งค่าที่แท็บ "ตั้งค่า" ก่อน');
  const repo = ds.getRepository(entity);
  const bills = await repo.find({ where: { organizationId: orgId, status: 'pending', submittedMethod: 'transfer', slipUrl: Not(IsNull()) }, order: { submittedAt: 'ASC' }, take: 500 });
  const groups = new Map<string, any[]>();
  for (const b of bills) groups.set(b.slipUrl, [...(groups.get(b.slipUrl) ?? []), b]);
  const entries = [...groups.entries()];
  const results: SlipBatchResult[] = [];

  for (const [url, list] of entries.slice(0, MAX_PER_CLICK)) {
    const amount = list.reduce((s, b) => s + Number(b.amount), 0);
    const name = list.length > 1 ? `${label(list[0])} และอีก ${list.length - 1} รายการ` : label(list[0]);
    let res: { ok: boolean; reason: string; transRef: string | null };
    try {
      const m = url.match(/\/storage\/files\/([^/]+)\/(.+?)(?:\?.*)?$/);
      if (!m) throw new Error('no file');
      res = await checkSlip(cfg, await storage.getFileBuffer(m[1], decodeURIComponent(m[2])), mimeOf(m[2]), amount);
    } catch {
      res = { ok: false, reason: 'อ่านไฟล์สลิปไม่ได้ ให้เจ้าหน้าที่ดูรูปเอง', transRef: null };
    }

    const receiptNos: string[] = [];
    if (res.ok) {
      try {
        await ds.transaction(async (em) => {
          const now = new Date();
          for (const b of list) {
            b.status = 'paid'; b.paidMethod = 'transfer'; b.paidAt = now; b.reviewNote = null;
            b.receiptNo = await nextReceiptNo(em, orgId, prefix);
            receiptNos.push(b.receiptNo);
          }
          list[0].slipTransRef = res.transRef; // เลขอ้างอิงเก็บที่บิลแรกใบเดียว (unique index กันสลิปซ้ำ)
          await em.save(list);
        });
      } catch (e: any) {
        if (String(e?.code) !== '23505') throw e;
        res = { ok: false, reason: 'สลิปนี้ถูกใช้ชำระไปแล้ว', transRef: null };
        receiptNos.length = 0;
        for (const b of list) { b.status = 'pending'; b.paidMethod = null; b.paidAt = null; b.receiptNo = null; b.slipTransRef = null; }
      }
    }
    if (!res.ok) {
      for (const b of list) b.reviewNote = res.reason.slice(0, 300);
      await repo.save(list);
    }
    results.push({ label: name, count: list.length, amount, ok: res.ok, reason: res.reason, receiptNos });
  }
  return { results, remaining: Math.max(0, entries.length - MAX_PER_CLICK) };
}
