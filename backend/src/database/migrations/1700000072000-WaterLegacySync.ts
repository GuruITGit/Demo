import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ปุ่ม "อัปเดตจากระบบเดิม" ในหน้าแอดมินประปา — เก็บรหัสเข้าระบบเดิม + ผลการอัปเดตล่าสุด
 * (ตั้งใจไม่ใส่ใน entity WaterRate เพื่อไม่ให้ GET /water/billing/rate ส่งรหัสผ่านออกไป)
 */
export class WaterLegacySync1700000072000 implements MigrationInterface {
  name = 'WaterLegacySync1700000072000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "water_rate" ADD COLUMN IF NOT EXISTS "legacy_sync" jsonb NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "water_rate" DROP COLUMN IF EXISTS "legacy_sync"`);
  }
}
