import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CitizenReport } from '../../database/entities/citizen-report.entity';
import { CitizenReportComment } from '../../database/entities/citizen-report-comment.entity';
import { FileUpload } from '../../database/entities/file-upload.entity';
import { DocEditorService, DocPdfPayload } from '../doc-editor/doc-editor.service';
import { assertLayout } from '../doc-editor/doc-templates.service';
import { AttachmentAccessRegistry } from '../storage/attachment-access.registry';

const isAdmin = (user: any) => (user?.roles || []).some((r: string) => r === 'ADMIN' || r === 'SUPER_ADMIN');
const COMMENT_SELECT = { id: true, body: true, createdAt: true, userId: true, user: { id: true, titleTh: true, fullNameTh: true, positionName: true } };

/** เรื่องแจ้ง/ร้องเรียน: เอกสารที่แต่ง (ตัวแต่งเอกสาร) + ความเห็นภายในของเจ้าหน้าที่ — ไม่แตะขั้นตอนอนุมัติ 3 ผู้เซ็น */
@Injectable()
export class CitizenReportDocService implements OnModuleInit {
  constructor(
    @InjectRepository(CitizenReport) private readonly repo: Repository<CitizenReport>,
    @InjectRepository(CitizenReportComment) private readonly commentRepo: Repository<CitizenReportComment>,
    @InjectRepository(FileUpload) private readonly fileRepo: Repository<FileUpload>,
    private readonly docEditor: DocEditorService,
    private readonly accessRegistry: AttachmentAccessRegistry,
  ) {}

  /** ไฟล์ที่เจ้าหน้าที่อัปโหลดในตัวแต่งเอกสาร (refType citizen-report) — เห็นได้เฉพาะคนใน อบต. ของเรื่อง */
  onModuleInit() {
    this.accessRegistry.register('citizen-report', async (refId, user) =>
      (await this.repo.count({ where: { id: refId, organizationId: user?.organizationId } })) > 0);
  }

  private async assertReport(id: string, orgId: string) {
    const n = await this.repo.count({ where: { id, organizationId: orgId } });
    if (!n) throw new NotFoundException('ไม่พบเรื่อง');
  }

  // ─────────── เอกสารที่อัปโหลด (หลายไฟล์) — ลายเซ็น/ข้อความที่วางเก็บแยกต่อไฟล์ใน doc_layout.docs[fileId] ───────────
  private async docsOf(id: string, orgId: string): Promise<Record<string, any>> {
    const row = await this.repo.createQueryBuilder('r').addSelect('r.docLayout')
      .where('r.id = :id AND r.organizationId = :orgId', { id, orgId }).getOne();
    if (!row) throw new NotFoundException('ไม่พบเรื่อง');
    const docs = row.docLayout?.docs;
    return docs && typeof docs === 'object' ? docs : {};
  }

  private async assertFile(id: string, fileId: string) {
    const f = await this.fileRepo.findOne({ where: { id: fileId, refType: 'citizen-report', refId: id } });
    if (!f) throw new NotFoundException('ไม่พบเอกสารของเรื่องนี้');
  }

  async getLayout(id: string, orgId: string, fileId: string) {
    if (!fileId) throw new BadRequestException('ไม่ได้ระบุเอกสาร');
    const docs = await this.docsOf(id, orgId);
    return { layout: docs[fileId] ?? null };
  }

  async saveLayout(id: string, orgId: string, fileId: string, layout: any) {
    if (!fileId) throw new BadRequestException('ไม่ได้ระบุเอกสาร');
    await this.assertFile(id, fileId);
    assertLayout(layout);
    const docs = await this.docsOf(id, orgId);
    docs[fileId] = layout;
    await this.repo.update({ id, organizationId: orgId }, { docLayout: { docs } });
    return { ok: true };
  }

  /** ใครวางลายเซ็นไว้ในเอกสารไหนบ้าง (ใช้แสดงในแผงรายละเอียด) */
  async summary(id: string, orgId: string) {
    const docs = await this.docsOf(id, orgId);
    const out: Record<string, { ownerId: string; name: string }[]> = {};
    for (const [fileId, l] of Object.entries(docs)) {
      out[fileId] = (Array.isArray(l?.items) ? l.items : [])
        .filter((it: any) => it?.type === 'signature' && it.props?.ownerId)
        .map((it: any) => ({ ownerId: it.props.ownerId, name: String(it.props.name || '') }));
    }
    return out;
  }

  async renderPdf(id: string, orgId: string, payload: DocPdfPayload) {
    await this.assertReport(id, orgId);
    return this.docEditor.renderStandalonePdf(payload);
  }

  // ─────────── ความเห็น ───────────
  async listComments(id: string, orgId: string) {
    await this.assertReport(id, orgId);
    return this.commentRepo.find({ where: { reportId: id, organizationId: orgId }, relations: ['user'], order: { createdAt: 'ASC' }, select: COMMENT_SELECT });
  }

  async addComment(id: string, user: any, body?: string) {
    await this.assertReport(id, user.organizationId);
    const text = String(body || '').trim();
    if (!text) throw new BadRequestException('กรุณาพิมพ์ความเห็น');
    if (text.length > 2000) throw new BadRequestException('ความเห็นยาวเกิน 2,000 ตัวอักษร');
    const saved = await this.commentRepo.save(this.commentRepo.create({ organizationId: user.organizationId, reportId: id, userId: user.id, body: text }));
    return this.commentRepo.findOne({ where: { id: saved.id }, relations: ['user'], select: COMMENT_SELECT });
  }

  async deleteComment(id: string, commentId: string, user: any) {
    const c = await this.commentRepo.findOne({ where: { id: commentId, reportId: id, organizationId: user.organizationId } });
    if (!c) throw new NotFoundException('ไม่พบความเห็น');
    if (c.userId !== user.id && !isAdmin(user)) throw new ForbiddenException('ลบได้เฉพาะความเห็นของตัวเอง');
    await this.commentRepo.softDelete(c.id);
    return { ok: true };
  }
}
