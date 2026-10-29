import { EntityManager } from 'typeorm';

/**
 * เลขใบเสร็จค่าแผง/ค่าขยะ เช่น MK-69-000123 — รันต่อ อบต. ต่อประเภท ต่อปี พ.ศ. (atomic ด้วย UPSERT ... RETURNING)
 * ต้องเรียกใน transaction เดียวกับที่บันทึกการรับชำระ เลขจะได้ไม่ข้ามเมื่อบันทึกไม่สำเร็จ
 */
export async function nextReceiptNo(em: EntityManager, orgId: string, prefix: 'MK' | 'WS'): Promise<string> {
  const year = new Date().getFullYear() + 543;
  const [row] = await em.query(
    `INSERT INTO pay_receipt_sequences (organization_id, prefix, year, last_no) VALUES ($1, $2, $3, 1)
     ON CONFLICT (organization_id, prefix, year) DO UPDATE SET last_no = pay_receipt_sequences.last_no + 1
     RETURNING last_no`,
    [orgId, prefix, year],
  );
  return `${prefix}-${String(year).slice(-2)}-${String(row.last_no).padStart(6, '0')}`;
}

/** งวด พ.ศ.-เดือน ของวันนี้ เช่น 2569-10 */
export function currentPeriod(d = new Date()): string {
  return `${d.getFullYear() + 543}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** วันสุดท้ายของเดือนในงวด (ใช้เป็นวันครบกำหนด) เช่น 2569-10 → 2026-10-31 */
export function periodEndDate(period: string): string {
  const [by, m] = period.split('-').map(Number);
  const last = new Date(by - 543, m, 0).getDate();
  return `${by - 543}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}
