import { MigrationInterface, QueryRunner } from 'typeorm';

/** แผงลอย: ช่วงเปิดให้เช่าของแต่ละจุด (ตั้งแต่ – ถึง) */
export class OutsideLocationWindow1700000083000 implements MigrationInterface {
  name = 'OutsideLocationWindow1700000083000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "market_outside_locations" ADD COLUMN IF NOT EXISTS "open_from" DATE`);
    await queryRunner.query(`ALTER TABLE "market_outside_locations" ADD COLUMN IF NOT EXISTS "open_until" DATE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "market_outside_locations" DROP COLUMN IF EXISTS "open_until"`);
    await queryRunner.query(`ALTER TABLE "market_outside_locations" DROP COLUMN IF EXISTS "open_from"`);
  }
}
