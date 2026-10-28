import { MigrationInterface, QueryRunner } from 'typeorm';

/** เก็บรายชื่อผู้มีสิทธิ์เข้าถึง เมื่อระดับ = private (แค่เฉพาะบุคคล) */
export class DocumentAllowedUsers1700000011000 implements MigrationInterface {
  name = 'DocumentAllowedUsers1700000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "allowed_user_ids" UUID[] DEFAULT '{}'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN IF EXISTS "allowed_user_ids"`);
  }
}
