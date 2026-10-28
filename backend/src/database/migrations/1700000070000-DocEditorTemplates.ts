import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ตัวแต่งเอกสาร (Word ผสม Canva)
 * - document_templates: แม่แบบเอกสาร (organization_id NULL = แม่แบบมาตรฐานของระบบ) · category overlay = แต่งทับ / document = ร่างใหม่
 * - ticket_documents: เอกสารที่ร่างใหม่ผูกกับเรื่องสารบรรณ (layout v2 เดียวกับ overlay_layout)
 * ไม่แตะตารางสารบรรณเดิม
 */
export class DocEditorTemplates1700000070000 implements MigrationInterface {
  name = 'DocEditorTemplates1700000070000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NULL,
        "name" varchar(200) NOT NULL,
        "category" varchar(20) NOT NULL DEFAULT 'document',
        "system_key" varchar(60) NULL,
        "layout" jsonb NOT NULL,
        "created_by" uuid NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE NULL,
        CONSTRAINT "PK_document_templates" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_document_templates_org" ON "document_templates" ("organization_id", "category")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_document_templates_system_key" ON "document_templates" ("system_key") WHERE "system_key" IS NOT NULL`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ticket_documents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organization_id" uuid NOT NULL,
        "ticket_id" uuid NOT NULL,
        "title" varchar(200) NOT NULL,
        "template_id" uuid NULL,
        "layout" jsonb NOT NULL,
        "created_by" uuid NULL,
        "updated_by" uuid NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP WITH TIME ZONE NULL,
        CONSTRAINT "PK_ticket_documents" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ticket_documents_ticket" ON "ticket_documents" ("ticket_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ticket_documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_templates"`);
  }
}
