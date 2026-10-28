import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { DocumentTemplate } from '../../database/entities/document-template.entity';
import { TicketDocument } from '../../database/entities/ticket-document.entity';
import { TicketService } from '../ticket/ticket.service';
import { SYSTEM_TEMPLATES } from './system-templates';
import { assertLayout } from './layout-validate';

export { assertLayout };

const CATEGORIES = ['overlay', 'document'];

/** แม่แบบเอกสาร + เอกสารที่ร่างใหม่ในเรื่องสารบรรณ */
@Injectable()
export class DocTemplatesService implements OnModuleInit {
  private readonly logger = new Logger(DocTemplatesService.name);

  constructor(
    @InjectRepository(DocumentTemplate) private readonly tplRepo: Repository<DocumentTemplate>,
    @InjectRepository(TicketDocument) private readonly docRepo: Repository<TicketDocument>,
    private readonly tickets: TicketService,
  ) {}

  /** ใส่/อัปเดตแม่แบบมาตรฐานตอนเปิดเซิร์ฟเวอร์ (idempotent ตาม system_key) — พังก็ไม่ล้มทั้งระบบ (แก้แม่แบบใน system-templates.ts แล้ว deploy = อัปเดตทุก อบต.) */
  async onModuleInit() {
    try {
      for (const t of SYSTEM_TEMPLATES) {
        const found = await this.tplRepo.findOne({ where: { systemKey: t.key }, withDeleted: true });
        if (found) {
          await this.tplRepo.update(found.id, { name: t.name, category: t.category, layout: t.layout, deletedAt: null });
        } else {
          await this.tplRepo.save(this.tplRepo.create({ organizationId: null, systemKey: t.key, name: t.name, category: t.category, layout: t.layout }));
        }
      }
    } catch (e: any) {
      this.logger.warn(`seed แม่แบบมาตรฐานไม่สำเร็จ (ยังไม่ได้รัน migration?): ${e?.message}`);
    }
  }

  // ─────────── แม่แบบ ───────────
  async listTemplates(user: any, category?: string) {
    const where: any[] = [{ organizationId: IsNull() }, { organizationId: user.organizationId }];
    if (category) where.forEach((w) => { w.category = category; });
    const rows = await this.tplRepo.find({ where, order: { createdAt: 'ASC' } });
    // แม่แบบมาตรฐานขึ้นก่อน
    return rows.sort((a, b) => Number(!!b.systemKey) - Number(!!a.systemKey));
  }

  async createTemplate(user: any, dto: { name?: string; category?: string; layout?: any }) {
    const name = String(dto?.name || '').trim();
    if (!name) throw new BadRequestException('กรุณาตั้งชื่อแม่แบบ');
    if (!CATEGORIES.includes(dto.category || '')) throw new BadRequestException('ประเภทแม่แบบไม่ถูกต้อง');
    assertLayout(dto.layout);
    return this.tplRepo.save(this.tplRepo.create({
      organizationId: user.organizationId, name: name.slice(0, 200), category: dto.category, layout: dto.layout, createdBy: user.id,
    }));
  }

  async deleteTemplate(user: any, id: string) {
    const t = await this.tplRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('ไม่พบแม่แบบ');
    if (t.systemKey || t.organizationId !== user.organizationId) throw new ForbiddenException('ลบได้เฉพาะแม่แบบของหน่วยงานตัวเอง (แม่แบบมาตรฐานลบไม่ได้)');
    await this.tplRepo.softDelete(id);
    return { ok: true };
  }

  // ─────────── เอกสารที่ร่างใหม่ในเรื่อง ───────────
  private async assertTicket(ticketId: string, user: any) {
    if (!(await this.tickets.canAccessTicket(ticketId, user))) throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงสารบรรณนี้');
  }

  private async getDoc(ticketId: string, docId: string, user: any) {
    await this.assertTicket(ticketId, user);
    const d = await this.docRepo.findOne({ where: { id: docId, ticketId, organizationId: user.organizationId } });
    if (!d) throw new NotFoundException('ไม่พบเอกสาร');
    return d;
  }

  async listDocs(ticketId: string, user: any) {
    await this.assertTicket(ticketId, user);
    const rows = await this.docRepo.find({
      where: { ticketId, organizationId: user.organizationId },
      relations: ['creator'], order: { updatedAt: 'DESC' },
      select: { id: true, title: true, templateId: true, createdAt: true, updatedAt: true, creator: { id: true, titleTh: true, fullNameTh: true } },
    });
    return rows;
  }

  async createDoc(ticketId: string, user: any, dto: { title?: string; templateId?: string; layout?: any }) {
    await this.assertTicket(ticketId, user);
    let layout = dto.layout;
    let title = String(dto.title || '').trim();
    if (!layout && dto.templateId) {
      const t = await this.tplRepo.findOne({ where: [{ id: dto.templateId, organizationId: IsNull() }, { id: dto.templateId, organizationId: user.organizationId }] });
      if (!t) throw new NotFoundException('ไม่พบแม่แบบ');
      layout = t.layout;
      title = title || t.name;
    }
    layout = layout || { version: 2, pages: [{ src: 'blank' }], items: [] };
    assertLayout(layout);
    return this.docRepo.save(this.docRepo.create({
      organizationId: user.organizationId, ticketId, title: (title || 'เอกสารใหม่').slice(0, 200),
      templateId: dto.templateId || null, layout, createdBy: user.id, updatedBy: user.id,
    }));
  }

  async getDocFull(ticketId: string, docId: string, user: any) {
    return this.getDoc(ticketId, docId, user);
  }

  async updateDoc(ticketId: string, docId: string, user: any, dto: { title?: string; layout?: any }) {
    const d = await this.getDoc(ticketId, docId, user);
    if (dto.layout !== undefined) { assertLayout(dto.layout); d.layout = dto.layout; }
    if (dto.title !== undefined) d.title = String(dto.title).trim().slice(0, 200) || d.title;
    d.updatedBy = user.id;
    return this.docRepo.save(d);
  }

  async deleteDoc(ticketId: string, docId: string, user: any) {
    const d = await this.getDoc(ticketId, docId, user);
    await this.docRepo.softDelete(d.id);
    return { ok: true };
  }
}
