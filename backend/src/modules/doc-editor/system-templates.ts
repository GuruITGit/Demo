import { GARUDA_BW } from '../water/garuda-bw';

/**
 * แม่แบบมาตรฐานของระบบ (ทุก อบต. ใช้ได้) — layout v2 ตำแหน่งเป็น % ของหน้า A4 (794×1123 px)
 * ข้อมูล อบต./เรื่อง ใช้ช่องอัตโนมัติ {{...}} ห้าม hardcode ชื่อหน่วยงาน
 * ขอบหน้าตามระเบียบงานสารบรรณ: ซ้าย 3 ซม. (≈14.3%) ขวา 2 ซม. (≈9.5%)
 */
const px = (pt: number) => Math.round((pt / 0.75) * 10) / 10; // pt → px ของหน้า
const L = 14.3, R = 90.5; // ขอบซ้าย/ขวา (%)
const BLUE = '#1d4ed8';

let n = 0;
const T = (x: number, y: number, w: number, h: number, text: string, o: Record<string, any> = {}) =>
  ({ id: `t${++n}`, type: 'text', page: 0, x, y, w, h, z: n, props: { text, size: px(16), align: 'left', color: '#000000', ...o } });
const IMG = (x: number, y: number, w: number, h: number, src: string) => ({ id: `i${++n}`, type: 'image', page: 0, x, y, w, h, z: n, props: { src } });
const SIG = (x: number, y: number, w: number, h: number, name: string, pos: string, color?: string) =>
  ({ id: `s${++n}`, type: 'signature', page: 0, x, y, w, h, z: n, props: { name, pos, ...(color ? { color } : {}) } });

const BODY = '        ตามหนังสือ {{ticket.sourceOrg}} ที่ {{ticket.externalDocNumber}} เรื่อง {{ticket.subject}} ความละเอียดแจ้งแล้ว นั้น\n\n'
  + '        (พิมพ์ข้อความ)\n\n'
  + '        จึงเรียนมาเพื่อโปรดทราบและพิจารณา';

export interface SystemTemplate { key: string; name: string; category: 'overlay' | 'document'; layout: any }

export const SYSTEM_TEMPLATES: SystemTemplate[] = [
  {
    key: 'memo', name: 'บันทึกข้อความ', category: 'document',
    layout: {
      version: 2, pages: [{ src: 'blank' }],
      items: [
        IMG(L, 4, 7.2, 5.1, GARUDA_BW),
        T(30, 4.6, 40, 4.4, 'บันทึกข้อความ', { size: px(29), bold: true, align: 'center' }),
        T(L, 10.5, 14, 2.8, 'ส่วนราชการ', { size: px(20), bold: true }),
        T(L + 14, 10.7, R - L - 14, 2.6, '{{org.name}}'),
        T(L, 13.6, 4, 2.8, 'ที่', { size: px(20), bold: true }),
        T(L + 4, 13.8, 30, 2.6, '....................................'),
        T(50, 13.6, 8, 2.8, 'วันที่', { size: px(20), bold: true }),
        T(58, 13.8, R - 58, 2.6, '{{today}}'),
        T(L, 16.7, 7, 2.8, 'เรื่อง', { size: px(20), bold: true }),
        T(L + 7, 16.9, R - L - 7, 5, '{{ticket.subject}}'),
        T(L, 22.4, R - L, 2.6, 'เรียน  {{ticket.recipient}}'),
        T(L, 26, R - L, 36, BODY),
        SIG(50, 64, 40, 12, '(....................................................)', 'ตำแหน่ง ....................................................'),
      ],
    },
  },
  {
    key: 'external-letter', name: 'หนังสือภายนอก', category: 'document',
    layout: {
      version: 2, pages: [{ src: 'blank' }],
      items: [
        T(L, 11, 32, 2.6, 'ที่  ....................................'),
        IMG(43.5, 3.5, 13, 9.2, GARUDA_BW),
        T(58, 11, R - 58, 5.4, '{{org.name}}\n{{org.address}}'),
        T(45, 17, R - 45, 2.6, '{{today}}'),
        T(L, 20.5, R - L, 5, 'เรื่อง  {{ticket.subject}}'),
        T(L, 25.8, R - L, 2.6, 'เรียน  {{ticket.recipient}}'),
        T(L, 28.9, R - L, 2.6, 'อ้างถึง  ....................................'),
        T(L, 32, R - L, 2.6, 'สิ่งที่ส่งมาด้วย  ....................................'),
        T(L, 35.5, R - L, 29, BODY.replace('จึงเรียนมาเพื่อโปรดทราบและพิจารณา', 'จึงเรียนมาเพื่อโปรดทราบ')),
        T(45, 66, 40, 2.6, 'ขอแสดงความนับถือ', { align: 'center' }),
        SIG(45, 70, 40, 12, '(....................................................)', 'ตำแหน่ง ....................................................'),
        T(L, 87, 45, 5.8, '{{org.name}}\nโทร. ....................................'),
      ],
    },
  },
  {
    key: 'kasian', name: 'เกษียนหนังสือ (เสนอผู้บังคับบัญชา)', category: 'overlay',
    layout: {
      version: 2, pages: [{ src: 'attachment', srcPage: 0 }],
      items: [
        T(54, 74, 38, 8.5, 'เรียน  นายก อบต.\n  - เพื่อโปรดทราบ\n  - เห็นควร ....................................', { color: BLUE }),
        SIG(58, 82.5, 30, 8, '({{me.name}})', '{{me.position}}'),
        T(58, 90.6, 30, 2.4, '{{today}}', { align: 'center', color: BLUE, size: px(14) }),
      ],
    },
  },
  {
    key: 'receive-stamp', name: 'ตรารับหนังสือ + กองที่เกี่ยวข้อง', category: 'overlay',
    layout: {
      version: 2, pages: [{ src: 'attachment', srcPage: 0 }],
      items: [
        { id: 'stampMain', type: 'stampMain', page: 0, x: 68, y: 2, w: 28, h: 12, z: 1, props: {} },
        { id: 'checklist', type: 'checklist', page: 0, x: 68, y: 15, w: 22, h: 6, z: 2, props: {} },
      ],
    },
  },
];
