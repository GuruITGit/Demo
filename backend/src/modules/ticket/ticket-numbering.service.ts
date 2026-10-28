/**
 * เลขทะเบียน/สมุดทะเบียนสารบรรณ — แยกจาก ticket.service.ts ตามแผนจัดระเบียบโมดูล
 * หมายเหตุ: เลิก auto-gen เลขทะเบียนแล้ว (ผู้ใช้กรอกเอง) ไฟล์นี้จึงมีแค่ "แนะนำเลขถัดไป"
 * + metadata ของสมุดทะเบียน ไม่มีกลไกจองเลขแบบ atomic อีกต่อไป
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CorrespondenceTicket, RegisterBook, REGISTER_BOOKS } from '../../database/entities/correspondence-ticket.entity';
import { AuthUser, buildVisibleQuery } from './ticket-visibility';

/** รายการสมุดทะเบียนทั้งหมด (metadata) — ใช้ render แท็บ/ฟอร์มเลือกเล่ม (ข้อ 1) · ใช้ร่วมกับ ticket-summary.service.ts ด้วย */
export function listBooks() {
  return Object.values(REGISTER_BOOKS).map((m) => ({
    key: m.key,
    label: m.label,
    direction: m.direction,
    circular: !!m.circular,
    secret: !!m.secret,
    numberStyle: m.numberStyle,
  }));
}

/** ปี พ.ศ. ปัจจุบัน (ใช้เป็นค่าเริ่มต้นปีงบเมื่อ DTO ไม่ระบุ) */
function currentBuddhistYear(): number {
  return new Date().getFullYear() + 543;
}

@Injectable()
export class TicketNumberingService {
  constructor(
    @InjectRepository(CorrespondenceTicket) private ticketRepo: Repository<CorrespondenceTicket>,
  ) {}

  /**
   * เลขทะเบียนรับที่แนะนำถัดไป (rework v20000) — เลขจำนวนเต็มมากสุดในสมุด/ปีนั้น + 1
   * สมุดว่าง (ปีใหม่) → แนะนำ "1"; ถ้าเลขในสมุดไม่ใช่จำนวนเต็มล้วน → เดาไม่ได้ (null) ให้กรอกเอง
   */
  async suggestNextReceiveNumber(user: AuthUser, bookKey?: string, fiscalYear?: number) {
    const orgId = user.organizationId;
    const book = bookKey && REGISTER_BOOKS[bookKey as RegisterBook] ? (bookKey as RegisterBook) : RegisterBook.R_MAIN;
    const year = fiscalYear ?? currentBuddhistYear();
    const rows: Array<{ ticket_number: string }> = await this.ticketRepo.query(
      `SELECT ticket_number FROM correspondence_tickets
        WHERE organization_id = $1 AND register_book = $2 AND fiscal_year = $3 AND deleted_at IS NULL`,
      [orgId, book, year],
    );
    if (rows.length === 0) return { book, year, count: 0, latest: null, suggested: '1' };
    let maxN = 0;
    let hasNumeric = false;
    for (const r of rows) {
      const s = String(r.ticket_number ?? '').trim();
      if (/^\d+$/.test(s)) { hasNumeric = true; const n = parseInt(s, 10); if (n > maxN) maxN = n; }
    }
    return { book, year, count: rows.length, latest: hasNumeric ? String(maxN) : null, suggested: hasNumeric ? String(maxN + 1) : null };
  }

  /** รายการสมุดทะเบียนทั้งหมด (metadata) — ใช้ render แท็บ/ฟอร์มเลือกเล่ม (ข้อ 1) */
  listBooks() {
    return listBooks();
  }

  /** จำนวนเรื่องในแต่ละสมุด + ปีงบที่มีข้อมูล (ข้อ 1,7,8) */
  async booksSummary(user: AuthUser, fiscalYear?: number) {
    const qb = buildVisibleQuery(this.ticketRepo, user, false)
      .select('t.register_book', 'book')
      .addSelect('COUNT(*)', 'count')
      .groupBy('t.register_book');
    if (fiscalYear) qb.andWhere('t.fiscal_year = :fy', { fy: fiscalYear });
    const rows = await qb.getRawMany();
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.book] = Number(r.count);

    const yearsQb = buildVisibleQuery(this.ticketRepo, user, false)
      .select('DISTINCT t.fiscal_year', 'year')
      .andWhere('t.fiscal_year IS NOT NULL')
      .orderBy('year', 'DESC');
    const yearRows = await yearsQb.getRawMany();
    const years = yearRows.map((y) => Number(y.year));

    return {
      books: listBooks().map((b) => ({ ...b, count: counts[b.key] || 0 })),
      years: years.length ? years : [currentBuddhistYear()],
    };
  }
}
