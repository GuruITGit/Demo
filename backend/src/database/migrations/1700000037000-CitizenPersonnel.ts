import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ทำเนียบบุคลากร สำหรับพอร์ทัลประชาชน (/citizen) — CMS จัดการโดยเจ้าหน้าที่
 * กันพัง prod: CREATE TABLE/INDEX IF NOT EXISTS (idempotent)
 */
export class CitizenPersonnel1700000037000 implements MigrationInterface {
  name = 'CitizenPersonnel1700000037000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "citizen_personnel" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "name" character varying(250) NOT NULL,
        "position" character varying(200),
        "category" character varying(40) NOT NULL DEFAULT 'คณะผู้บริหาร',
        "department" character varying(120),
        "phone" character varying(30),
        "email" character varying(120),
        "photo_url" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "status" character varying(16) NOT NULL DEFAULT 'published',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_citizen_personnel" PRIMARY KEY ("id"),
        CONSTRAINT "FK_citizen_personnel_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_citizen_personnel_list" ON "citizen_personnel" ("organization_id","category","sort_order")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "citizen_personnel"`);
  }
}
