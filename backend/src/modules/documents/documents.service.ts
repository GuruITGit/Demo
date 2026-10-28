import { Injectable, NotFoundException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Brackets } from 'typeorm';
import { Document } from '../../database/entities/document.entity';
import { DocumentCategory } from '../../database/entities/document-category.entity';
import { DocumentVersion } from '../../database/entities/document-version.entity';
import { StorageService } from '../storage/storage.service';
import { AttachmentAccessRegistry } from '../storage/attachment-access.registry';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { assertCanModify, isAdmin } from '../../common/utils/ownership.util';

/**
 * สิทธิ์การเข้าถึงเอกสารตามระดับ:
 *  - public (สาธารณะ)        : ทุกคนในองค์กรเห็นได้
 *  - department (แค่กอง)      : เฉพาะคนในกองเดียวกัน + ผู้สร้าง + admin
 *  - private (แค่เฉพาะบุคคล)  : เฉพาะผู้สร้าง + admin
 *  (ค่าเดิม internal→เหมือน public, confidential→เหมือน department เพื่อ back-compat)
 */
function canViewDoc(doc: Document, user: any): boolean {
  if (isAdmin(user)) return true;
  const lvl = doc.accessLevel;
  if (lvl === 'public' || lvl === 'internal') return true;
  if (doc.createdBy === user?.id) return true;
  if (lvl === 'department' || lvl === 'confidential') {
    return !!(doc.departmentId && user?.departmentId && doc.departmentId === user.departmentId);
  }
  if (lvl === 'private') {
    return (doc.allowedUserIds || []).includes(user?.id);
  }
  return false;
}

@Injectable()
export class DocumentsService implements OnModuleInit {
  constructor(
    @InjectRepository(Document) private docRepo: Repository<Document>,
    @InjectRepository(DocumentCategory) private catRepo: Repository<DocumentCategory>,
    @InjectRepository(DocumentVersion) private versionRepo: Repository<DocumentVersion>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private storageService: StorageService,
    private accessRegistry: AttachmentAccessRegistry,
  ) {}

  /** ลงทะเบียนตัวตรวจสิทธิ์ไฟล์แนบคลังเอกสาร (ตามระดับการเข้าถึงเอกสาร) */
  onModuleInit() {
    this.accessRegistry.register('document', async (refId, user) => {
      const doc = await this.docRepo.findOne({ where: { id: refId } });
      return !!doc && canViewDoc(doc, user);
    });
  }

  async findAll(
    orgId: string,
    dto: PaginationDto & { categoryId?: string; accessLevel?: string; departmentId?: string; dateFrom?: string; dateTo?: string },
    user: any,
  ) {
    const qb = this.docRepo.createQueryBuilder('doc')
      .leftJoinAndSelect('doc.category', 'category')
      .leftJoinAndSelect('doc.creator', 'creator')
      .leftJoinAndSelect('doc.department', 'department')
      .where('doc.organization_id = :orgId', { orgId })
      .andWhere('doc.is_active = true');

    if (dto.categoryId) qb.andWhere('doc.category_id = :cat', { cat: dto.categoryId });
    if (dto.accessLevel) qb.andWhere('doc.access_level = :al', { al: dto.accessLevel });
    if (dto.departmentId) qb.andWhere('doc.department_id = :dp', { dp: dto.departmentId });
    if (dto.dateFrom) qb.andWhere('doc.created_at >= :df', { df: dto.dateFrom });
    if (dto.dateTo) qb.andWhere('doc.created_at < (:dt::date + 1)', { dt: dto.dateTo });
    if (dto.search) {
      qb.andWhere(new Brackets((w) => {
        w.where('doc.title ILIKE :s', { s: `%${dto.search}%` })
          .orWhere('doc.doc_number ILIKE :s', { s: `%${dto.search}%` })
          .orWhere('doc.description ILIKE :s', { s: `%${dto.search}%` })
          .orWhere('doc.owner_org ILIKE :s', { s: `%${dto.search}%` });
      }));
    }

    // จำกัดการมองเห็นตามระดับ (ยกเว้น admin)
    if (!isAdmin(user)) {
      qb.andWhere(new Brackets((w) => {
        w.where("doc.access_level IN ('public','internal')")
          .orWhere('doc.created_by = :uid', { uid: user.id })
          .orWhere("(doc.access_level IN ('department','confidential') AND doc.department_id = :udept)", { udept: user.departmentId || '00000000-0000-0000-0000-000000000000' })
          .orWhere("(doc.access_level = 'private' AND :uid = ANY(doc.allowed_user_ids))", { uid: user.id });
      }));
    }

    qb.orderBy('doc.createdAt', 'DESC').skip(dto.skip).take(dto.limit);
    const [data, total] = await qb.getManyAndCount();
    data.forEach((d) => { d.fileUrl = this.storageService.signUrlIfPrivate(d.fileUrl); });
    return paginate(data, total, dto);
  }

  /** ออกเลขเอกสารอัตโนมัติ (atomic ต่อองค์กร/ปี) เช่น อกส2569-00001 */
  private async genDocNumber(orgId: string): Promise<string> {
    const year = new Date().getFullYear() + 543;
    const rows = await this.docRepo.query(
      `INSERT INTO document_number_sequences (organization_id, doc_type, year, prefix, current_number)
       VALUES ($1, 'DOC', $2, 'อกส', 1)
       ON CONFLICT (organization_id, doc_type, year)
       DO UPDATE SET current_number = document_number_sequences.current_number + 1, updated_at = NOW()
       RETURNING current_number`,
      [orgId, year],
    );
    return `อกส${year}-${String(rows[0].current_number).padStart(5, '0')}`;
  }

  async findOne(id: string, orgId: string, user: any) {
    const doc = await this.docRepo.findOne({
      where: { id, organizationId: orgId, isActive: true },
      relations: ['category', 'creator', 'department'],
    });
    if (!doc) throw new NotFoundException('ไม่พบเอกสาร');
    if (!canViewDoc(doc, user)) {
      throw new ForbiddenException('เอกสารนี้เป็นความลับ คุณไม่มีสิทธิ์เข้าถึง');
    }
    await this.docRepo.increment({ id }, 'viewCount', 1);
    await this.auditRepo.save({ organizationId: orgId, userId: user.id, action: 'READ', module: 'document', resourceId: id, resourceTitle: doc.title });
    // ออก signed URL ให้ผู้ใช้ที่ผ่านการตรวจสิทธิ์แล้ว (ไฟล์อยู่ใน private bucket)
    doc.fileUrl = this.storageService.signUrlIfPrivate(doc.fileUrl);
    return doc;
  }

  async upload(dto: any, orgId: string, userId: string, file: Express.Multer.File) {
    const uploaded = await this.storageService.uploadFile(file, 'documents', userId);
    const level = dto.accessLevel || 'department';

    // private → เลือกบุคคลที่เข้าได้ (เจ้าของเข้าได้เสมอ) · department → เลือกกอง · public → ไม่จำกัด
    let allowedUserIds: string[] = [];
    if (level === 'private') {
      try { allowedUserIds = typeof dto.allowedUserIds === 'string' ? JSON.parse(dto.allowedUserIds) : (dto.allowedUserIds || []); } catch { allowedUserIds = []; }
      if (!allowedUserIds.includes(userId)) allowedUserIds.push(userId);
    }

    const doc = await this.docRepo.save(this.docRepo.create({
      organizationId: orgId,
      createdBy: userId, // ผู้อัปโหลด (auto)
      docNumber: dto.docNumber || await this.genDocNumber(orgId), // เลขที่ auto
      title: dto.title,
      description: dto.description || null,
      categoryId: dto.categoryId || null,
      ownerOrg: dto.ownerOrg || null,
      accessLevel: level,
      departmentId: level === 'department' ? (dto.departmentId || null) : null,
      allowedUserIds,
      fileUrl: uploaded.url,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    }));
    await this.storageService['fileRepo'].update(uploaded.id, { refType: 'document', refId: doc.id, isOrphan: false });
    await this.auditRepo.save({ organizationId: orgId, userId, action: 'CREATE', module: 'document', resourceId: doc.id, resourceTitle: doc.title });
    return doc;
  }

  async createFromText(dto: { title: string; ocrText: string; tags?: string[] }, orgId: string, userId: string) {
    const doc = await this.docRepo.save({
      title: dto.title,
      organizationId: orgId,
      createdBy: userId,
      ocrText: dto.ocrText,
      fileUrl: 'text://',
      fileName: `${dto.title}.txt`,
      fileSize: Buffer.byteLength(dto.ocrText, 'utf8'),
      mimeType: 'text/plain',
      tags: dto.tags ?? [],
      ocrProcessedAt: new Date(),
    });
    await this.auditRepo.save({ organizationId: orgId, userId, action: 'CREATE', module: 'document', resourceId: doc.id, resourceTitle: doc.title });
    return doc;
  }

  async update(id: string, dto: any, orgId: string, user: any) {
    const doc = await this.docRepo.findOne({ where: { id, organizationId: orgId } });
    if (!doc) throw new NotFoundException('ไม่พบเอกสาร');
    assertCanModify(doc, user, 'dms:update:Document');
    Object.assign(doc, dto);
    return this.docRepo.save(doc);
  }

  async softDelete(id: string, orgId: string, user: any) {
    const doc = await this.docRepo.findOne({ where: { id, organizationId: orgId } });
    if (!doc) throw new NotFoundException('ไม่พบเอกสาร');
    assertCanModify(doc, user, 'dms:delete:Document');
    await this.docRepo.softDelete(id);
    await this.auditRepo.save({ organizationId: orgId, userId: user.id, action: 'DELETE', module: 'document', resourceId: id, resourceTitle: doc.title });
    return { message: 'ลบเอกสารสำเร็จ' };
  }

  async download(id: string, orgId: string, userId: string) {
    const doc = await this.docRepo.findOne({ where: { id, organizationId: orgId } });
    if (!doc) throw new NotFoundException('ไม่พบเอกสาร');
    await this.docRepo.increment({ id }, 'downloadCount', 1);
    await this.auditRepo.save({ organizationId: orgId, userId, action: 'DOWNLOAD', module: 'document', resourceId: id, resourceTitle: doc.title });
    return { url: this.storageService.signUrlIfPrivate(doc.fileUrl), fileName: doc.fileName };
  }

  async addVersion(id: string, orgId: string, userId: string, file: Express.Multer.File, note?: string) {
    const doc = await this.docRepo.findOne({ where: { id, organizationId: orgId } });
    if (!doc) throw new NotFoundException('ไม่พบเอกสาร');

    const versionCount = await this.versionRepo.count({ where: { documentId: id } });
    const uploaded = await this.storageService.uploadFile(file, 'documents', userId, 'document', id);

    await this.versionRepo.save({
      documentId: id,
      versionNumber: versionCount + 2,
      fileUrl: uploaded.url,
      fileSize: file.size,
      changeNote: note,
      createdBy: userId,
    });

    await this.docRepo.update(id, { fileUrl: uploaded.url, fileName: file.originalname, fileSize: file.size });
    return { message: 'อัปโหลดเวอร์ชั่นใหม่สำเร็จ' };
  }

  async getVersions(id: string) {
    const versions = await this.versionRepo.find({
      where: { documentId: id },
      relations: ['creator'],
      order: { versionNumber: 'DESC' },
    });
    versions.forEach((v) => { v.fileUrl = this.storageService.signUrlIfPrivate(v.fileUrl); });
    return versions;
  }

  async getCategories(orgId: string) {
    return this.catRepo.find({
      where: [{ organizationId: orgId, isActive: true }, { organizationId: IsNull(), isActive: true }],
      order: { orderNo: 'ASC', nameTh: 'ASC' },
    });
  }

  // ── จัดการหมวดหมู่ (admin) — สร้าง/แก้/ลบ เฉพาะหมวดขององค์กร (หมวดมาตรฐาน organizationId=null แก้ไม่ได้) ──
  async createCategory(dto: { nameTh: string; description?: string; orderNo?: number }, orgId: string) {
    if (!dto.nameTh?.trim()) throw new ForbiddenException('กรุณาระบุชื่อหมวดหมู่');
    const code = `CAT_${Date.now().toString(36).toUpperCase()}`;
    return this.catRepo.save(this.catRepo.create({
      organizationId: orgId, code, nameTh: dto.nameTh.trim(), description: dto.description ?? null, orderNo: dto.orderNo ?? 99, isActive: true,
    }));
  }

  async updateCategory(id: string, dto: { nameTh?: string; description?: string; orderNo?: number }, orgId: string) {
    const c = await this.catRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('ไม่พบหมวดหมู่');
    if (c.organizationId !== orgId) throw new ForbiddenException('แก้ไขได้เฉพาะหมวดหมู่ขององค์กรนี้ (หมวดมาตรฐานแก้ไม่ได้)');
    if (dto.nameTh !== undefined) c.nameTh = dto.nameTh.trim();
    if (dto.description !== undefined) c.description = dto.description;
    if (dto.orderNo !== undefined) c.orderNo = dto.orderNo;
    return this.catRepo.save(c);
  }

  async deleteCategory(id: string, orgId: string) {
    const c = await this.catRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('ไม่พบหมวดหมู่');
    if (c.organizationId !== orgId) throw new ForbiddenException('ลบได้เฉพาะหมวดหมู่ขององค์กรนี้');
    await this.catRepo.update(id, { isActive: false });
    return { message: 'ลบหมวดหมู่แล้ว' };
  }

  async getStats(orgId: string) {
    const total = await this.docRepo.count({ where: { organizationId: orgId, isActive: true } });
    const byCategory = await this.docRepo
      .createQueryBuilder('doc')
      .select('cat.name_th', 'category')
      .addSelect('COUNT(doc.id)', 'count')
      .leftJoin('doc.category', 'cat')
      .where('doc.organization_id = :orgId', { orgId })
      .andWhere('doc.is_active = true')
      .groupBy('cat.name_th')
      .getRawMany();
    return { total, byCategory };
  }
}
