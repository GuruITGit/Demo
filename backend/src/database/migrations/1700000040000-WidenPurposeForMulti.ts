import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rework สารบรรณ v4 — วัตถุประสงค์เลือกได้ >1 (เก็บรวมเป็นสตริงคั่นด้วย ", ")
 * ขยาย purpose จาก varchar(50) → varchar(255) กันข้อความเกิน (idempotent-safe: ALTER TYPE ซ้ำไม่พัง)
 */
export class WidenPurposeForMulti1700000040000 implements MigrationInterface {
  name = 'WidenPurposeForMulti1700000040000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "correspondence_tickets" ALTER COLUMN "purpose" TYPE character varying(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ไม่ย่อกลับ (อาจมีข้อมูลยาวเกิน 50 แล้ว) — no-op
  }
}
