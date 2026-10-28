import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เพิ่ม เบอร์โทร/ที่อยู่ ให้ทะเบียนผู้ใช้น้ำ (ผูกให้สมาชิกล็อกอินพอร์ทัลเช็คค่าน้ำเอง + แสดงบนใบเสร็จ)
 * และ พร้อมเพย์ปลายทาง ให้เรตค่าน้ำ (สร้าง QR จ่ายเงินในพอร์ทัลสมาชิก)
 */
export class WaterCustomerContactAndPromptpay1700000031000 implements MigrationInterface {
  name = 'WaterCustomerContactAndPromptpay1700000031000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "water_customers" ADD COLUMN IF NOT EXISTS "phone" varchar(20)`);
    await queryRunner.query(`ALTER TABLE "water_customers" ADD COLUMN IF NOT EXISTS "address" varchar(255)`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_water_customers_phone" ON "water_customers" ("organization_id","phone")`,
    );

    await queryRunner.query(`ALTER TABLE "water_rate" ADD COLUMN IF NOT EXISTS "promptpay_id" varchar(30)`);
    await queryRunner.query(`ALTER TABLE "water_rate" ADD COLUMN IF NOT EXISTS "promptpay_type" varchar(12) NOT NULL DEFAULT 'mobile'`);
    await queryRunner.query(`ALTER TABLE "water_rate" ADD COLUMN IF NOT EXISTS "payee_name" varchar(120)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_water_customers_phone"`);
    await queryRunner.query(`ALTER TABLE "water_customers" DROP COLUMN IF EXISTS "phone"`);
    await queryRunner.query(`ALTER TABLE "water_customers" DROP COLUMN IF EXISTS "address"`);
    await queryRunner.query(`ALTER TABLE "water_rate" DROP COLUMN IF EXISTS "promptpay_id"`);
    await queryRunner.query(`ALTER TABLE "water_rate" DROP COLUMN IF EXISTS "promptpay_type"`);
    await queryRunner.query(`ALTER TABLE "water_rate" DROP COLUMN IF EXISTS "payee_name"`);
  }
}
