import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * สารบรรณ: ส่งต่อแบบไดนามิก (เลือกคนรับเองทุกทอด) แทน 6 ขั้นตายตัว
 * - current_holder_user_id = ผู้ถือเรื่องปัจจุบัน (ขั้น PENDING_PERSON)
 * - route_trail = เส้นทางการส่งต่อ (stack) ใช้หาผู้ส่งก่อนหน้าตอนตีกลับ
 * - ย้ายเรื่องที่ค้างขั้นเดิม (ผอ./ธุรการ กองเจ้าของ/กองที่เกี่ยว) เป็น PENDING_PERSON ผู้ถือ = คนของขั้นนั้น
 *   (ปลัด/นายก/เสร็จสิ้น ไม่แตะ) · route_trail เริ่มจาก step_signatures เดิม ให้ตีกลับต่อได้
 */
export class TicketDynamicRouting1700000069000 implements MigrationInterface {
  name = 'TicketDynamicRouting1700000069000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "correspondence_tickets" ADD COLUMN IF NOT EXISTS "current_holder_user_id" uuid NULL`);
    await queryRunner.query(`ALTER TABLE "correspondence_tickets" ADD COLUMN IF NOT EXISTS "route_trail" jsonb NOT NULL DEFAULT '[]'::jsonb`);

    // route_trail จากลายเซ็นเดิม (เรียงตามลำดับที่เซ็น) — fromStep = ขั้นเดิมของผู้เซ็น
    await queryRunner.query(`
      UPDATE "correspondence_tickets" t
         SET "route_trail" = COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                        'fromUserId', s->>'userId', 'fromStep', s->>'step',
                        'toUserId', NULL, 'toStep', NULL, 'toDeptId', NULL, 'at', s->>'signedAt') ORDER BY ord)
                 FROM jsonb_array_elements(t."step_signatures") WITH ORDINALITY AS x(s, ord)), '[]'::jsonb)
       WHERE t."step_signatures" IS NOT NULL AND jsonb_typeof(t."step_signatures") = 'array'
         AND t."route_trail" = '[]'::jsonb`);

    // ย้ายเรื่องค้างขั้นเดิม → PENDING_PERSON (ข้ามแถวที่ไม่มีคนของขั้นนั้น)
    const moves: [string, string][] = [
      ['PENDING_OWNER_HEAD', 'assigned_head_user_id'],
      ['PENDING_OWNER_CLERK', 'owner_clerk_user_id'],
      ['PENDING_RELATED_HEAD', 'related_head_user_id'],
      ['PENDING_RELATED_CLERK', 'related_clerk_user_id'],
    ];
    for (const [step, col] of moves) {
      await queryRunner.query(
        `UPDATE "correspondence_tickets"
            SET "current_step" = 'PENDING_PERSON', "current_holder_user_id" = "${col}"
          WHERE "current_step" = $1 AND "${col}" IS NOT NULL`,
        [step],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // กลับไปขั้นแรกของ flow เดิม (ผู้ถือเรื่องเป็นผู้ปฏิบัติ) — ข้อมูลเส้นทางไดนามิกหายไป
    await queryRunner.query(`
      UPDATE "correspondence_tickets"
         SET "current_step" = 'PENDING_OWNER_HEAD',
             "assigned_head_user_id" = COALESCE("current_holder_user_id", "assigned_head_user_id")
       WHERE "current_step" = 'PENDING_PERSON'`);
    await queryRunner.query(`ALTER TABLE "correspondence_tickets" DROP COLUMN IF EXISTS "route_trail"`);
    await queryRunner.query(`ALTER TABLE "correspondence_tickets" DROP COLUMN IF EXISTS "current_holder_user_id"`);
  }
}
