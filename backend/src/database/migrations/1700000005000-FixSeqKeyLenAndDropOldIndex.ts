import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * แก้บั๊ก 2 จุดของระบบสมุดทะเบียน (ต่อจาก 1700000004000):
 *
 * 1) `uq_ticket_org_number` เป็น unique INDEX (ไม่ใช่ constraint) — migration ก่อนหน้า
 *    DROP CONSTRAINT จึงไม่ลบให้ → เลขทะเบียนยังชนข้ามสมุด → DROP INDEX ทิ้ง
 *
 * 2) document_number_sequences.doc_type varchar(50) สั้นไป — คีย์ใหม่
 *    `BOOK:<เล่ม>:<deptId uuid>` ยาวได้ถึง ~59 ตัวอักษร → ออกเลขเล่มชื่อยาว
 *    (S_MSG_MEMO_NORMAL ฯลฯ) ล้มเหลว "value too long" → ขยายเป็น varchar(120)
 *
 * ใช้ IF EXISTS → ปลอดภัยกับ production
 */
export class FixSeqKeyLenAndDropOldIndex1700000005000 implements MigrationInterface {
  name = 'FixSeqKeyLenAndDropOldIndex1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) ลบ unique index เก่าที่ค้างอยู่ (กันเลขทะเบียนชนข้ามสมุด)
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_ticket_org_number"`);
    // 2) ขยายความยาว doc_type ให้พอกับคีย์ใหม่
    await queryRunner.query(`ALTER TABLE "document_number_sequences" ALTER COLUMN "doc_type" TYPE VARCHAR(120)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "document_number_sequences" ALTER COLUMN "doc_type" TYPE VARCHAR(50)`);
    // ไม่สร้าง index เก่ากลับ (เป็นบั๊ก)
  }
}
