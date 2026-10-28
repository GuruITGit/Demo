import type { CSSProperties } from 'react';
import { A4H, A4W, type DocContext, type DocItem, resolveFields } from './types';

/**
 * ตัววาดชิ้นส่วนเอกสาร — ใช้ inline style เท่านั้น (ห้ามใช้ class ของ Tailwind)
 * เพราะ HTML ชุดเดียวกันถูกคัดลอกไปเรนเดอร์ PDF ฝั่งเซิร์ฟเวอร์ที่ไม่มี CSS ของเว็บ
 */
export const DOC_FONT = "'TH SarabunNew', 'TH Sarabun New', sans-serif";
const OFFICIAL_BLUE = '#1d4ed8';

const boxH = (it: DocItem) => (it.h / 100) * A4H;
const boxW = (it: DocItem) => (it.w / 100) * A4W;

export function textStyle(p: Record<string, any>): CSSProperties {
  return {
    width: '100%', height: '100%', margin: 0,
    fontFamily: DOC_FONT, fontSize: p.size || 21, lineHeight: p.lineHeight || 1.25,
    fontWeight: p.bold ? 700 : 400, fontStyle: p.italic ? 'italic' : 'normal',
    textDecoration: p.underline ? 'underline' : 'none',
    textAlign: p.align || 'left', color: p.color || '#000',
    whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflow: 'hidden',
  };
}

const dateTh = (v: any) => new Date(v).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
const timeTh = (v: any) => new Date(v).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

export function ItemContent({ it, ctx }: { it: DocItem; ctx: DocContext }) {
  const p = it.props || {};
  switch (it.type) {
    case 'text':
      return <div style={textStyle(p)}>{resolveFields(p.text, ctx.fields)}</div>;

    case 'checkbox': {
      const size = p.size || 21;
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.3, height: '100%', fontFamily: DOC_FONT, fontSize: size, color: p.color || '#000', lineHeight: 1 }}>
          <span style={{ width: size * 0.8, height: size * 0.8, border: `1.5px solid ${p.color || '#000'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: size * 0.75 }}>
            {p.checked ? '✓' : ''}
          </span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{resolveFields(p.label, ctx.fields)}</span>
        </div>
      );
    }

    case 'line':
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%', borderTop: `${p.thickness || 1.5}px ${p.dashed ? 'dashed' : 'solid'} ${p.color || '#000'}` }} />
        </div>
      );

    case 'rect':
      return (
        <div style={{ width: '100%', height: '100%', border: `${p.thickness || 1.5}px ${p.dashed ? 'dashed' : 'solid'} ${p.color || '#000'}`, background: p.fill || 'transparent' }} />
      );

    case 'image':
      return p.src
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={p.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
        : <div style={{ width: '100%', height: '100%', border: '1px dashed #9ca3af' }} />;

    case 'signature': {
      const h = boxH(it);
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: DOC_FONT }}>
          {p.sig
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={p.sig} alt="" draggable={false} style={{ maxHeight: '64%', maxWidth: '100%', objectFit: 'contain' }} />
            : <div style={{ height: '64%' }} />}
          {p.name && <div style={{ fontSize: Math.max(10, h * 0.17), lineHeight: 1.1, color: '#111', textAlign: 'center' }}>{resolveFields(p.name, ctx.fields)}</div>}
          {p.pos && <div style={{ fontSize: Math.max(9, h * 0.15), lineHeight: 1.1, color: '#444', textAlign: 'center' }}>{resolveFields(p.pos, ctx.fields)}</div>}
        </div>
      );
    }

    case 'checklist': {
      const rows = checklistRows(it, ctx);
      const n = rows.length || 1;
      const f = Math.max(10, Math.min((boxH(it) / n) * 0.8, boxW(it) / 7));
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', color: OFFICIAL_BLUE, fontFamily: DOC_FONT }}>
          {rows.map((d, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: f * 0.3, fontSize: f, lineHeight: 1.15 }}>
              <span style={{ border: `1px solid ${OFFICIAL_BLUE}`, width: '0.85em', height: '0.85em', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, lineHeight: 1 }}>{d.checked ? '✓' : ''}</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>{d.name}</span>
            </div>
          ))}
        </div>
      );
    }

    case 'stampMain':
    case 'stampDept': {
      const v = stampValues(it, ctx);
      const f = Math.max(10, boxH(it) * 0.16);
      return (
        <div style={{ width: '100%', height: '100%', border: `1.5px solid ${OFFICIAL_BLUE}`, color: OFFICIAL_BLUE, fontFamily: DOC_FONT, fontSize: f, lineHeight: 1.25, padding: '2px 6px', display: 'flex', flexDirection: 'column', justifyContent: 'center', overflow: 'hidden' }}>
          <div style={{ fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden' }}>{v.title}</div>
          <div>เลขรับที่ {v.regNo || '________'}</div>
          <div>วันที่ {v.date || '________'}</div>
          <div>เวลา {v.time || '____'} น.</div>
        </div>
      );
    }
  }
  return null;
}

/** ค่าของตราเลขรับ — ค่าที่ผู้ใช้แก้ (props) ก่อน ไม่แก้ใช้ข้อมูลจากเรื่อง */
export function stampValues(it: DocItem, ctx: DocContext) {
  const p = it.props || {};
  const t = ctx.ticket || {};
  const main = it.type === 'stampMain';
  const when = main ? (t.receivedRecordAt || t.receivedDate) : t.deptRegAt;
  return {
    title: p.title ?? (main ? ctx.orgName : (t.relatedDept?.nameTh || t.ownerDept?.nameTh || 'กอง')),
    regNo: p.regNo ?? ((main ? t.receiveRegNumber : t.deptRegNumber) || ''),
    date: p.date ?? (when ? dateTh(when) : ''),
    time: p.time ?? (when ? timeTh(when) : ''),
  };
}

/** รายการกองที่เกี่ยวข้อง — ที่ผู้ใช้แก้ (props.depts) ก่อน ไม่แก้ใช้กองของเรื่อง */
export function checklistRows(it: DocItem, ctx: DocContext): { name: string; checked: boolean }[] {
  if (Array.isArray(it.props?.depts)) return it.props.depts;
  return ctx.relatedDepts.length ? ctx.relatedDepts.map((d) => ({ name: d.nameTh, checked: true })) : [{ name: 'กองที่เกี่ยวข้อง', checked: true }];
}

/** ชื่อชนิดชิ้น (ภาษาไทย) — ใช้ในแผงคุณสมบัติ */
export const TYPE_LABEL: Record<string, string> = {
  text: 'ข้อความ', checkbox: 'ช่องติ๊ก', line: 'เส้น', rect: 'กรอบ', image: 'รูปภาพ', signature: 'ลายเซ็น',
  stampMain: 'ตราเลขรับหลัก', stampDept: 'ตราเลขรับกอง', checklist: 'กองที่เกี่ยวข้อง',
};
