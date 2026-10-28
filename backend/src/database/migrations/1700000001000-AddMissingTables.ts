import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เพิ่มตารางที่ entity ประกาศไว้แต่ขาดหายจาก InitialSchema migration
 * (เดิมถูกสร้างใน production ด้วย raw SQL แบบ ad-hoc ทำให้ migration:run บน DB ใหม่ได้ schema ไม่ครบ)
 *
 * ตารางที่ขาด: user_permissions (หัวใจ RBAC), budgets, procurements, projects, tax_records, welfare_recipients
 *
 * ใช้ IF NOT EXISTS ทุกจุด → ปลอดภัยกับ production ที่มีตารางเหล่านี้อยู่แล้ว (เป็น no-op)
 * และเติมให้ครบเมื่อรันบน DB ใหม่ FK ที่อ้างถึง users ใช้ ON DELETE SET NULL/CASCADE
 * เพื่อให้การลบผู้ใช้ไม่ติด constraint
 */
export class AddMissingTables1700000001000 implements MigrationInterface {
  name = 'AddMissingTables1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // user_permissions — สิทธิ์ตรงระดับผู้ใช้ (override สิทธิ์จาก role)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_permissions" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        "permission_id" UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
        "granted_by" UUID REFERENCES users(id) ON DELETE SET NULL,
        "granted_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE (user_id, permission_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id)`,
    );

    // budgets — งบประมาณรายปี
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "budgets" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "budget_number" VARCHAR(50) NOT NULL,
        "title" VARCHAR(300) NOT NULL,
        "description" TEXT,
        "fiscal_year" SMALLINT NOT NULL,
        "budget_type" VARCHAR(100) DEFAULT 'ดำเนินงาน' NOT NULL,
        "dept_id" UUID REFERENCES departments(id) ON DELETE SET NULL,
        "allocated_amount" NUMERIC(18,2) DEFAULT 0 NOT NULL,
        "used_amount" NUMERIC(18,2) DEFAULT 0 NOT NULL,
        "remaining_amount" NUMERIC(18,2) DEFAULT 0 NOT NULL,
        "status" VARCHAR(50) DEFAULT 'อนุมัติ' NOT NULL,
        "approved_by" UUID REFERENCES users(id) ON DELETE SET NULL,
        "approved_at" TIMESTAMPTZ,
        "created_by" UUID REFERENCES users(id) ON DELETE SET NULL,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_budgets_org_year ON budgets(organization_id, fiscal_year)`,
    );

    // projects — โครงการ
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "projects" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "project_number" VARCHAR(50) NOT NULL,
        "title" VARCHAR(500) NOT NULL,
        "description" TEXT,
        "strategy" VARCHAR(300),
        "fiscal_year" SMALLINT NOT NULL,
        "dept_id" UUID REFERENCES departments(id) ON DELETE SET NULL,
        "project_manager_id" UUID REFERENCES users(id) ON DELETE SET NULL,
        "budget_amount" NUMERIC(18,2) DEFAULT 0 NOT NULL,
        "actual_amount" NUMERIC(18,2) DEFAULT 0 NOT NULL,
        "target_group" VARCHAR(300),
        "expected_output" TEXT,
        "start_date" DATE,
        "end_date" DATE,
        "progress_pct" SMALLINT DEFAULT 0 NOT NULL,
        "status" VARCHAR(50) DEFAULT 'แผน' NOT NULL,
        "created_by" UUID REFERENCES users(id) ON DELETE SET NULL,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_projects_org_year ON projects(organization_id, fiscal_year)`,
    );

    // tax_records — ภาษีท้องถิ่น
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tax_records" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "tax_number" VARCHAR(50) NOT NULL,
        "tax_type" VARCHAR(100) NOT NULL,
        "fiscal_year" SMALLINT NOT NULL,
        "taxpayer_id_card" VARCHAR(20),
        "taxpayer_name" VARCHAR(200) NOT NULL,
        "taxpayer_phone" VARCHAR(20),
        "property_address" TEXT,
        "property_area_sqm" NUMERIC(12,4),
        "base_value" NUMERIC(18,2) DEFAULT 0 NOT NULL,
        "tax_rate" NUMERIC(6,4) DEFAULT 0 NOT NULL,
        "tax_amount" NUMERIC(18,2) DEFAULT 0 NOT NULL,
        "penalty_amount" NUMERIC(18,2) DEFAULT 0 NOT NULL,
        "total_amount" NUMERIC(18,2) DEFAULT 0 NOT NULL,
        "paid_amount" NUMERIC(18,2) DEFAULT 0 NOT NULL,
        "due_date" DATE,
        "paid_at" TIMESTAMPTZ,
        "status" VARCHAR(50) DEFAULT 'รอชำระ' NOT NULL,
        "note" TEXT,
        "collected_by" UUID REFERENCES users(id) ON DELETE SET NULL,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_tax_org_year ON tax_records(organization_id, fiscal_year)`,
    );

    // welfare_recipients — ผู้รับเบี้ยยังชีพ
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "welfare_recipients" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "recipient_number" VARCHAR(50) NOT NULL,
        "welfare_type" VARCHAR(100) NOT NULL,
        "id_card" VARCHAR(20) NOT NULL,
        "prefix" VARCHAR(20),
        "first_name" VARCHAR(100) NOT NULL,
        "last_name" VARCHAR(100) NOT NULL,
        "birth_date" DATE NOT NULL,
        "phone" VARCHAR(20),
        "address" TEXT,
        "village" VARCHAR(200),
        "monthly_allowance" NUMERIC(10,2) DEFAULT 0 NOT NULL,
        "payment_method" VARCHAR(50) DEFAULT 'โอนเงิน' NOT NULL,
        "bank_name" VARCHAR(100),
        "bank_account" VARCHAR(30),
        "register_date" DATE NOT NULL,
        "disability_type" VARCHAR(200),
        "disability_card" VARCHAR(50),
        "status" VARCHAR(50) DEFAULT 'ใช้งาน' NOT NULL,
        "note" TEXT,
        "registered_by" UUID REFERENCES users(id) ON DELETE SET NULL,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_welfare_org ON welfare_recipients(organization_id)`,
    );

    // procurements — จัดซื้อจัดจ้าง
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "procurements" (
        "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "organization_id" UUID NOT NULL REFERENCES organizations(id),
        "procurement_number" VARCHAR(50) NOT NULL,
        "title" VARCHAR(500) NOT NULL,
        "description" TEXT,
        "method" VARCHAR(100) DEFAULT 'เฉพาะเจาะจง' NOT NULL,
        "budget_source" VARCHAR(200),
        "estimated_amount" NUMERIC(18,2) DEFAULT 0 NOT NULL,
        "final_amount" NUMERIC(18,2),
        "vendor_name" VARCHAR(300),
        "vendor_tax_id" VARCHAR(20),
        "fiscal_year" SMALLINT NOT NULL,
        "dept_id" UUID REFERENCES departments(id) ON DELETE SET NULL,
        "plan_date" DATE,
        "announce_date" DATE,
        "contract_date" DATE,
        "complete_date" DATE,
        "status" VARCHAR(50) DEFAULT 'แผน' NOT NULL,
        "created_by" UUID REFERENCES users(id) ON DELETE SET NULL,
        "approved_by" UUID REFERENCES users(id) ON DELETE SET NULL,
        "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        "updated_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_procurements_org_year ON procurements(organization_id, fiscal_year)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'procurements', 'welfare_recipients', 'tax_records',
      'projects', 'budgets', 'user_permissions',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }
}
