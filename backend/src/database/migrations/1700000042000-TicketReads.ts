import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * สถานะ "อ่านแล้ว" ของสารบรรณต่อผู้ใช้ (สำหรับหน้ารายการ v4 — เรื่องใหม่ vs อ่านแล้ว)
 * upsert เมื่อผู้ใช้เปิดดูรายละเอียด (findOneV4) — idempotent, ทนสภาพ prod
 */
export class TicketReads1700000042000 implements MigrationInterface {
  name = 'TicketReads1700000042000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS correspondence_ticket_reads (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL,
        ticket_id uuid NOT NULL,
        read_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_ticket_reads_user_ticket ON correspondence_ticket_reads (user_id, ticket_id)`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS idx_ticket_reads_user ON correspondence_ticket_reads (user_id)`,
    );
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS correspondence_ticket_reads`);
  }
}
