import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * หนังสือแจ้งค้างชำระ: ส่วนที่ต่างกันทุก อบต. (เลขที่หนังสือ/ที่อยู่หัวหนังสือ/กอง/ผู้ลงนาม/โทร/กำหนดชำระ)
 * เดิม hardcode ของ อบต.ลำนางรอง ไว้ในตัวเรนเดอร์ → อบต. อื่นออกหนังสือได้ชื่อ+ผู้ลงนามผิด
 *
 * ที่อยู่/โทร ของหัวหนังสือแยกจาก org_address/org_phone (ที่ใช้บนใบเสร็จ 58mm) เพราะคนละรูปแบบ:
 * หนังสือราชการเขียน "อำเภอ… จังหวัด… 31260" ส่วนใบเสร็จเขียนย่อ "ต.… อ.… จ.…"
 *
 * backfill ค่าที่เคยฝังไว้ให้ อบต.ลำนางรอง เพื่อให้หนังสือที่ออกหลัง deploy เหมือนเดิมทุกบรรทัด
 * (แตะเฉพาะแถวที่ยังว่าง — รันซ้ำได้ ไม่ทับค่าที่ อบต. แก้เองทีหลัง) · idempotent
 */
export class WaterNoticeIdentity1700000053000 implements MigrationInterface {
  name = 'WaterNoticeIdentity1700000053000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_rate ADD COLUMN IF NOT EXISTS notice_doc_prefix varchar(60)`);
    await q.query(`ALTER TABLE water_rate ADD COLUMN IF NOT EXISTS notice_address_line varchar(200)`);
    await q.query(`ALTER TABLE water_rate ADD COLUMN IF NOT EXISTS notice_division varchar(120)`);
    await q.query(`ALTER TABLE water_rate ADD COLUMN IF NOT EXISTS notice_signer_name varchar(160)`);
    await q.query(`ALTER TABLE water_rate ADD COLUMN IF NOT EXISTS notice_signer_title varchar(200)`);
    await q.query(`ALTER TABLE water_rate ADD COLUMN IF NOT EXISTS notice_phone varchar(50)`);
    await q.query(`ALTER TABLE water_rate ADD COLUMN IF NOT EXISTS notice_due_days int NOT NULL DEFAULT 7`);

    await q.query(`
      UPDATE water_rate w SET
        notice_doc_prefix   = COALESCE(w.notice_doc_prefix, 'บร 85405'),
        notice_address_line = COALESCE(w.notice_address_line, 'อำเภอโนนดินแดง จังหวัดบุรีรัมย์ 31260'),
        notice_division     = COALESCE(w.notice_division, 'กองช่าง'),
        notice_signer_name  = COALESCE(w.notice_signer_name, 'นายสันติ    นาวีสัมพันธ์'),
        notice_signer_title = COALESCE(w.notice_signer_title, 'นายกองค์การบริหารส่วนตำบลลำนางรอง'),
        notice_phone        = COALESCE(w.notice_phone, '044-110311')
      FROM organizations o
      WHERE o.id = w.organization_id AND o.name_th LIKE '%ลำนางรอง%'
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_rate DROP COLUMN IF EXISTS notice_due_days`);
    await q.query(`ALTER TABLE water_rate DROP COLUMN IF EXISTS notice_phone`);
    await q.query(`ALTER TABLE water_rate DROP COLUMN IF EXISTS notice_signer_title`);
    await q.query(`ALTER TABLE water_rate DROP COLUMN IF EXISTS notice_signer_name`);
    await q.query(`ALTER TABLE water_rate DROP COLUMN IF EXISTS notice_division`);
    await q.query(`ALTER TABLE water_rate DROP COLUMN IF EXISTS notice_address_line`);
    await q.query(`ALTER TABLE water_rate DROP COLUMN IF EXISTS notice_doc_prefix`);
  }
}
