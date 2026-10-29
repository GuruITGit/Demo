/** เส้นทางพื้นฐาน: เข้าสู่ระบบ องค์กร กอง ผู้ใช้ บทบาท สิทธิ์ ตั้งค่า แจ้งเตือน ไฟล์ ประวัติกิจกรรม */
import {
  get, post, put, patch, del, paginate, textMatch, byId, removeById, uid, nowIso, tokenFor, userView, publicRow, fileView, readAsDataUrl,
  badRequest, notFound, forbidden, HttpError, Raw, type Ctx, type Row,
} from '../core';
import { ORG_ID, PERMISSIONS } from '../seed-base';

// ───────────── ตัวช่วยผู้ใช้/สิทธิ์ ─────────────
export function rolesOf(db: Ctx['db'], userId: string): Row[] {
  return db.userRoles.filter((r) => r.userId === userId).map((r) => db.roles.find((x) => x.id === r.roleId)).filter(Boolean) as Row[];
}
export function permissionsOf(db: Ctx['db'], userId: string): string[] {
  const roleIds = db.userRoles.filter((r) => r.userId === userId).map((r) => r.roleId);
  const ids = new Set<string>([
    ...db.rolePermissions.filter((rp) => roleIds.includes(rp.roleId)).map((rp) => rp.permissionId),
    ...db.userPermissions.filter((up) => up.userId === userId).map((up) => up.permissionId),
  ]);
  return db.permissions.filter((p) => ids.has(p.id)).map((p) => `${p.module}:${p.action}:${p.subject}`);
}
export function authUser(db: Ctx['db'], u: Row): Row {
  return { ...userView(u), roles: rolesOf(db, u.id).map((r) => r.name), permissions: permissionsOf(db, u.id) };
}
export const isAdmin = (db: Ctx['db'], u: Row | null) => !!u && rolesOf(db, u.id).some((r) => r.name === 'ADMIN' || r.name === 'SUPER_ADMIN');
export const hasPerm = (db: Ctx['db'], u: Row | null, perm: string) => !!u && (isAdmin(db, u) || permissionsOf(db, u.id).includes(perm));
export function needAdmin(c: Ctx) { if (!isAdmin(c.db, c.user)) throw forbidden(); }
export function needPerm(c: Ctx, perm: string) { if (!hasPerm(c.db, c.user, perm)) throw forbidden(); }

/** บันทึกแจ้งเตือนให้ผู้ใช้ (ใช้จากโมดูลอื่น เช่นสารบรรณส่งต่อ) */
export function notify(db: Ctx['db'], userIds: (string | null | undefined)[], n: { type: string; title: string; body?: string; actionUrl?: string }) {
  for (const id of new Set(userIds.filter(Boolean) as string[])) {
    db.notifications.unshift({ id: uid(), userId: id, isRead: false, createdAt: nowIso(), ...n });
  }
}

// ───────────── เข้าสู่ระบบ ─────────────
function doLogin(c: Ctx, superOnly = false) {
  const { username, password } = c.body ?? {};
  const u = c.db.users.find((x) => x.username === String(username ?? '').trim());
  if (!u || u.password !== password) throw new HttpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (เดโม่: รหัสผ่านคือ demo1234)');
  if (!u.isActive) throw new HttpError(401, 'บัญชีนี้ถูกระงับ');
  if (superOnly) throw new HttpError(403, 'คอนโซลเจ้าของระบบไม่เปิดในเดโม่นี้');
  u.lastLoginAt = nowIso();
  c.db.loginHistory.unshift({ id: uid(), userId: u.id, ipAddress: '127.0.0.1', userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '', actedAt: nowIso() });
  return { user: authUser(c.db, u), accessToken: tokenFor(u.id), refreshToken: tokenFor(u.id), expiresIn: 900 };
}
post('/auth/login', (c) => doLogin(c));
post('/auth/hub-login', (c) => doLogin(c, true));
post('/auth/refresh', (c) => {
  const t = String(c.body?.refreshToken ?? '');
  if (!t.startsWith('demo.')) throw new HttpError(401, 'หมดอายุ');
  return { accessToken: t, refreshToken: t };
});
post('/auth/logout', () => ({ ok: true }));
get('/auth/me', (c) => authUser(c.db, c.user!));
patch('/auth/me', (c) => {
  const u = c.user!;
  for (const k of ['fullNameTh', 'fullNameEn', 'titleTh', 'phone', 'avatarUrl', 'signatureImage']) if (k in (c.body ?? {})) u[k] = c.body[k];
  return authUser(c.db, u);
});
put('/auth/me/password', (c) => {
  const { currentPassword, newPassword } = c.body ?? {};
  if (c.user!.password !== currentPassword) throw badRequest('รหัสผ่านปัจจุบันไม่ถูกต้อง');
  if (!newPassword || String(newPassword).length < 6) throw badRequest('รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร');
  c.user!.password = newPassword;
  return { ok: true };
});
get('/auth/me/login-history', (c) => c.db.loginHistory.filter((h) => h.userId === c.user!.id).slice(0, 15));
get('/auth/me/activity', (c) => c.db.audit.filter((a) => a.userId === c.user!.id).slice(0, 30));

// ───────────── องค์กร / กอง ─────────────
get('/organizations/by-host', (c) => {
  const o = c.db.organizations[0];
  return { found: true, id: o.id, nameTh: o.nameTh, logoUrl: o.logoUrl, phone: o.phone };
});
get('/organizations/current/modules', (c) => ({ disabledModules: c.db.organizations[0].metadata?.disabledModules ?? [] }));
get('/organizations/:id', (c) => c.db.organizations[0]);
patch('/organizations/:id', (c) => {
  needAdmin(c);
  Object.assign(c.db.organizations[0], c.body ?? {});
  return c.db.organizations[0];
});
put('/organizations/:id', (c) => { needAdmin(c); Object.assign(c.db.organizations[0], c.body ?? {}); return c.db.organizations[0]; });

get('/organizations/:id/departments', (c) => {
  const all = c.query.includeHidden === '1' || c.query.includeHidden === 'true';
  return c.db.departments
    .filter((d) => d.isActive !== false && (all || !d.hiddenFromForms))
    .sort((a, b) => a.orderNo - b.orderNo)
    .map((d) => ({ ...d, headUser: d.headUserId ? c.db.users.find((u) => u.id === d.headUserId) && { id: d.headUserId } : null }));
});
post('/organizations/:id/departments', (c) => {
  needAdmin(c);
  const name = String(c.body?.nameTh ?? '').trim();
  if (!name) throw badRequest('กรุณากรอกชื่อกอง');
  const d = { id: uid(), organizationId: ORG_ID, code: c.body.code ?? `D${Date.now()}`, nameTh: name, groupLabel: 'ส่วนราชการ', deptType: 'ADMIN',
    orderNo: c.db.departments.length + 1, isActive: true, hiddenFromForms: false, hiddenFromDirectory: false, docPrefix: '', headUserId: null };
  c.db.departments.push(d);
  return d;
});
put('/organizations/departments/:id', (c) => { needAdmin(c); return Object.assign(byId(c.db.departments, c.params.id), c.body ?? {}); });
del('/organizations/departments/:id', (c) => {
  needAdmin(c);
  const used = c.db.users.some((u) => u.departmentId === c.params.id) || c.db.tickets?.some((t: Row) => t.ownerDeptId === c.params.id);
  if (used) throw badRequest('กองนี้ยังมีผู้ใช้หรือสารบรรณอยู่ ลบไม่ได้ (ซ่อนจากแบบฟอร์มแทนได้)');
  removeById(c.db.departments, c.params.id);
  return { ok: true };
});

// ───────────── ผู้ใช้ ─────────────
function userRow(c: Ctx, u: Row): Row {
  const roles = rolesOf(c.db, u.id);
  return { ...userView(u), roles: roles.map((r) => ({ roleId: r.id, role: { name: r.name, nameTh: r.nameTh } })), roleNames: roles.map((r) => r.name) };
}
get('/users/roles/list', (c) => c.db.roles.map((r) => ({ id: r.id, name: r.name, nameTh: r.nameTh, level: r.level, isSystem: r.isSystem, description: r.description })));
post('/users/roles', (c) => {
  needAdmin(c);
  const nameTh = String(c.body?.nameTh ?? '').trim();
  if (!nameTh) throw badRequest('กรุณากรอกชื่อบทบาท');
  const r = { id: uid(), name: `CUSTOM_${Date.now()}`, nameTh, level: c.body.level ?? 20, isSystem: false, description: c.body.description ?? '' };
  c.db.roles.push(r);
  return r;
});
put('/users/roles/:roleId', (c) => { needAdmin(c); return Object.assign(byId(c.db.roles, c.params.roleId), c.body ?? {}); });
del('/users/roles/:roleId', (c) => {
  needAdmin(c);
  const r = byId(c.db.roles, c.params.roleId);
  if (r.isSystem) throw badRequest('ลบบทบาทของระบบไม่ได้');
  if (c.db.userRoles.some((x) => x.roleId === r.id)) throw badRequest('ยังมีผู้ใช้อยู่ในบทบาทนี้ ลบไม่ได้');
  removeById(c.db.roles, r.id);
  c.db.rolePermissions = c.db.rolePermissions.filter((x) => x.roleId !== r.id);
  return { ok: true };
});
get('/users/roles/:roleId/permissions', (c) => c.db.rolePermissions.filter((x) => x.roleId === c.params.roleId).map((x) => x.permissionId));
put('/users/roles/:roleId/permissions', (c) => {
  needAdmin(c);
  const ids: string[] = c.body?.permissionIds ?? [];
  c.db.rolePermissions = c.db.rolePermissions.filter((x) => x.roleId !== c.params.roleId).concat(ids.map((p) => ({ id: uid(), roleId: c.params.roleId, permissionId: p })));
  return { ok: true };
});
get('/users/permissions/list', () => PERMISSIONS.map(({ id, module, action, subject }) => ({ id, module, action, subject })));

type Group = { group: string; departments: Row[] };
export function orgTree(c: Ctx, full: boolean): Group[] {
  const brief = (u: Row) => full
    ? { id: u.id, fullNameTh: u.fullNameTh, titleTh: u.titleTh, positionName: u.positionName, phone: u.phone, email: u.email, avatarUrl: u.avatarUrl, username: u.username, departmentId: u.departmentId }
    : { id: u.id, fullNameTh: u.fullNameTh, titleTh: u.titleTh, positionName: u.positionName, avatarUrl: u.avatarUrl };
  const groups = new Map<string, Row[]>();
  for (const d of c.db.departments.filter((x) => x.isActive !== false && !x.hiddenFromDirectory).sort((a, b) => a.orderNo - b.orderNo)) {
    const users = c.db.users.filter((u) => u.departmentId === d.id && u.isActive);
    const divisions = c.db.divisions.filter((v) => v.departmentId === d.id)
      .map((v) => ({ id: v.id, nameTh: v.nameTh, users: users.filter((u) => u.divisionId === v.id).map(brief) }))
      .filter((v) => v.users.length);
    const loose = users.filter((u) => !u.divisionId || !divisions.some((v) => v.id === u.divisionId)).map(brief);
    const list = groups.get(d.groupLabel) ?? [];
    list.push({ id: d.id, code: d.code, deptType: d.deptType, nameTh: d.nameTh, headUserId: d.headUserId, users: loose, divisions });
    groups.set(d.groupLabel, list);
  }
  return [...groups.entries()].map(([group, departments]) => ({ group, departments }));
}
get('/users/tree', (c) => orgTree(c, false));
get('/users/selectable', (c) => c.db.users.filter((u) => u.isActive).map((u) => ({
  id: u.id, fullNameTh: u.fullNameTh, titleTh: u.titleTh, positionName: u.positionName, departmentId: u.departmentId,
  department: { id: u.departmentId, nameTh: c.db.departments.find((d) => d.id === u.departmentId)?.nameTh },
})));

get('/users', (c) => {
  needAdmin(c);
  const { search, deptId, roleId, status } = c.query;
  const rows = c.db.users.filter((u) => {
    if (deptId && u.departmentId !== deptId) return false;
    if (roleId && !c.db.userRoles.some((r) => r.userId === u.id && r.roleId === roleId)) return false;
    if (status === 'active' && !u.isActive) return false;
    if (status === 'suspended' && u.isActive) return false;
    if (status === 'locked' && !(u.lockedUntil && new Date(u.lockedUntil) > new Date())) return false;
    return textMatch(u, ['fullNameTh', 'username', 'email', 'positionName'], search);
  }).map((u) => userRow(c, u));
  return paginate(rows, c.query, 15);
});
post('/users', (c) => {
  needAdmin(c);
  const b = c.body ?? {};
  if (!b.username || !b.fullNameTh) throw badRequest('กรุณากรอกชื่อผู้ใช้และชื่อ-สกุล');
  if (c.db.users.some((u) => u.username === b.username)) throw new HttpError(409, 'ชื่อผู้ใช้นี้มีอยู่แล้ว');
  const u = {
    id: uid(), organizationId: ORG_ID, username: b.username, email: b.email || `${b.username}@example-abt.go.th`, password: b.password || 'demo1234',
    fullNameTh: b.fullNameTh, titleTh: b.titleTh ?? '', positionName: b.positionName ?? '', departmentId: b.departmentId || null, divisionId: null,
    phone: b.phone ?? '', avatarUrl: null, isActive: true, isVerified: true, createdAt: nowIso(),
  };
  c.db.users.push(u);
  c.db.userRoles.push({ id: uid(), userId: u.id, roleId: 'role-EMPLOYEE' });
  return userView(u);
});
get('/users/:id', (c) => userRow(c, byId(c.db.users, c.params.id)));
put('/users/:id', (c) => {
  needAdmin(c);
  const u = byId(c.db.users, c.params.id);
  for (const k of ['titleTh', 'fullNameTh', 'phone', 'positionName', 'departmentId', 'isActive', 'email']) if (k in (c.body ?? {})) u[k] = c.body[k];
  return userView(u);
});
del('/users/:id', (c) => {
  needAdmin(c);
  if (c.params.id === c.user!.id) throw badRequest('ลบบัญชีที่กำลังใช้งานอยู่ไม่ได้');
  removeById(c.db.users, c.params.id);
  c.db.userRoles = c.db.userRoles.filter((r) => r.userId !== c.params.id);
  c.db.userPermissions = c.db.userPermissions.filter((r) => r.userId !== c.params.id);
  return { ok: true };
});
get('/users/:id/roles', (c) => c.db.userRoles.filter((r) => r.userId === c.params.id).map((r) => {
  const role = c.db.roles.find((x) => x.id === r.roleId)!;
  return { roleId: r.roleId, role: { name: role.name, nameTh: role.nameTh } };
}));
put('/users/:id/role', (c) => {
  needAdmin(c);
  byId(c.db.roles, c.body?.roleId);
  c.db.userRoles = c.db.userRoles.filter((r) => r.userId !== c.params.id).concat({ id: uid(), userId: c.params.id, roleId: c.body.roleId });
  return { ok: true };
});
get('/users/:id/effective-permissions', (c) => {
  const roleIds = c.db.userRoles.filter((r) => r.userId === c.params.id).map((r) => r.roleId);
  const pick = (ids: Set<string>) => c.db.permissions.filter((p) => ids.has(p.id)).map(({ id, module, action, subject }) => ({ id, module, action, subject }));
  const roleSet = new Set(c.db.rolePermissions.filter((x) => roleIds.includes(x.roleId)).map((x) => x.permissionId));
  const overSet = new Set(c.db.userPermissions.filter((x) => x.userId === c.params.id).map((x) => x.permissionId));
  return {
    source: 'role', roles: roleIds.map((id) => c.db.roles.find((r) => r.id === id)?.name),
    permissions: pick(new Set([...roleSet, ...overSet])), rolePermissions: pick(roleSet), overridePermissions: pick(overSet),
  };
});
put('/users/:id/permissions', (c) => {
  needAdmin(c);
  const ids: string[] = c.body?.permissionIds ?? [];
  c.db.userPermissions = c.db.userPermissions.filter((x) => x.userId !== c.params.id).concat(ids.map((p) => ({ id: uid(), userId: c.params.id, permissionId: p })));
  return { ok: true };
});
post('/users/:id/reset-password', (c) => {
  needAdmin(c);
  const u = byId(c.db.users, c.params.id);
  const tempPassword = c.body?.newPassword || 'demo1234';
  u.password = tempPassword;
  return { tempPassword };
});
post('/users/:id/unlock', (c) => { needAdmin(c); const u = byId(c.db.users, c.params.id); u.lockedUntil = null; return { ok: true }; });

// ───────────── ตั้งค่าระบบ ─────────────
get('/settings', (c) => c.db.settings);
patch('/settings/:key', (c) => {
  needPerm(c, 'settings:manage:SystemSetting');
  const s = c.db.settings.find((x) => x.settingKey === c.params.key);
  if (!s) throw notFound(`ไม่พบการตั้งค่า: ${c.params.key}`);
  s.settingValue = String(c.body?.value ?? '');
  return s;
});
get('/settings/public', () => ({}));
get('/settings/:key', (c) => {
  const s = c.db.settings.find((x) => x.settingKey === c.params.key);
  if (!s) throw notFound(`ไม่พบการตั้งค่า: ${c.params.key}`);
  return s;
});
get('/maintenance/backup', () => new Raw(new Blob([JSON.stringify({ note: 'ไฟล์สำรองเดโม่' }, null, 2)], { type: 'application/json' })));
post('/maintenance/purge', () => ({ deleted: 0 }));

// ───────────── แจ้งเตือน ─────────────
get('/notifications/unread-count', (c) => ({ count: c.db.notifications.filter((n) => n.userId === c.user!.id && !n.isRead).length }));
get('/notifications/preferences', (c) => c.db.notifPrefs.filter((p) => p.userId === c.user!.id));
put('/notifications/preferences', (c) => {
  c.db.notifPrefs = c.db.notifPrefs.filter((p) => p.userId !== c.user!.id).concat((c.body?.prefs ?? []).map((p: Row) => ({ ...p, userId: c.user!.id })));
  return { ok: true };
});
put('/notifications/read-all', (c) => { c.db.notifications.filter((n) => n.userId === c.user!.id).forEach((n) => { n.isRead = true; }); return { ok: true }; });
get('/notifications', (c) => paginate(c.db.notifications.filter((n) => n.userId === c.user!.id), c.query, 20).data);
put('/notifications/:id/read', (c) => { byId(c.db.notifications, c.params.id).isRead = true; return { ok: true }; });
del('/notifications/:id', (c) => { removeById(c.db.notifications, c.params.id); return { ok: true }; });

// ───────────── ไฟล์แนบ (เก็บเป็น data URL ในเบราว์เซอร์) ─────────────
post('/storage/upload', async (c) => {
  const file = c.body instanceof FormData ? (c.body.get('file') as File | null) : null;
  if (!file) throw badRequest('ไม่พบไฟล์');
  if (file.size > 3 * 1024 * 1024) throw badRequest('เดโม่รับไฟล์ไม่เกิน 3 MB ต่อไฟล์');
  const f = {
    id: uid(), originalName: file.name, url: await readAsDataUrl(file), mimeType: file.type || 'application/octet-stream', fileSize: file.size,
    refType: c.query.refType, refId: c.query.refId, caption: c.query.caption, category: c.query.category, uploadedBy: c.user!.id, createdAt: nowIso(),
  };
  c.db.files.push(f);
  return fileView(f);
});
get('/storage/files', (c) => c.db.files.filter((f) => f.refType === c.query.refType && f.refId === c.query.refId).map(fileView));
del('/storage/:id', (c) => { removeById(c.db.files, c.params.id); return { ok: true }; });

// ───────────── ประวัติกิจกรรม ─────────────
get('/audit/logs', (c) => {
  needPerm(c, 'audit:read:AuditLog');
  const { search, action, module } = c.query;
  const rows = c.db.audit.filter((a) => (!action || a.action === action) && (!module || a.module === module) && textMatch(a, ['resourceTitle', 'userName', 'action', 'module'], search));
  return paginate(rows, c.query, 20);
});
