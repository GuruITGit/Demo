import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ข่าว/ประกาศประชาสัมพันธ์ สำหรับพอร์ทัลประชาชน (/citizen) — CMS จัดการโดยเจ้าหน้าที่
 * กันพัง prod: CREATE TABLE/INDEX IF NOT EXISTS (idempotent)
 */
export class CitizenNews1700000036000 implements MigrationInterface {
  name = 'CitizenNews1700000036000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "citizen_news" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "title" character varying(250) NOT NULL,
        "category" character varying(40) NOT NULL DEFAULT 'ข่าวประชาสัมพันธ์',
        "excerpt" text,
        "content" text,
        "cover_url" text,
        "status" character varying(16) NOT NULL DEFAULT 'draft',
        "pinned" boolean NOT NULL DEFAULT false,
        "published_at" TIMESTAMPTZ,
        "created_by" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_citizen_news" PRIMARY KEY ("id"),
        CONSTRAINT "FK_citizen_news_org" FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_citizen_news_pub" ON "citizen_news" ("organization_id","status","published_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_citizen_news_cat" ON "citizen_news" ("organization_id","category")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "citizen_news"`);
  }
}
