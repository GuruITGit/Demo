import { DataSource } from 'typeorm';

/** ใบสมัครแผงลอยแบบชั่วคราวต้องจ่ายทันที — ถ้าบิลยังไม่ถูกแจ้งชำระ ให้ยกเลิกใบสมัครและลบบิลทิ้ง
 *  appCode = ยกเลิกใบเดียว (ผู้สมัครปิดหน้าจ่ายเงิน) · staleMin = ยกเลิกทุกใบที่ค้างเกินกำหนด (กันเปิดหน้าจ่ายทิ้งไว้) */
export async function cancelUnpaidTemporary(ds: DataSource, orgId: string, o: { appCode?: string; staleMin?: number } = {}) {
  const rows: { id: string; bill_id: string }[] = await ds.query(
    `SELECT a.id, a.bill_id FROM market_outside_applications a
       WHERE a.organization_id = $1 AND a.status = 'pending' AND a.tenancy_type = 'temporary' AND a.bill_id IS NOT NULL
         AND ($2::text IS NULL OR a.app_code = $2)
         AND ($3::int IS NULL OR a.created_at < now() - make_interval(mins => $3))
         AND EXISTS (SELECT 1 FROM market_bills b WHERE b.id = a.bill_id AND b.status = 'unpaid')`,
    [orgId, o.appCode ?? null, o.staleMin ?? null]);
  if (!rows.length) return 0;
  await ds.query(
    `UPDATE market_outside_applications SET status = 'cancelled', bill_id = NULL, review_note = 'ไม่ได้ชำระเงินจึงสมัครไม่สำเร็จ' WHERE id = ANY($1::uuid[])`,
    [rows.map((r) => r.id)]);
  await ds.query(`DELETE FROM market_bills WHERE id = ANY($1::uuid[])`, [rows.map((r) => r.bill_id)]);
  return rows.length;
}

/** เวลาที่รอจ่ายเงินหลังกดสมัครแบบชั่วคราว (นาที) */
export const TEMP_PAY_WINDOW_MIN = 30;
