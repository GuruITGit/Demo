/**
 * ทะเบียนโมดูลที่ "เปิด-ปิดรายหน่วยงานได้" (feature flags ต่อ อบต.)
 * — แหล่งความจริงเดียวสำหรับทั้ง interceptor (บล็อก API) และหน้า HUB (โชว์ปุ่มเปิด-ปิด)
 *
 * เก็บสถานะที่ organizations.metadata.disabledModules = string[] (คีย์ที่ "ปิด")
 * ค่าเริ่มต้น = ไม่มีในลิสต์ = เปิด → โมดูลใหม่ที่เพิ่มทีหลังเปิดอัตโนมัติ ไม่ต้องแก้ทุก อบต.
 *
 * โมดูลระบบ (auth/health/storage/notifications/dashboard/users/audit/organizations/settings)
 * ไม่อยู่ในนี้ = เปิดตลอด ปิดไม่ได้ (จำเป็นต่อการเข้าใช้ระบบ)
 */
export interface ModuleDef {
  key: string;
  label: string;
  group: string;
  /** prefix ของ path (หลังตัด /v1) ที่เป็นของโมดูลนี้ — ใช้แมป request → โมดูล */
  prefixes: string[];
}

export const TOGGLEABLE_MODULES: ModuleDef[] = [
  { key: 'correspondence', label: 'สารบรรณ', group: 'งานสำนักงาน', prefixes: ['correspondence'] },
  { key: 'citizen-reports', label: 'เรื่องแจ้ง/ร้องเรียน (เจ้าหน้าที่)', group: 'งานสำนักงาน', prefixes: ['citizen-reports'] },
  { key: 'news', label: 'ข่าว/ประกาศ', group: 'งานสำนักงาน', prefixes: ['news'] },
  { key: 'documents', label: 'คลังเอกสาร', group: 'งานสำนักงาน', prefixes: ['documents'] },
  { key: 'meetings', label: 'การประชุม', group: 'งานสำนักงาน', prefixes: ['meetings'] },
  { key: 'signatures', label: 'จัดการลายเซ็น', group: 'งานสำนักงาน', prefixes: ['signatures'] },
  { key: 'projects', label: 'โครงการ', group: 'โครงการ', prefixes: ['projects'] },
  { key: 'hr', label: 'บุคลากร', group: 'บุคลากร', prefixes: ['hr'] },
  { key: 'leave', label: 'การลา', group: 'บุคลากร', prefixes: ['leave'] },
  {
    key: 'prapa', label: 'ระบบประปา (เจ้าหน้าที่)', group: 'บริการประชาชน',
    prefixes: ['water/auth', 'water/billing', 'water/master', 'water/report', 'water/users', 'water'],
  },
  {
    key: 'citizen', label: 'เว็บบริการประชาชน', group: 'บริการประชาชน',
    prefixes: ['citizen/report', 'citizen/news', 'water/member'],
  },
];

const MODULE_KEYS = new Set(TOGGLEABLE_MODULES.map((m) => m.key));
export const isToggleableKey = (k: string) => MODULE_KEYS.has(k);

/**
 * หาโมดูลของ request จาก path — คืน key หรือ null (ไม่ใช่โมดูลที่ปิดได้ = ปล่อยผ่าน)
 * ใช้ longest-prefix match: `water/member/...` → citizen (ไม่ใช่ prapa) เพราะ prefix ยาวกว่า
 */
export function resolveModuleFromPath(rawPath: string): string | null {
  let p = (rawPath || '').split('?')[0].replace(/^\/+/, '');
  if (p.startsWith('v1/')) p = p.slice(3);
  else if (p === 'v1') return null;
  let best: { key: string; len: number } | null = null;
  for (const m of TOGGLEABLE_MODULES) {
    for (const pre of m.prefixes) {
      if (p === pre || p.startsWith(pre + '/')) {
        if (!best || pre.length > best.len) best = { key: m.key, len: pre.length };
      }
    }
  }
  return best?.key ?? null;
}
