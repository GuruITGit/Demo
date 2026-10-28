import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CitizenNews } from '../../database/entities/citizen-news.entity';
import { Organization } from '../../database/entities/organization.entity';
import { StorageService } from '../storage/storage.service';
import { NEWS_CATEGORIES, NEWS_STATUSES } from './dto/citizen-news.dto';

@Injectable()
export class CitizenNewsService {
  constructor(
    @InjectRepository(CitizenNews) private readonly repo: Repository<CitizenNews>,
    @InjectRepository(Organization) private readonly orgRepo: Repository<Organization>,
    private readonly storage: StorageService,
  ) {}

  /** หา org สำหรับพอร์ทัลสาธารณะ (ไม่มี JWT): ใช้ code ถ้าส่งมา, ไม่งั้นถ้ามี อบต.เดียวใช้อันนั้น */
  private async resolveOrg(code?: string): Promise<string> {
    if (code?.trim()) {
      const r = await this.orgRepo.query(
        `SELECT id FROM organizations WHERE UPPER(code) = UPPER($1) AND is_active = true LIMIT 1`, [code.trim()]);
      if (r[0]) return r[0].id;
    }
    const rows = await this.orgRepo.query(`SELECT id FROM organizations WHERE is_active = true LIMIT 2`);
    if (rows.length === 1) return rows[0].id;
    throw new BadRequestException('ระบุหน่วยงานไม่ถูกต้อง');
  }

  /** signed URL แบบ relative (โหลด same-origin ผ่าน nginx เสมอ ไม่ผูกกับ APP_URL) */
  private signRel(u?: string | null): string | null {
    const s = this.storage.signUrlIfPrivate(u ?? null);
    if (!s) return s ?? null;
    const i = s.indexOf('/v1/storage/files/');
    return i >= 0 ? s.slice(i) : s;
  }

  private sign(row: CitizenNews): CitizenNews {
    row.coverUrl = this.signRel(row.coverUrl);
    return row;
  }

  private async storeCover(file?: Express.Multer.File): Promise<string | null> {
    if (!file) return null;
    return this.storage.storeCitizenAttachment(file.buffer, file.mimetype, file.originalname, 'news');
  }

  // ─────────────────────────────── ประชาชน (สาธารณะ)
  async listPublic(org?: string, category?: string, limit = 20) {
    const orgId = await this.resolveOrg(org);
    const qb = this.repo.createQueryBuilder('n')
      .where('n.organizationId = :orgId', { orgId })
      .andWhere("n.status = 'published'");
    if (category && (NEWS_CATEGORIES as readonly string[]).includes(category)) qb.andWhere('n.category = :category', { category });
    qb.orderBy('n.pinned', 'DESC').addOrderBy('n.publishedAt', 'DESC').addOrderBy('n.createdAt', 'DESC').take(Math.min(limit, 50));
    const rows = await qb.getMany();
    return rows.map((r) => this.sign(r));
  }

  async detailPublic(id: string, org?: string) {
    const orgId = await this.resolveOrg(org);
    const row = await this.repo.findOne({ where: { id, organizationId: orgId, status: 'published' } });
    if (!row) throw new NotFoundException('ไม่พบข่าวนี้');
    return this.sign(row);
  }

  // ─────────────────────────────── เจ้าหน้าที่ (CMS)
  async listStaff(orgId: string, status?: string) {
    const qb = this.repo.createQueryBuilder('n').where('n.organizationId = :orgId', { orgId });
    if (status && (NEWS_STATUSES as readonly string[]).includes(status)) qb.andWhere('n.status = :status', { status });
    qb.orderBy('n.pinned', 'DESC').addOrderBy('n.createdAt', 'DESC');
    const rows = await qb.getMany();
    return rows.map((r) => this.sign(r));
  }

  async detailStaff(id: string, orgId: string) {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('ไม่พบข่าวนี้');
    return this.sign(row);
  }

  /** วันที่เผยแพร่ที่เจ้าหน้าที่กำหนดเอง (YYYY-MM-DD หรือ ISO) — ไม่ถูกต้อง/อนาคต = ไม่ใช้ */
  static pubDate(v: unknown): Date | null {
    if (typeof v !== 'string' || !v.trim()) return null;
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? `${v.trim()}T09:00:00+07:00` : v.trim());
    return Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86400000 ? null : d;
  }

  async create(body: any, file: Express.Multer.File | undefined, orgId: string, userId: string) {
    if (!body?.title?.trim()) throw new BadRequestException('กรุณาระบุหัวข้อข่าว');
    const status = (NEWS_STATUSES as readonly string[]).includes(body.status) ? body.status : 'draft';
    const coverUrl = await this.storeCover(file);
    const row = await this.repo.save(this.repo.create({
      organizationId: orgId,
      title: String(body.title).trim().slice(0, 250),
      category: (NEWS_CATEGORIES as readonly string[]).includes(body.category) ? body.category : 'ข่าวประชาสัมพันธ์',
      excerpt: body.excerpt?.trim() || null,
      content: body.content?.trim() || null,
      coverUrl,
      status,
      pinned: body.pinned === 'true' || body.pinned === true,
      publishedAt: status === 'published' ? (CitizenNewsService.pubDate(body.publishedAt) ?? new Date()) : null,
      createdBy: userId || null,
    }));
    return this.detailStaff(row.id, orgId);
  }

  async update(id: string, body: any, file: Express.Multer.File | undefined, orgId: string) {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('ไม่พบข่าวนี้');
    if (body.title !== undefined) row.title = String(body.title).trim().slice(0, 250);
    if (body.category !== undefined && (NEWS_CATEGORIES as readonly string[]).includes(body.category)) row.category = body.category;
    if (body.excerpt !== undefined) row.excerpt = body.excerpt?.trim() || null;
    if (body.content !== undefined) row.content = body.content?.trim() || null;
    if (body.pinned !== undefined) row.pinned = body.pinned === 'true' || body.pinned === true;
    if (body.status !== undefined && (NEWS_STATUSES as readonly string[]).includes(body.status)) {
      if (body.status === 'published' && row.status !== 'published') row.publishedAt = new Date();
      row.status = body.status;
    }
    const pub = CitizenNewsService.pubDate(body.publishedAt);
    if (pub && row.status === 'published') row.publishedAt = pub;
    const cover = await this.storeCover(file);
    if (cover) row.coverUrl = cover;
    await this.repo.save(row);
    return this.detailStaff(id, orgId);
  }

  async remove(id: string, orgId: string) {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('ไม่พบข่าวนี้');
    await this.repo.remove(row);
    return { deleted: true };
  }
}
