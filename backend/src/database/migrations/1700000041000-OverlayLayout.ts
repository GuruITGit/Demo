import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rework สารบรรณ v4 — เก็บตำแหน่ง overlay (ตราเลขรับ + ลายเซ็น) ที่วางบน PDF เดิม
 * โครงสร้าง: { pages: number, items: [{ id, kind, page, xPct, yPct, wPct, hPct, ... }] }
 */
export class OverlayLayout1700000041000 implements MigrationInterface {
  name = 'OverlayLayout1700000041000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "correspondence_tickets" ADD COLUMN IF NOT EXISTS "overlay_layout" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "correspondence_tickets" DROP COLUMN IF EXISTS "overlay_layout"`);
  }
}
