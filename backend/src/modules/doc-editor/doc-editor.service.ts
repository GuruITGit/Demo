import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PDFDocument } from 'pdf-lib';
import { FileUpload } from '../../database/entities/file-upload.entity';
import { PdfService } from '../pdf/pdf.service';
import { StorageService } from '../storage/storage.service';
import { TicketService } from '../ticket/ticket.service';
import { noticeFontCss } from '../water/notice-fonts';

/**
 * หน้าในเอกสาร: พื้นหลังเป็นหน้าจากไฟล์แนบ (srcPage) หรือหน้าเปล่า + HTML ของชั้นที่แต่ง (inline style ล้วน)
 * bg = ภาพพื้นหลังที่หน้าเว็บเรนเดอร์ส่งมาเอง (data URL JPEG/PNG) — ใช้กับเอกสารที่ไม่ได้อยู่ในไฟล์แนบ เช่น คำร้องประชาชน
 */
export interface DocPdfPage { src: 'attachment' | 'blank'; srcPage?: number; html: string; bg?: string }
export interface DocPdfPayload { pages: DocPdfPage[]; fileId?: string | null; attach?: boolean; filename?: string }

const A4 = { w: 595.28, h: 841.89 };
/** หมวดไฟล์แนบที่สร้างจากตัวแต่งเอกสาร — หน้าแต่งเอกสารไม่เอามาเป็นไฟล์ต้นฉบับ (กันแต่งซ้อนทับของเดิม) */
export const DOC_EXPORT_CATEGORY = 'doc-export';
const MAX_PAGES = 60;

/**
 * สร้าง PDF จากตัวแต่งเอกสาร (ข้อความ/ตรา/ลายเซ็น ทับบนหนังสือที่แนบ หรือหน้าเปล่า)
 * 1) เรนเดอร์ชั้นที่แต่งเป็น PDF โปร่งใสด้วย Chromium (ฝัง TH Sarabun New → ตัวหนังสือคม คัดลอกได้)
 * 2) ซ้อนลงบนหน้า PDF ต้นฉบับด้วย pdf-lib (ต้นฉบับคมเท่าเดิม ไม่ถูกแปลงเป็นภาพ)
 * ไม่แตะ workflow สารบรรณ
 */
@Injectable()
export class DocEditorService {
  private readonly logger = new Logger(DocEditorService.name);

  constructor(
    @InjectRepository(FileUpload) private readonly fileRepo: Repository<FileUpload>,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    private readonly tickets: TicketService,
  ) {}

  async renderTicketPdf(ticketId: string, payload: DocPdfPayload, user: any): Promise<{ buffer: Buffer; filename: string; attachedId?: string }> {
    if (!(await this.tickets.canAccessTicket(ticketId, user))) throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงสารบรรณนี้');
    const pages = this.assertPages(payload);

    // ไฟล์ต้นฉบับ — ต้องเป็นไฟล์แนบของเรื่องนี้เท่านั้น
    let srcPdf: PDFDocument | null = null;
    let srcImage: { bytes: Buffer; png: boolean } | null = null;
    if (payload.fileId && pages.some((p) => p.src === 'attachment')) {
      const f = await this.fileRepo.findOne({ where: { id: payload.fileId } });
      if (!f || f.refType !== 'ticket' || f.refId !== ticketId) throw new NotFoundException('ไม่พบไฟล์แนบของเรื่องนี้');
      const bytes = await this.storage.getFileBuffer(f.bucket, f.objectKey);
      if ((f.mimeType || '').includes('pdf') || /\.pdf$/i.test(f.originalName || '')) {
        srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      } else {
        srcImage = await this.toEmbeddableImage(bytes, f.mimeType || '');
      }
    }

    const buffer = await this.compose(pages, srcPdf, srcImage);

    const base = (payload.filename || 'เอกสาร').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'เอกสาร';
    const filename = /\.pdf$/i.test(base) ? base : `${base}.pdf`;
    let attachedId: string | undefined;
    if (payload.attach) {
      const saved = await this.storage.uploadFile(
        { buffer, size: buffer.length, originalname: filename, mimetype: 'application/pdf' } as Express.Multer.File,
        'documents', user.id, 'ticket', ticketId, 'เอกสารที่แต่งแล้ว', DOC_EXPORT_CATEGORY,
      );
      attachedId = saved.id;
    }
    return { buffer, filename, attachedId };
  }

  /** PDF จากหน้าที่มีพื้นหลังส่งมาเอง (bg) หรือหน้าเปล่า — ไม่ผูกกับไฟล์แนบ (ผู้เรียกตรวจสิทธิ์เอง) */
  async renderStandalonePdf(payload: DocPdfPayload): Promise<{ buffer: Buffer; filename: string }> {
    const pages = this.assertPages(payload);
    const buffer = await this.compose(pages, null, null);
    const base = (payload.filename || 'เอกสาร').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'เอกสาร';
    return { buffer, filename: /\.pdf$/i.test(base) ? base : `${base}.pdf` };
  }

  private assertPages(payload: DocPdfPayload): DocPdfPage[] {
    const pages = Array.isArray(payload?.pages) ? payload.pages : [];
    if (!pages.length) throw new BadRequestException('ไม่มีหน้าเอกสาร');
    if (pages.length > MAX_PAGES) throw new BadRequestException(`เอกสารยาวเกิน ${MAX_PAGES} หน้า`);
    return pages;
  }

  /** ประกอบ PDF: พื้นหลังแต่ละหน้า (หน้า PDF ต้นฉบับ / รูป / ภาพ bg / ว่าง) + ชั้นที่แต่ง */
  private async compose(pages: DocPdfPage[], srcPdf: PDFDocument | null, srcImage: { bytes: Buffer; png: boolean } | null): Promise<Buffer> {
    const overlay = await PDFDocument.load(await this.renderOverlay(pages));
    const out = await PDFDocument.create();
    for (let i = 0; i < pages.length; i++) {
      const page = out.addPage([A4.w, A4.h]);
      const spec = pages[i];
      // พื้นหลัง: ย่อให้พอดี A4 กึ่งกลาง (ตรงกับที่เห็นบนจอ — object-contain)
      const bg = typeof spec.bg === 'string' ? /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(spec.bg) : null;
      if (bg) {
        const bytes = Buffer.from(bg[2], 'base64');
        const img = bg[1].toLowerCase() === 'png' ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        page.drawImage(img, this.contain(img.width, img.height));
      } else if (spec.src === 'attachment') {
        if (srcPdf && Number.isInteger(spec.srcPage) && spec.srcPage! >= 0 && spec.srcPage! < srcPdf.getPageCount()) {
          const [emb] = await out.embedPdf(srcPdf, [spec.srcPage!]);
          page.drawPage(emb, this.contain(emb.width, emb.height));
        } else if (srcImage) {
          const img = srcImage.png ? await out.embedPng(srcImage.bytes) : await out.embedJpg(srcImage.bytes);
          page.drawImage(img, this.contain(img.width, img.height));
        }
      }
      const [ov] = await out.embedPdf(overlay, [i]);
      page.drawPage(ov, { x: 0, y: 0, width: A4.w, height: A4.h });
    }
    return Buffer.from(await out.save());
  }

  /** เรนเดอร์ชั้นที่แต่งทุกหน้าเป็น PDF พื้นโปร่งใส ขนาด A4 ไม่มีขอบ */
  private async renderOverlay(pages: DocPdfPage[]): Promise<Buffer> {
    const body = pages.map((p) => `<div class="pg">${this.clean(p.html)}</div>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      ${noticeFontCss()}
      @page { size: A4; margin: 0; }
      html, body { margin: 0; padding: 0; background: transparent; }
      .pg { position: relative; width: 794px; height: 1123px; overflow: hidden; page-break-after: always;
            font-family: 'TH SarabunNew', sans-serif; color: #000; }
      .pg:last-child { page-break-after: auto; }
      * { box-sizing: border-box; }
    </style></head><body>${body}</body></html>`;
    return this.pdf.generateFromHtml(html, { margin: { top: '0', right: '0', bottom: '0', left: '0' }, omitBackground: true, preferCSSPageSize: true });
  }

  /** HTML มาจากหน้าเว็บ — Chromium ปิด JS + บล็อก network อยู่แล้ว (PdfService.hardenPage) ตัด script/handler ทิ้งอีกชั้น */
  private clean(html: string): string {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<(iframe|object|embed|link|meta|base)[^>]*>/gi, '')
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  }

  /** กล่องย่อให้พอดี A4 กึ่งกลาง (หน่วย pt) */
  private contain(w: number, h: number) {
    const r = Math.min(A4.w / w, A4.h / h);
    const dw = w * r, dh = h * r;
    return { x: (A4.w - dw) / 2, y: (A4.h - dh) / 2, width: dw, height: dh };
  }

  /** pdf-lib ฝังได้แค่ JPG/PNG — รูปชนิดอื่นแปลงเป็น PNG ด้วย sharp (ถ้ามี) */
  private async toEmbeddableImage(bytes: Buffer, mime: string): Promise<{ bytes: Buffer; png: boolean } | null> {
    const m = mime.toLowerCase();
    if (m.includes('png')) return { bytes, png: true };
    if (m.includes('jpeg') || m.includes('jpg')) return { bytes, png: false };
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sharp = require('sharp');
      return { bytes: await sharp(bytes).png().toBuffer(), png: true };
    } catch (e) {
      this.logger.warn(`doc-editor: แปลงรูป ${mime} ไม่ได้ — ใช้หน้าเปล่าแทน`);
      return null;
    }
  }
}
