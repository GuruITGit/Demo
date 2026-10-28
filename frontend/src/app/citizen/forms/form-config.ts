/**
 * เอนจินฟอร์ม e-service (อิง khokchan.go.th) — แต่ละบริการ = 1 config
 * ทุกฟอร์มมี: ข้อมูลผู้ยื่น (PERSONAL) + ฟิลด์เฉพาะเรื่อง + แนบไฟล์ + แผนที่ GPS + ยินยอม PDPA (เอนจินเติมให้อัตโนมัติ)
 * เพิ่มฟอร์มใหม่ = เพิ่ม config ที่นี่ (ไม่ต้องเขียนหน้าใหม่)
 */
import { GEN_FORMS } from './forms-generated';

export type FieldType =
  | 'text' | 'textarea' | 'tel' | 'email' | 'number' | 'date'
  | 'datetime' | 'time' | 'select' | 'radio' | 'checkbox' | 'file' | 'info';

export type Field = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  help?: string;
  placeholder?: string;
  full?: boolean; // กินเต็มแถว (2 คอลัมน์)
};

export type Section = { title?: string; help?: string; fields: Field[] };

export type FormDef = {
  key: string;
  title: string;
  group: string;
  sections: Section[];
  needMap?: boolean; // ปักหมุด GPS (default true)
};

/** ข้อมูลผู้ยื่น — ใช้ซ้ำทุกฟอร์ม */
const PERSONAL: Section = {
  title: 'ข้อมูลผู้ยื่นคำร้อง',
  fields: [
    { name: 'prefix', label: 'คำนำหน้าชื่อ', type: 'radio', options: ['นาย', 'นาง', 'นางสาว'], required: true },
    { name: 'fullName', label: 'ชื่อ-นามสกุล', type: 'text', required: true },
    { name: 'address', label: 'ที่อยู่', type: 'textarea', required: true, full: true },
    { name: 'phone', label: 'เบอร์โทรศัพท์', type: 'tel', required: true, placeholder: 'กรอกเบอร์มือถือ' },
    { name: 'contact', label: 'อีเมล / LineID', type: 'text' },
  ],
};

/** แม่แบบ "ฟอร์มแจ้งเหตุ/ซ่อม" — ผู้ยื่น + บริเวณที่พบปัญหา + รายละเอียด + แนบรูป */
function reportForm(key: string, title: string, opts: { group?: string; problemLabel?: string; extra?: Field[] } = {}): FormDef {
  return {
    key, title, group: opts.group || 'แจ้งเหตุ / ร้องเรียน', needMap: true,
    sections: [
      PERSONAL,
      {
        title: 'รายละเอียดเรื่องที่แจ้ง',
        fields: [
          { name: 'problem', label: opts.problemLabel || 'บริเวณที่พบปัญหา / จุดเกิดเหตุ', type: 'text', required: true, full: true },
          { name: 'detail', label: 'รายละเอียดเพิ่มเติม', type: 'textarea', required: true, full: true, placeholder: 'อธิบายปัญหาให้ชัดเจน' },
          ...(opts.extra || []),
          { name: 'photo', label: 'แนบรูปถ่าย', type: 'file', help: 'รูปหน้างาน (ถ้ามี)' },
        ],
      },
    ],
  };
}

const REPORT_FORMS: FormDef[] = [
  reportForm('light', 'แจ้งไฟส่องสว่างสาธารณะชำรุด (ไฟกิ่ง)', { problemLabel: 'จุดที่ไฟดับ/ชำรุด' }),
  reportForm('water-fault', 'แจ้งเหตุประปาขัดข้อง', { problemLabel: 'จุดที่ประปาขัดข้อง' }),
  reportForm('fire', 'แจ้งไฟไหม้ / ไฟป่า', { problemLabel: 'จุดเกิดเหตุ' }),
  reportForm('tree', 'คำร้องขอตัดต้นไม้ / กิ่งไม้', { group: 'คำร้อง / ขอรับบริการ', problemLabel: 'จุดที่ขอตัด' }),
  reportForm('road', 'แจ้งซ่อมถนน / ไหล่ทางชำรุด', { problemLabel: 'จุดที่ถนนชำรุด' }),
  reportForm('drain', 'แจ้งท่อ / รางระบายน้ำ ชำรุด-อุดตัน', { problemLabel: 'จุดที่ท่อ/รางชำรุด' }),
  reportForm('grass', 'แจ้งตัดหญ้าที่สาธารณะ', { problemLabel: 'จุดที่ขอตัดหญ้า' }),
  reportForm('garbage-left', 'แจ้งจัดเก็บขยะมูลฝอย (ตกค้าง)', { problemLabel: 'จุดที่ขยะตกค้าง' }),
  reportForm('leaves-left', 'แจ้งจัดเก็บกิ่งไม้ใบไม้ (ตกค้าง)', { problemLabel: 'จุดที่กิ่งไม้ใบไม้ตกค้าง' }),
  reportForm('speaker', 'แจ้งซ่อมเสียงประกาศตามสาย', { problemLabel: 'จุดที่เสียงตามสายเสีย' }),
  reportForm('animal', 'แจ้งเรื่องสัตว์เลี้ยง / สัตว์จรจัด', {
    problemLabel: 'จุดที่พบสัตว์',
    extra: [{ name: 'animalType', label: 'ชนิดสัตว์', type: 'text', placeholder: 'เช่น สุนัข แมว งู' }],
  }),
  reportForm('bridge', 'แจ้งซ่อมสะพาน', { problemLabel: 'จุดที่สะพานชำรุด' }),
  reportForm('nuisance', 'แจ้งเหตุเดือดร้อนรำคาญ', { problemLabel: 'จุดเกิดเหตุ' }),
  reportForm('billboard', 'แจ้งเบาะแสป้ายโฆษณา (ผิดกฎหมาย)', { problemLabel: 'จุดที่พบป้าย' }),
  reportForm('complaint', 'ร้องเรียน / ร้องทุกข์', {
    problemLabel: 'เรื่องที่ร้องเรียน',
    extra: [{ name: 'subject', label: 'หัวข้อเรื่อง', type: 'text', full: true }],
  }),
  reportForm('corruption', 'ร้องเรียนการทุจริตและประพฤติมิชอบ', {
    problemLabel: 'เรื่อง/หน่วยงานที่ร้องเรียน',
    extra: [{ name: 'accused', label: 'ผู้ถูกร้องเรียน (ถ้าทราบ)', type: 'text', full: true }],
  }),
];

/**
 * ปรับแต่งฟอร์มที่สร้างอัตโนมัติ (forms-generated.ts) โดยไม่แก้ไฟล์ gen — ไม่โดนเขียนทับตอน regenerate
 * และไม่กระทบฟอร์มอื่นที่ยังต้องใช้ช่องเดียวกัน (เช่นเบี้ยยังชีพยังต้องมีเลขบัตร)
 */
const dropFields = (def: FormDef, names: string[]): FormDef => ({
  ...def,
  sections: def.sections.map((s) => ({ ...s, fields: s.fields.filter((f) => !names.includes(f.name)) })),
});

const OVERRIDES: Record<string, (def: FormDef) => FormDef> = {
  // ร้องเรียน/ร้องทุกข์: ไม่เก็บเลขบัตร ไม่บังคับเลือกหัวข้อ — ให้ลูกบ้านเล่าเรื่องเอง
  k32: (def) => {
    const d = dropFields(def, ['เลขที่บัตรประชาชน', 'ข้อร้องเรียน']);
    return {
      ...d,
      sections: d.sections.map((s) => ({
        ...s,
        fields: s.fields.map((f) => (f.name === 'รายละเอียดเรื่องร้องเรียน/ร้องทุกข์'
          // key "detail" = ข้อความสรุปบนการ์ดฝั่ง admin (citizen-report.service createSubmission)
          ? { ...f, name: 'detail', required: true, placeholder: 'เล่าเรื่องที่ต้องการร้องเรียน หรือกดไมค์แล้วพูดได้' }
          : f)),
      })),
    };
  },
};

const GEN: FormDef[] = GEN_FORMS.map((f) => OVERRIDES[f.key]?.(f) ?? f);

// ฟอร์มจริงทั้ง 67 (auto-gen จาก khokchan) + แม่แบบเขียนมือเดิม (คีย์ไม่ชนกัน)
export const FORMS: Record<string, FormDef> = Object.fromEntries(
  [...GEN, ...REPORT_FORMS].map((f) => [f.key, f]),
);

/** รายการฟอร์มจริงทั้งหมด จัดกลุ่มตามหมวด (ใช้สร้างหน้า hub) */
export const ALL_FORMS: FormDef[] = GEN;

export const getForm = (key: string): FormDef | undefined => FORMS[key];
