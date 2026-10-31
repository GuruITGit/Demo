/**
 * แกนระบบเดโม่ — แทน backend ด้วยข้อมูลจำลองที่เก็บในเบราว์เซอร์ (IndexedDB)
 * เปิดด้วย NEXT_PUBLIC_DEMO_MODE=1 เท่านั้น (ดู lib/api.ts) — บน production จริงไม่ถูกโหลด
 *
 * หน้าเว็บเรียก api.get/post/patch/delete เหมือนเดิมทุกอย่าง ตัวนี้ตอบกลับในรูปแบบเดียวกับ backend
 * `{ success, data, meta? }` เพิ่ม/แก้/ลบแล้วข้อมูลค้างอยู่จริง (รีเฟรชหน้าก็ยังอยู่) ปุ่ม "รีเซ็ต" ล้างกลับค่าตั้งต้น
 */

import { remoteEnabled, remoteLoad, remoteSave, kvConfig } from './remote';
import '../../../citizen-pay/shared/kv-sync'; // ตั้ง window.smartKvInit (ซิงก์คีย์ฝั่งประชาชน)

export type Row = Record<string, any>;
export type Db = Record<string, Row[]> & { _meta: Row[] };

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const badRequest = (m: string) => new HttpError(400, m);
export const notFound = (m = 'ไม่พบข้อมูล') => new HttpError(404, m);
export const forbidden = (m = 'ไม่มีสิทธิ์ดำเนินการ') => new HttpError(403, m);

// ───────────────────────────── ฐานข้อมูลในเบราว์เซอร์ ─────────────────────────────
// เก็บใน IndexedDB (ไม่จำกัด 5MB เหมือน localStorage — แนบไฟล์/ลายเซ็นได้) · ใช้ไม่ได้ (เช่นหน้าต่างส่วนตัว) = ทำงานในหน้านั้นต่อโดยไม่จำข้ามรอบ
const KEY = 'db';
export const DB_VERSION = 9; // เพิ่มเลขนี้เมื่อแก้ seed ให้เครื่องที่เคยเปิดไว้รับข้อมูลชุดใหม่

/** ชิ้นข้อมูลตั้งต้นของแต่ละโมดูล — รับ db ที่สร้างไว้แล้วบางส่วน (ลำดับ = ลำดับที่ลงทะเบียน) */
type SeedPart = (db: Db) => void;
const seedParts: SeedPart[] = [];
let db: Db | null = null;
let loading: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let loadFailed = false; // โหลดข้อมูลกลางไม่ได้ → ห้ามเขียนทับ
let saving: Promise<unknown> = Promise.resolve();
let lastSaved = ''; // JSON ของสถานะที่ส่งไปฐานกลางล่าสุด — ไม่ส่งซ้ำถ้าไม่เปลี่ยน

export function registerSeed(part: SeedPart) { seedParts.push(part); }

function fresh(): Db {
  const d = { _meta: [{ version: DB_VERSION }] } as Db;
  for (const part of seedParts) part(d);
  return d;
}

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('smartgov-demo', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGet(key: string): Promise<any> {
  const d = await idbOpen();
  return new Promise((resolve, reject) => {
    const r = d.transaction('kv').objectStore('kv').get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function idbSet(key: string, value: unknown): Promise<void> {
  const d = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** โหลดข้อมูลจากเครื่อง (ครั้งแรกสร้างจาก seed) — adapter เรียกก่อนตอบทุกคำขอ */
export function ensureLoaded(): Promise<void> {
  return (loading ??= (async () => {
    try {
      const saved = remoteEnabled ? await remoteLoad() : await idbGet(KEY);
      if ((saved as Row | null)?._meta?.[0]?.version === DB_VERSION) db = saved as Db;
    } catch { loadFailed = remoteEnabled; /* ใช้ข้อมูลตั้งต้น (เชื่อมฐานกลางไม่ได้ก็ไม่เขียนทับ) */ }
    if (!db) { db = fresh(); persist(true); }
    else if (remoteEnabled) lastSaved = JSON.stringify(db);
    await (globalThis as unknown as { smartKvInit?: (c: unknown) => Promise<void> }).smartKvInit?.(kvConfig); // คีย์ฝั่งประชาชนต้องดึงก่อน ให้เจ้าหน้าที่เห็นการจองและการชำระล่าสุด
  })());
}

export function getDb(): Db {
  if (!db) db = fresh(); // ปกติโหลดแล้วใน ensureLoaded
  return db;
}

export function persist(now = false) {
  if (!db || typeof indexedDB === 'undefined') return;
  // ต่อคิวทีละงาน และอ่าน db ตอนถึงคิว → ข้อมูลล่าสุดเสมอ ไม่ให้คำขอเก่าที่เสร็จทีหลังทับของใหม่
  const write = () => {
    if (loadFailed) return;
    saving = saving.then(() => {
      if (!remoteEnabled) return idbSet(KEY, db);
      const json = JSON.stringify(db);
      if (json === lastSaved) return;
      return remoteSave(json).then(() => { lastSaved = json; });
    }).catch(() => { /* เก็บไม่ได้ก็ยังใช้ได้ในหน้านี้ */ });
  };
  if (timer) clearTimeout(timer);
  if (now) write(); else timer = setTimeout(write, 150);
}

/** ล้างข้อมูลที่ทดลองไว้ทั้งหมดกลับเป็นข้อมูลตั้งต้น (ไม่ล็อกเอาต์) */
export async function resetDemoData() {
  await ensureLoaded();
  db = fresh();
  if (timer) clearTimeout(timer);
  if (!loadFailed) { try { if (remoteEnabled) { const json = JSON.stringify(db); await remoteSave(json); lastSaved = json; } else await idbSet(KEY, db); } catch { /* ignore */ } }
}

export const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
export const nowIso = () => new Date().toISOString();

// ───────────────────────────── เราต์เตอร์ ─────────────────────────────
export interface Ctx {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, any>;
  body: any;
  db: Db;
  /** ผู้ใช้ที่ล็อกอินอยู่ (จาก token เดโม่) — null ถ้ายังไม่ล็อกอิน */
  user: Row | null;
}
export type Handler = (ctx: Ctx) => any;
/** ผลลัพธ์แบบมี meta (แบ่งหน้า) */
export class Paged { constructor(public data: any[], public meta: Row) {} }
/** ตอบแบบดิบ (ไม่ห่อ {success,data}) เช่นไฟล์ดาวน์โหลด */
export class Raw { constructor(public data: any, public headers: Record<string, string> = {}) {} }

interface Route { method: string; segs: string[]; handler: Handler; score: number }
const routes: Route[] = [];

export function route(method: string, pattern: string, handler: Handler) {
  const segs = pattern.split('/').filter(Boolean);
  // ส่วนที่เป็นตัวอักษรตรง ๆ ชนะส่วนที่เป็นพารามิเตอร์ (เช่น /tickets/inbox ชนะ /tickets/:id)
  const score = segs.reduce((s, x, i) => s + (x.startsWith(':') ? 0 : Math.pow(2, 20 - i)), 0);
  routes.push({ method: method.toUpperCase(), segs, handler, score });
  routes.sort((a, b) => b.score - a.score);
}
export const get = (p: string, h: Handler) => route('GET', p, h);
export const post = (p: string, h: Handler) => route('POST', p, h);
export const put = (p: string, h: Handler) => route('PUT', p, h);
export const patch = (p: string, h: Handler) => route('PATCH', p, h);
export const del = (p: string, h: Handler) => route('DELETE', p, h);

export function match(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
  const parts = path.split('/').filter(Boolean);
  for (const r of routes) {
    if (r.method !== method || r.segs.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      const s = r.segs[i];
      if (s.startsWith(':')) params[s.slice(1)] = decodeURIComponent(parts[i]);
      else if (s !== parts[i]) { ok = false; break; }
    }
    if (ok) return { handler: r.handler, params };
  }
  return null;
}

// ───────────────────────────── ตัวช่วยสำหรับ handler ─────────────────────────────
export const num = (v: any, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

export function paginate(items: Row[], query: Row, defLimit = 20): Paged {
  const page = num(query.page, 1);
  const limit = num(query.limit, defLimit);
  const total = items.length;
  return new Paged(items.slice((page - 1) * limit, page * limit), {
    page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

/** ค้นหาข้อความแบบไม่สนตัวพิมพ์ในหลายฟิลด์ */
export function textMatch(row: Row, fields: string[], q?: string): boolean {
  if (!q) return true;
  const needle = String(q).toLowerCase().trim();
  return fields.some((f) => String(f.split('.').reduce((o: any, k) => o?.[k], row) ?? '').toLowerCase().includes(needle));
}

export function byId(list: Row[], id: string): Row {
  const r = list.find((x) => x.id === id);
  if (!r) throw notFound();
  return r;
}
export function removeById(list: Row[], id: string) {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) throw notFound();
  list.splice(i, 1);
}

/** ลบฟิลด์ที่ขึ้นต้นด้วย _ (ฟิลด์ภายในของเดโม่) ก่อนส่งกลับหน้าเว็บ */
export function publicRow<T>(row: T): T {
  if (Array.isArray(row)) return row.map(publicRow) as any;
  if (row && typeof row === 'object') {
    const o: Row = {};
    for (const [k, v] of Object.entries(row as Row)) if (!k.startsWith('_')) o[k] = publicRow(v);
    return o as T;
  }
  return row;
}

// ───────────────────────────── ไฟล์ / ฟอร์ม ─────────────────────────────
const blobCache = new Map<string, string>();
/**
 * ไฟล์ที่ผู้ใช้อัปโหลดเก็บเป็น data URL (อยู่รอดหลังรีเฟรช) — แต่ Chrome บล็อกการเปิด data: ในแท็บใหม่/ดาวน์โหลดลิงก์
 * จึงแปลงเป็น blob: URL ตอนส่งให้หน้าเว็บ (ใช้เปิดแท็บใหม่ ดาวน์โหลด และใส่ iframe/img ได้ปกติ)
 */
export function blobUrl(url?: string | null): string | null | undefined {
  if (!url || !url.startsWith('data:') || typeof window === 'undefined') return url;
  const hit = blobCache.get(url);
  if (hit) return hit;
  try {
    const [head, b64] = url.split(',');
    const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
    const bin = head.includes(';base64') ? atob(b64) : decodeURIComponent(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const out = URL.createObjectURL(new Blob([bytes], { type: mime }));
    blobCache.set(url, out);
    return out;
  } catch { return url; }
}
/** แถวไฟล์ที่ส่งให้หน้าเว็บ (url เป็น blob:) */
export const fileView = (f: Row): Row => ({ ...f, url: blobUrl(f.url) });

export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
/** แปลง FormData เป็นอ็อบเจ็กต์ (ไฟล์ → data URL เก็บใน {name,url,type,size}) */
export async function formToRow(fd: unknown, maxFileBytes = 3 * 1024 * 1024): Promise<Row> {
  const out: Row = {};
  if (!(typeof FormData !== 'undefined' && fd instanceof FormData)) return (fd as Row) ?? {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === 'string') { out[k] = v; continue; }
    if (v.size > maxFileBytes) throw badRequest('เดโม่รับไฟล์ไม่เกิน 3 MB ต่อไฟล์');
    out[k] = { name: v.name, type: v.type, size: v.size, url: await readAsDataUrl(v) };
  }
  return out;
}

// ───────────────────────────── ผู้ใช้ปัจจุบัน ─────────────────────────────
export const tokenFor = (userId: string) => `demo.${userId}`;
export function userFromToken(token: string | null | undefined): Row | null {
  if (!token || !token.startsWith('demo.')) return null;
  return getDb().users.find((u) => u.id === token.slice(5)) ?? null;
}

/** โปรไฟล์ผู้ใช้ในรูปแบบที่หน้าเว็บคาดหวัง (ไม่มี passwordHash) */
export function userView(u: Row): Row {
  const { password, ...rest } = u;
  const dept = getDb().departments.find((d) => d.id === u.departmentId);
  return publicRow({ ...rest, departmentName: dept?.nameTh, department: dept ? { id: dept.id, nameTh: dept.nameTh } : undefined });
}
/** ย่อผู้ใช้ให้เหลือเฉพาะที่ใช้แสดงชื่อ (creator/assignee ฯลฯ) */
export function userBrief(id?: string | null): Row | null {
  if (!id) return null;
  const u = getDb().users.find((x) => x.id === id);
  if (!u) return null;
  return { id: u.id, titleTh: u.titleTh, fullNameTh: u.fullNameTh, positionName: u.positionName, departmentId: u.departmentId, avatarUrl: u.avatarUrl };
}

const AUDIT_MODULE: Record<string, string> = {
  documents: 'document', 'citizen-reports': 'complaint', meetings: 'meeting', assets: 'asset', leave: 'leave', hr: 'hr', correspondence: 'correspondence',
};
/** จดประวัติกิจกรรมอัตโนมัติทุกครั้งที่มีการเพิ่ม/แก้/ลบ — หน้า "ประวัติกิจกรรม" จึงมีของจริงให้ดู */
function recordAudit(method: string, path: string, body: any, user: Row) {
  const d = getDb();
  const seg = path.split('/').filter(Boolean);
  const m = method.toUpperCase();
  const last = seg[seg.length - 1];
  const action = /approve|sign/.test(last) ? 'APPROVE' : /reject|return/.test(last) ? 'REJECT' : m === 'POST' ? 'CREATE' : m === 'DELETE' ? 'DELETE' : 'UPDATE';
  const title = body && typeof body === 'object' && !(typeof FormData !== 'undefined' && body instanceof FormData)
    ? (body.subject || body.title || body.nameTh || body.fullNameTh || body.name) : undefined;
  d.audit.unshift({
    id: uid(), action, module: AUDIT_MODULE[seg[0]] ?? seg[0], resourceTitle: title || path, userId: user.id, userName: `${user.titleTh ?? ''}${user.fullNameTh}`,
    ipAddress: '127.0.0.1', actedAt: nowIso(),
  });
  if (d.audit.length > 300) d.audit.length = 300;
}

// ───────────────────────────── ตัวเรียก (ใช้โดย adapter) ─────────────────────────────
export interface DemoResult { status: number; body: any; headers: Record<string, string> }

export async function dispatch(method: string, rawUrl: string, params: Row | undefined, body: any, token: string | null): Promise<DemoResult> {
  const u = new URL(rawUrl, 'http://demo.local');
  const path = u.pathname.replace(/^\/v1/, '');
  const query: Row = {};
  u.searchParams.forEach((v, k) => { query[k] = v; });
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== '') query[k] = v;

  await ensureLoaded();
  const m = match(method.toUpperCase(), path);
  const fail = (status: number, message: string): DemoResult => ({
    status, headers: {},
    body: { success: false, error: { code: status === 404 ? 'NOT_FOUND' : status === 401 ? 'UNAUTHORIZED' : 'ERROR', message } },
  });
  if (!m) { console.warn('[demo] no route', method.toUpperCase(), path); return fail(404, `เดโม่ยังไม่มีบริการ ${method.toUpperCase()} ${path}`); }

  const user = userFromToken(token);
  const isPublic = /^\/(auth\/(login|hub-login|refresh)|organizations\/by-host|citizen\/|settings\/public)/.test(path);
  if (!user && !isPublic) return fail(401, 'กรุณาเข้าสู่ระบบ');

  try {
    const out = await m.handler({ method, path, params: m.params, query, body, db: getDb(), user });
    if (method.toUpperCase() !== 'GET' && user && !/^\/(auth|notifications|storage)\//.test(path)) recordAudit(method, path, body, user);
    persist(method.toUpperCase() !== 'GET');
    if (out instanceof Raw) return { status: 200, body: out.data, headers: out.headers };
    if (out instanceof Paged) return { status: 200, headers: {}, body: { success: true, data: publicRow(out.data), meta: out.meta, message: 'ดำเนินการสำเร็จ' } };
    return { status: method.toUpperCase() === 'POST' ? 201 : 200, headers: {}, body: { success: true, data: publicRow(out), message: 'ดำเนินการสำเร็จ' } };
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.message);
    console.error('[demo]', method, path, e);
    return fail(500, 'เดโม่ทำรายการไม่สำเร็จ');
  }
}
