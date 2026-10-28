/** ตัวแต่งเอกสาร — โครงข้อมูล layout v2 (เก็บใน correspondence_tickets.overlay_layout / แม่แบบ) */

/** หน้า A4 ที่ 96dpi — ทุกชิ้นวางเป็น % ของหน้า ขนาดตัวอักษรเป็น px ของหน้านี้ (จอ/PDF ตรงกัน) */
export const A4W = 794;
export const A4H = 1123;

export type ItemType =
  | 'text' | 'checkbox' | 'line' | 'rect' | 'image' | 'signature'
  | 'stampMain' | 'stampDept' | 'checklist';

export interface DocItem {
  id: string;
  type: ItemType;
  page: number;
  /** ตำแหน่ง/ขนาดเป็น % ของหน้า */
  x: number; y: number; w: number; h: number;
  z?: number;
  locked?: boolean;
  props: Record<string, any>;
}

/** พื้นหลังของหน้า: หน้าจากไฟล์แนบ (srcPage เริ่ม 0) หรือหน้าเปล่า */
export interface DocPage { src: 'attachment' | 'blank'; srcPage?: number }

export interface DocLayout { version: 2; pages: DocPage[]; items: DocItem[]; /** ไฟล์พื้นหลังที่ผู้ใช้อัปโหลดเอง (id ใน file_uploads) */ sourceFileId?: string | null }

/** ข้อมูลที่ชิ้นส่วนต้องใช้ตอนวาด (ไม่ hardcode ชื่อ อบต. — ดึงจากเรื่อง/องค์กร/ผู้ใช้) */
export interface DocContext {
  fields: Record<string, string>;
  orgName: string;
  ticket?: any;
  relatedDepts: { id: string; nameTh: string }[];
  /** กองทั้งหมดของ อบต. (ให้เลือกเพิ่มในรายการกองที่เกี่ยวข้อง) */
  allDepts?: { id: string; nameTh: string }[];
}

/** ช่องข้อมูลอัตโนมัติที่แทรกในข้อความได้ — {{key}} */
export const FIELD_DEFS: { key: string; label: string }[] = [
  { key: 'org.name', label: 'ชื่อหน่วยงาน (อบต.)' },
  { key: 'org.address', label: 'ที่อยู่หน่วยงาน' },
  { key: 'today', label: 'วันที่วันนี้' },
  { key: 'ticket.subject', label: 'เรื่อง' },
  { key: 'ticket.recipient', label: 'เรียน' },
  { key: 'ticket.externalDocNumber', label: 'เลขที่หนังสือ' },
  { key: 'ticket.receiveRegNumber', label: 'เลขทะเบียนรับ' },
  { key: 'ticket.sourceOrg', label: 'จาก (หน่วยงานต้นเรื่อง)' },
  { key: 'me.name', label: 'ชื่อผู้ใช้งาน' },
  { key: 'me.position', label: 'ตำแหน่งผู้ใช้งาน' },
];

export const resolveFields = (text: string, fields: Record<string, string>) =>
  String(text ?? '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => (k in fields ? fields[k] || '' : m));

/** ขนาดตัวอักษร: เก็บเป็น px ของหน้า แสดงผู้ใช้เป็น pt (มาตรฐานหนังสือราชการ 16pt) */
export const PT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48];
export const ptToPx = (pt: number) => Math.round((pt / 0.75) * 10) / 10;
export const pxToPt = (px: number) => Math.round(px * 0.75);

export const INK = [
  { value: '#000000', label: 'ดำ' },
  { value: '#1d4ed8', label: 'น้ำเงิน' },
  { value: '#b91c1c', label: 'แดง' },
  { value: '#4b5563', label: 'เทา' },
];

let seq = 0;
export const newId = (type: string) => `${type}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** ชิ้นใหม่พร้อมค่าเริ่มต้น — x/y เป็นมุมซ้ายบน (%) */
export function makeItem(kind: ItemType | 'heading', page: number, x: number, y: number, props: Record<string, any> = {}): DocItem {
  const base = { id: newId(kind), page, z: Date.now() % 1e9 };
  const at = (w: number, h: number) => ({ x: clamp(x, 0, 100 - w), y: clamp(y, 0, 100 - h), w, h });
  switch (kind) {
    case 'heading':
      return { ...base, type: 'text', ...at(60, 4.5), props: { text: 'หัวข้อ', size: ptToPx(24), bold: true, align: 'center', color: '#000000', ...props } };
    case 'text':
      return { ...base, type: 'text', ...at(45, 4), props: { text: 'พิมพ์ข้อความ', size: ptToPx(16), align: 'left', color: '#000000', ...props } };
    case 'checkbox':
      return { ...base, type: 'checkbox', ...at(28, 2.8), props: { label: 'ตัวเลือก', checked: true, size: ptToPx(16), color: '#000000', ...props } };
    case 'line':
      return { ...base, type: 'line', ...at(40, 1.2), props: { color: '#000000', thickness: 1.5, dashed: false, ...props } };
    case 'rect':
      return { ...base, type: 'rect', ...at(30, 10), props: { color: '#000000', thickness: 1.5, fill: '', ...props } };
    case 'image':
      return { ...base, type: 'image', ...at(25, 12), props };
    case 'signature':
      return { ...base, type: 'signature', ...at(26, 9), props };
    case 'stampMain':
      return { ...base, type: 'stampMain', ...at(28, 12), props };
    case 'stampDept':
      return { ...base, type: 'stampDept', ...at(22, 12), props };
    case 'checklist':
      return { ...base, type: 'checklist', ...at(18, 8), props };
  }
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * อ่าน layout ที่บันทึกไว้ — รองรับรูปแบบเดิม (ก่อน v2: { pages: number, items: [{ kind, sig, name, pos }] })
 * attachmentPages = จำนวนหน้าของไฟล์แนบที่เรนเดอร์ได้
 */
export function normalizeLayout(raw: any, attachmentPages: number): DocLayout | null {
  if (!raw || !Array.isArray(raw.items)) return null;
  if (raw.version === 2 && Array.isArray(raw.pages)) {
    return { version: 2, pages: raw.pages, items: raw.items, sourceFileId: raw.sourceFileId ?? null };
  }
  const total = Math.max(attachmentPages, Number(raw.pages) || 0, 1);
  const pages: DocPage[] = Array.from({ length: total }, (_, i) =>
    i < attachmentPages ? { src: 'attachment', srcPage: i } : { src: 'blank' });
  const items: DocItem[] = raw.items.map((it: any, i: number) => ({
    id: it.id, type: it.kind, page: it.page ?? 0, x: it.x, y: it.y, w: it.w, h: it.h, z: i,
    props: it.kind === 'signature'
      ? { name: it.name, pos: it.pos, timelineId: String(it.id || '').startsWith('sig-') ? String(it.id).slice(4) : undefined }
      : {},
  }));
  return { version: 2, pages, items };
}
