import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เติม fiscal_year ให้สารบรรณเก่าที่เป็น null
 *
 * ตั้งแต่ migration 1700000020000 เลขทะเบียนรับกันซ้ำ "ต่อสมุด ต่อปีงบ"
 * แถวเก่าที่ fiscal_year เป็น null จะกลายเป็นกลุ่มปี "0" (COALESCE ใน index)
 * → ไม่กันเลขซ้ำกับเรื่องปีปัจจุบัน และ suggestNextReceiveNumber ก็มองไม่เห็น
 *
 * เติมด้วยสูตรเดียวกับ currentBuddhistYear(): ปี ค.ศ. ของวันที่รับ/วันที่สร้าง + 543
 *
 * ⚠ ข้ามแถวที่เติมแล้วจะทำให้เลขทะเบียนซ้ำกับเรื่องที่มีปีงบอยู่แล้ว (ปล่อยเป็น null ไว้ตามเดิม)
 * — ข้อมูลจริงของผู้ใช้ต้องไม่ถูกแก้/ถูกทิ้งโดยอัตโนมัติ และ migration ต้องไม่ล้มจนบล็อก deploy
 * รายการที่ข้ามจะยังใช้งานได้ปกติ เพียงแต่ไม่ถูกนับรวมในสมุดปีนั้น — ให้เจ้าหน้าที่แก้เลขเองภายหลัง
 */
export class BackfillTicketFiscalYear1700000022000 implements MigrationInterface {
  name = 'BackfillTicketFiscalYear1700000022000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "correspondence_tickets" t
         SET "fiscal_year" = EXTRACT(YEAR FROM COALESCE(t."received_date", t."created_at"))::int + 543
       WHERE t."fiscal_year" IS NULL
         AND COALESCE(t."received_date", t."created_at") IS NOT NULL
         AND t."deleted_at" IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM "correspondence_tickets" x
            WHERE x."id" <> t."id"
              AND x."deleted_at" IS NULL
              AND x."organization_id" = t."organization_id"
              AND x."register_book" = t."register_book"
              AND x."ticket_number" = t."ticket_number"
              AND COALESCE(x."fiscal_year", 0)
                  = EXTRACT(YEAR FROM COALESCE(t."received_date", t."created_at"))::int + 543
         )
    `);
  }

  public async down(): Promise<void> {
    // ไม่ย้อนกลับ — เป็นการเติมข้อมูลที่ขาด ไม่ใช่การเปลี่ยนโครงสร้าง
  }
}
