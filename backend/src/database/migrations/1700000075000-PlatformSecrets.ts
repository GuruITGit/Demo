import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ความลับระดับเจ้าของระบบ (ใช้ร่วมทุก อบต.) เช่น API key ของ AI อ่านหนังสือ — ตั้งจากหน้า /hub (SUPER_ADMIN)
 * แยกจาก system_settings เพราะแถว global ของ system_settings ถูกส่งให้แอดมินทุก อบต. ผ่าน GET /settings
 * ค่าเก็บแบบเข้ารหัส (AES-256-GCM) · hint = 4 ตัวท้ายไว้โชว์ว่าตั้ง key ไหนอยู่
 */
export class PlatformSecrets1700000075000 implements MigrationInterface {
  name = 'PlatformSecrets1700000075000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_secrets" (
        "key" VARCHAR(100) PRIMARY KEY,
        "value_enc" TEXT NOT NULL,
        "hint" VARCHAR(20),
        "updated_by" UUID,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_secrets"`);
  }
}
