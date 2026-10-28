import { MODULES, type PermissionItem } from './modules';

export type { PermissionItem };

export interface PermissionModule {
  key: string;
  label: string;
  sidebarPermission: string;
  items: PermissionItem[];
}

/**
 * รายการสิทธิ์สำหรับหน้าตั้งค่าสิทธิ์รายคน — สร้างจากทะเบียนโมดูลกลาง (lib/modules.ts)
 * เพิ่มโมดูลใหม่ในไฟล์นั้นแล้วหน้านี้ขึ้นเองทันที ไม่ต้องมาแก้ที่นี่อีก
 */
export const PERMISSION_MODULES: PermissionModule[] = MODULES
  .filter((m) => m.permissionItems?.length)
  .map((m) => ({
    key: m.key,
    label: m.permissionLabel || m.label,
    // สิทธิ์ที่ใช้ควบคุมการเห็นเมนู — ไม่ได้ตั้งไว้ก็ใช้ตัวแรกของรายการ (เป็น :read: เสมอ)
    sidebarPermission: m.permission || m.permissionItems![0].grants[0],
    items: m.permissionItems!,
  }));

export interface Preset {
  label: string;
  color: string;
  items: string[];
}

export const PERMISSION_PRESETS: Record<string, Preset> = {
  mayor: {
    label: 'นายก อบต.',
    color: 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200',
    items: ['saraban_view', 'saraban_mayor', 'saraban_summary', 'signatures_use', 'documents_view', 'meetings_view', 'meetings_create', 'meetings_minutes', 'hr_view', 'hr_salary', 'leave_apply', 'projects_view', 'settings_view'],
  },
  clerk: {
    label: 'ปลัด อบต.',
    color: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200',
    items: ['saraban_view', 'saraban_create', 'saraban_clerk', 'saraban_summary', 'signatures_use', 'signatures_manage', 'documents_view', 'documents_upload', 'meetings_view', 'meetings_create', 'meetings_minutes', 'hr_view', 'hr_manage', 'leave_apply', 'leave_manage', 'projects_view', 'users_view', 'users_manage', 'audit_view', 'settings_view', 'settings_manage'],
  },
  deptHead: {
    label: 'หัวหน้ากอง',
    color: 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200',
    items: ['saraban_view', 'saraban_create', 'saraban_summary', 'signatures_use', 'documents_view', 'documents_upload', 'meetings_view', 'meetings_create', 'hr_view', 'leave_apply', 'projects_view', 'settings_view'],
  },
  officer: {
    label: 'เจ้าหน้าที่',
    color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border border-yellow-200',
    items: ['saraban_view', 'saraban_create', 'signatures_use', 'documents_view', 'documents_upload', 'meetings_view', 'leave_apply', 'projects_view', 'settings_view'],
  },
  readonly: {
    label: 'ดูอย่างเดียว',
    color: 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200',
    items: ['saraban_view', 'documents_view', 'meetings_view', 'hr_view', 'leave_apply', 'projects_view'],
  },
};

/** Get all unique grant strings for the given item keys */
export function getGrantsForItems(itemKeys: Set<string>): string[] {
  const grants = new Set<string>();
  for (const itemKey of itemKeys) {
    for (const mod of PERMISSION_MODULES) {
      const item = mod.items.find((i) => i.key === itemKey);
      if (item) item.grants.forEach((g) => grants.add(g));
    }
  }
  return [...grants];
}

/** Derive active item keys — item ถือว่าเปิดเมื่อผู้ใช้มี "ครบทุก" grant ของ item นั้น */
export function getActiveItemsFromPermissions(userPermKeys: Set<string>): Set<string> {
  const active = new Set<string>();
  for (const mod of PERMISSION_MODULES) {
    for (const item of mod.items) {
      if (item.grants.every((g) => userPermKeys.has(g))) active.add(item.key);
    }
  }
  return active;
}
