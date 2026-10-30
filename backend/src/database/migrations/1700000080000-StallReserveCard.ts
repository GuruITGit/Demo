import { MigrationInterface, QueryRunner } from 'typeorm';

/** การจองแผงจากประชาชน: เก็บรูปบัตรประชาชนประกอบการตรวจ (ไม่มีค่า = ไม่ได้แนบ) */
export class StallReserveCard1700000080000 implements MigrationInterface {
  name = 'StallReserveCard1700000080000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "market_stalls" ADD COLUMN IF NOT EXISTS "reserve_card_url" TEXT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "market_stalls" DROP COLUMN IF EXISTS "reserve_card_url"`);
  }
}
