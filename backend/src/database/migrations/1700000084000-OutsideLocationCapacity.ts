import { MigrationInterface, QueryRunner } from 'typeorm';

/** แผงลอย: จำนวนผู้เช่าสูงสุดต่อจุด */
export class OutsideLocationCapacity1700000084000 implements MigrationInterface {
  name = 'OutsideLocationCapacity1700000084000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "market_outside_locations" ADD COLUMN IF NOT EXISTS "capacity" INT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "market_outside_locations" DROP COLUMN IF EXISTS "capacity"`);
  }
}
