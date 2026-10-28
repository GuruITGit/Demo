import * as path from 'path';
import * as fs from 'fs';
import {
  CUSTOMER_COLS, BILL_COLS, memberToRow, billToRow, billTotal, billPaid, roundToPeriod, intOr,
} from './legacy-map';

/**
 * ซิงก์ข้อมูลประปาจากระบบเดิม (Prapa On Mobile) → ระบบเรา แบบอัปเดตทับ ไม่ล้างทั้งก้อน — รันซ้ำได้เรื่อย ๆ
 *   ผู้ใช้น้ำ: upsert ตามรหัส (ยึดระบบเดิม แต่คง access_token / walk_order / gps ของเราไว้)
 *   บิล:     upsert ตาม (ผู้ใช้น้ำ, เดือน) (ยึดระบบเดิม แต่คง receipt_no / slip / รูปมาตร ของเราไว้)
 *   ไม่ลบอะไร ยกเว้น purge = ลบบิลที่สร้างในระบบเรา (legacy IS NULL) ซึ่งระบบเดิมไม่มี
 * ดึงจากระบบเดิมด้วย GET อย่างเดียว
 *
 * ใช้ร่วมกัน 2 ทาง: สคริปต์ seeds/sync-prapa-legacy.ts (CLI) และปุ่มในหน้าแอดมินประปา (legacy-sync.service.ts)
 */

export type Query = (sql: string, params?: any[]) => Promise<any>;
export type Log = (line: string) => void;
export type LegacyCreds = { url?: string; org: string; user: string; password: string };
export type LegacyData = { fetchedAt: string; currentRound: string | null; members: any[]; rounds: string[]; bills: Record<string, any[]> };
export type SyncResult = {
  customers: { inserted: number; updated: number; same: number };
  bills: { inserted: number; updated: number; same: number; orphan: number };
  extraCustomers: string[];
  notInLegacy: number;
  purged: number;
  currentRound: string | null;
};

export const DEFAULT_LEGACY_URL = 'http://139.59.124.118';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

// ───────────────────────── ดึงจากระบบเดิม ─────────────────────────
export async function fetchLegacy(creds: LegacyCreds, opts: { since?: string }, log: Log): Promise<LegacyData> {
  const url = (creds.url || DEFAULT_LEGACY_URL).replace(/\/$/, '');
  if (!creds.org || !creds.user || !creds.password) throw new Error('ยังไม่ได้ตั้งรหัสองค์กร/ผู้ใช้/รหัสผ่านของระบบเดิม');

  const login = await fetch(`${url}/api/v1/cms/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: creds.user, password: creds.password, org_id: creds.org }),
  });
  const token = (await login.json().catch(() => null))?.data?.tokens?.access?.token;
  if (!token) throw new Error(`ล็อกอินระบบเดิมไม่สำเร็จ (HTTP ${login.status}) — ตรวจรหัสองค์กร/ผู้ใช้/รหัสผ่าน`);

  const get = async (p: string, tries = 3): Promise<any> => {
    for (let i = 1; ; i++) {
      try {
        const r = await fetch(`${url}/api/v1/cms/${p}`, { headers: { authorization: `Bearer ${token}`, orgid: creds.org } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return await r.json();
      } catch (e) {
        if (i >= tries) throw new Error(`ดึง ${p} ไม่สำเร็จ: ${(e as Error).message}`);
        await sleep(2000 * i);
      }
    }
  };

  const areas: any[] = await get('area');
  const members: any[] = [];
  for (const a of areas) {
    const list = await get(`member/area?M02=${encodeURIComponent(a.A01)}`);
    if (Array.isArray(list)) members.push(...list);
  }
  log(`ระบบเดิม: ผู้ใช้น้ำ ${members.length} ราย จาก ${areas.length} พื้นที่`);

  const configs: any[] = await get('bill_config/recent?sortBy=CB05:asc');
  const currentRound = configs.find((c) => String(c.CB05) === '1')?.CB01 ?? null;
  const rounds = configs.map((c) => String(c.CB01)).filter((r) => roundToPeriod(r) && (!opts.since || r >= opts.since)).sort();

  const bills: Record<string, any[]> = {};
  for (const r of rounds) {
    const list = await get(`book_list/payment?B01=${encodeURIComponent(r)}`);
    bills[r] = Array.isArray(list) ? list : [];
    log(`  ดึงบิลรอบ ${r} … ${bills[r].length} ใบ`);
    await sleep(300); // ไม่ยิงถี่ใส่เซิร์ฟเวอร์ของเขา
  }
  log(`ระบบเดิม: ${rounds.length} รอบ · บิล ${Object.values(bills).reduce((s, l) => s + l.length, 0)} ใบ · รอบปัจจุบัน ${currentRound}`);
  return { fetchedAt: new Date().toISOString(), currentRound, members, rounds, bills };
}

/** เก็บข้อมูลดิบที่ดึงมา (มีข้อมูลส่วนบุคคล — ห้ามเอาเข้า git / ห้ามวางในที่ที่เปิดเป็นไฟล์สาธารณะ) · keep = เก็บไว้กี่ชุดล่าสุด */
export function saveBackup(d: LegacyData, baseDir: string, log: Log, keep?: number) {
  const dir = path.join(baseDir, 'prapa-legacy-' + d.fetchedAt.replace(/[:.]/g, '-').slice(0, 19));
  fs.mkdirSync(path.join(dir, 'bills'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'members.json'), JSON.stringify(d.members));
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ fetchedAt: d.fetchedAt, currentRound: d.currentRound, rounds: d.rounds }, null, 1));
  for (const r of d.rounds) fs.writeFileSync(path.join(dir, 'bills', `${r}.json`), JSON.stringify(d.bills[r]));
  if (keep) {
    const old = fs.readdirSync(baseDir).filter((n) => n.startsWith('prapa-legacy-')).sort().slice(0, -keep);
    for (const n of old) fs.rmSync(path.join(baseDir, n), { recursive: true, force: true });
  }
  log(`เก็บสำรองข้อมูลดิบไว้ที่ ${dir}`);
}

export function loadBackup(dir: string, since?: string): LegacyData {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const rounds: string[] = meta.rounds.filter((r: string) => !since || r >= since);
  const bills: Record<string, any[]> = {};
  for (const r of rounds) bills[r] = JSON.parse(fs.readFileSync(path.join(dir, 'bills', `${r}.json`), 'utf8'));
  return { ...meta, rounds, bills, members: JSON.parse(fs.readFileSync(path.join(dir, 'members.json'), 'utf8')) };
}

/** บิลซ้ำ (ผู้ใช้น้ำ+รอบเดียวกันมากกว่า 1 ใบ) → เอาใบที่แก้ล่าสุด */
function dedupeBills(list: any[]) {
  const m = new Map<string, any>();
  for (const b of list) {
    const k = `${b.B03}|${b.B01}`;
    const prev = m.get(k);
    if (!prev || String(b.updatedAt || '') > String(prev.updatedAt || '')) m.set(k, b);
  }
  return [...m.values()];
}

// ───────────────────────── เขียนลงฐานข้อมูลเรา ─────────────────────────
async function upsert(q: Query, table: string, cols: readonly string[], rows: any[][], conflict: string, keep: string[]) {
  const set = cols.filter((c) => !keep.includes(c)).map((c) => `${c} = EXCLUDED.${c}`).join(', ');
  // นับเฉพาะแถวที่ค่าเปลี่ยนจริง — รันซ้ำแล้วไม่มีอะไรเปลี่ยนต้องได้ 0
  const changed = cols.filter((c) => !keep.includes(c) && c !== 'organization_id')
    .map((c) => `${table}.${c} IS DISTINCT FROM EXCLUDED.${c}`).join(' OR ');
  let inserted = 0, updated = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const vals: any[] = [];
    const ph = chunk.map((r) => '(' + r.map((v) => { vals.push(v); return `$${vals.length}`; }).join(',') + ')');
    const res = await q(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES ${ph.join(',')}
       ON CONFLICT ${conflict} DO UPDATE SET ${set}, updated_at = now() WHERE ${changed}
       RETURNING (xmax = 0) AS ins`, vals);
    for (const r of res) (r.ins ? inserted++ : updated++);
  }
  return { inserted, updated };
}

/** ต้องเรียกภายใน transaction — ล็อกต่อองค์กรกันกดซ้ำ/รันชนกับสคริปต์ */
export async function syncLegacy(q: Query, ORG: string, d: LegacyData, opts: { purge?: boolean }, log: Log): Promise<SyncResult> {
  const [lock] = await q(`SELECT pg_try_advisory_xact_lock(hashtext('prapa-legacy-sync:' || $1)) AS ok`, [ORG]);
  if (!lock?.ok) throw new Error('กำลังอัปเดตจากระบบเดิมอยู่แล้ว — รอให้เสร็จก่อน');

  // 1) ผู้ใช้น้ำ
  const members = d.members.filter((m) => String(m.M01 || '').trim() && String(m.M04 || '').trim());
  const cCols = ['organization_id', ...CUSTOMER_COLS];
  const cRows = members.map((m) => { const r = memberToRow(m); return [ORG, ...CUSTOMER_COLS.map((c) => r[c])]; });
  const cRes = await upsert(q, 'water_customers', cCols, cRows,
    // พิกัด: ระบบเดิมเก็บที่บิลไม่ใช่ที่สมาชิก → ไม่ทับพิกัดที่มีอยู่ (เติมจากบิลทีหลัง)
    '(organization_id, customer_code) WHERE deleted_at IS NULL', ['organization_id', 'customer_code', 'gps']);
  const cSame = cRows.length - cRes.inserted - cRes.updated;
  log(`ผู้ใช้น้ำ: เพิ่ม ${cRes.inserted} · แก้ ${cRes.updated} · ไม่เปลี่ยน ${cSame}`);

  // รายใหม่ต้องมีรหัสเข้าถึงสาธารณะ (QR/เช็กบิล) — สุ่มแบบเดียวกับ migration 1700000063000
  await q(`
    DO $$ DECLARE r RECORD; candidate text; chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int;
    BEGIN
      FOR r IN SELECT id, organization_id FROM water_customers WHERE access_token IS NULL AND deleted_at IS NULL LOOP
        LOOP
          candidate := '';
          FOR i IN 1..6 LOOP candidate := candidate || substr(chars, floor(random() * length(chars) + 1)::int, 1); END LOOP;
          EXIT WHEN NOT EXISTS (SELECT 1 FROM water_customers WHERE organization_id = r.organization_id
                                  AND (access_token = candidate OR customer_code = candidate) AND deleted_at IS NULL);
        END LOOP;
        UPDATE water_customers SET access_token = candidate WHERE id = r.id;
      END LOOP;
    END $$;`);

  const extra: any[] = await q(
    `SELECT customer_code, full_name FROM water_customers WHERE organization_id = $1 AND deleted_at IS NULL AND NOT (customer_code = ANY($2))`,
    [ORG, members.map((m) => String(m.M01).trim())]);
  if (extra.length) log(`⚠ มีในระบบเราแต่ไม่มีในระบบเดิม ${extra.length} ราย (ไม่ลบ): ${extra.slice(0, 10).map((x) => x.customer_code + ' ' + x.full_name).join(', ')}`);

  // 2) บิล
  const custs: any[] = await q(
    `SELECT id, customer_code, full_name, village_no FROM water_customers WHERE organization_id = $1 AND deleted_at IS NULL`, [ORG]);
  const byCode = new Map(custs.map((c) => [c.customer_code, { id: c.id, name: c.full_name, village: c.village_no }]));
  const bCols = ['organization_id', ...BILL_COLS];
  let bIns = 0, bUpd = 0, bSame = 0, orphan = 0;
  const legacyKeys = new Set<string>();
  for (const r of d.rounds) {
    const rows: any[][] = [];
    for (const b of dedupeBills(d.bills[r] || [])) {
      const c = byCode.get(String(b.B03));
      if (!c) { orphan++; continue; }
      const row = billToRow(b, c);
      legacyKeys.add(`${c.id}|${row.period_year}|${row.period_month}`);
      rows.push([ORG, ...BILL_COLS.map((k) => (row as any)[k])]);
    }
    if (!rows.length) continue;
    const res = await upsert(q, 'water_bills_v2', bCols, rows,
      '(organization_id, customer_id, period_year, period_month)', ['organization_id']);
    bIns += res.inserted; bUpd += res.updated; bSame += rows.length - res.inserted - res.updated;
  }
  log(`บิล: เพิ่ม ${bIns} · แก้ ${bUpd} · ไม่เปลี่ยน ${bSame}${orphan ? ` · ข้าม ${orphan} (ไม่มีผู้ใช้น้ำ)` : ''}`);

  // 3) บิลที่สร้างในระบบเรา (legacy IS NULL) ซึ่งระบบเดิมไม่มี
  const ours: any[] = await q(
    `SELECT id, customer_id, customer_code, full_name, period_year, period_month, prev_reading, curr_reading, total_amount, status
       FROM water_bills_v2 WHERE organization_id = $1 AND legacy IS NULL ORDER BY period_year, period_month, customer_code`, [ORG]);
  const notInLegacy = ours.filter((b) => !legacyKeys.has(`${b.customer_id}|${b.period_year}|${b.period_month}`));
  let purged = 0;
  if (notInLegacy.length) {
    log(`บิลที่สร้างในระบบเรา และระบบเดิมไม่มี: ${notInLegacy.length} ใบ`);
    for (const b of notInLegacy) log(`  ${b.period_year}-${String(b.period_month).padStart(2, '0')} ${b.customer_code} ${b.full_name} · ${b.prev_reading}→${b.curr_reading} · ${b.total_amount} บาท · ${b.status}`);
    if (opts.purge) {
      await q(`DELETE FROM water_bills_v2 WHERE id = ANY($1)`, [notInLegacy.map((b) => b.id)]);
      purged = notInLegacy.length;
      log(`  → ลบแล้ว (--purge-test)`);
    } else log(`  → ไม่ลบ`);
  }

  // 4) พิกัดผู้ใช้น้ำที่ยังว่าง = พิกัดจากบิลล่าสุดที่มี (เหมือนตอนนำเข้าครั้งแรก)
  const gps = await q(
    `UPDATE water_customers c SET gps = s.loc, updated_at = now()
       FROM (SELECT DISTINCT ON (customer_id) customer_id, gps AS loc FROM water_bills_v2
              WHERE organization_id = $1 AND gps ~ ',' ORDER BY customer_id, period_year DESC, period_month DESC) s
      WHERE c.id = s.customer_id AND c.organization_id = $1 AND (c.gps IS NULL OR c.gps = '') RETURNING c.id`, [ORG]);
  const gpsCount = Array.isArray(gps?.[0]) ? gps[1] : gps.length; // TypeORM คืน [rows, count] สำหรับ UPDATE
  if (gpsCount) log(`เติมพิกัดผู้ใช้น้ำจากบิล: ${gpsCount} ราย`);

  // 5) รอบปัจจุบัน = รอบที่ระบบเดิมเปิดอยู่ (เลขมิเตอร์ล่าสุดมาจาก M09 ของระบบเดิมแล้ว)
  const cur = d.currentRound ? roundToPeriod(d.currentRound) : null;
  if (cur) {
    await q(`UPDATE water_rate SET current_period_year = $2, current_period_month = $3, updated_at = now()
              WHERE organization_id = $1 AND (current_period_year, current_period_month) IS DISTINCT FROM ($2, $3)`,
    [ORG, cur.year, cur.month]);
    log(`รอบปัจจุบัน: ${d.currentRound} (${cur.month}/${cur.year})`);
  }

  return {
    customers: { inserted: cRes.inserted, updated: cRes.updated, same: cSame },
    bills: { inserted: bIns, updated: bUpd, same: bSame, orphan },
    extraCustomers: extra.map((x) => `${x.customer_code} ${x.full_name}`),
    notInLegacy: notInLegacy.length,
    purged,
    currentRound: d.currentRound,
  };
}

// ───────────────────────── ตรวจว่าตรงกับระบบเดิม ─────────────────────────
/** คืนจำนวนจุดที่ไม่ตรง (0 = ตรงทั้งหมด) · showFrom = แสดงแถวรอบที่ตรงกันตั้งแต่รอบนี้ (รอบที่ไม่ตรงแสดงเสมอ) */
export async function verifyLegacy(q: Query, ORG: string, d: LegacyData, opts: { showFrom?: string }, log: Log): Promise<number> {
  let problems = 0;
  const show = (title: string, list: string[]) => {
    if (!list.length) return;
    problems += list.length;
    log(`  ✗ ${title}: ${list.length}`);
    for (const s of list.slice(0, 8)) log(`      ${s}`);
  };
  log('── ตรวจเทียบกับระบบเดิม ──');

  const ours: any[] = await q(
    // คอลัมน์ date ดึงเป็นข้อความ — ถ้าให้ pg แปลงเป็น Date จะเลื่อนวันตามเขตเวลาเครื่อง
    `SELECT id, ${CUSTOMER_COLS.filter((c) => !['legacy', 'issues', 'gps'].includes(c))
      .map((c) => (c.endsWith('_date') ? `${c}::text AS ${c}` : c)).join(', ')}
       FROM water_customers WHERE organization_id = $1 AND deleted_at IS NULL`, [ORG]);
  const oursBy = new Map(ours.map((c) => [c.customer_code, c]));
  const legacyCodes = new Set<string>();
  const missing: string[] = [], diff: string[] = [];
  const norm = (v: any) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(Number.isFinite(+v) && v !== '' && typeof v !== 'boolean' ? +v : v));
  for (const m of d.members) {
    const want = memberToRow(m);
    legacyCodes.add(want.customer_code);
    const have = oursBy.get(want.customer_code);
    if (!have) { missing.push(`${want.customer_code} ${want.full_name}`); continue; }
    for (const k of Object.keys(have)) {
      if (k === 'id' || !(k in want)) continue;
      if (norm((want as any)[k]) !== norm(have[k])) diff.push(`${want.customer_code} ${k}: เดิม=${(want as any)[k]} · เรา=${have[k]}`);
    }
  }
  log(`ผู้ใช้น้ำ: ระบบเดิม ${d.members.length} · ระบบเรา ${ours.length}`);
  show('ไม่มีในระบบเรา', missing);
  show('ข้อมูลไม่ตรง', diff);
  show('มีในระบบเราแต่ระบบเดิมไม่มี', ours.filter((c) => !legacyCodes.has(c.customer_code)).map((c) => `${c.customer_code} ${c.full_name}`));

  log('รอบ      | ระบบเดิม: บิล / ยอดบิล / เก็บได้        | ระบบเรา: บิล / ยอดบิล / เก็บได้');
  for (const r of d.rounds) {
    const p = roundToPeriod(r)!;
    const list = dedupeBills(d.bills[r] || []);
    const lBilled = list.reduce((s, b) => s + billTotal(b), 0);
    const lPaid = list.filter(billPaid).reduce((s, b) => s + billTotal(b), 0);
    const [o] = await q(
      `SELECT count(*)::int n, coalesce(sum(total_amount),0)::float billed,
              coalesce(sum(total_amount) FILTER (WHERE status = 'paid'),0)::float paid
         FROM water_bills_v2 WHERE organization_id = $1 AND period_year = $2 AND period_month = $3`, [ORG, p.year, p.month]);
    const same = o.n === list.length && Math.abs(o.billed - lBilled) < 0.5 && Math.abs(o.paid - lPaid) < 0.5;
    if (!same || r >= (opts.showFrom || '')) {
      log(`${same ? '✓' : '✗'} ${r} | ${String(list.length).padStart(5)} / ${fmt(lBilled).padStart(9)} / ${fmt(lPaid).padStart(9)} | ${String(o.n).padStart(5)} / ${fmt(o.billed).padStart(9)} / ${fmt(o.paid).padStart(9)}`);
    }
    if (!same) problems++;

    // รายบิล — เลขจด / ยอด / สถานะ ต้องตรงทุกใบ
    const rows: any[] = await q(
      `SELECT customer_code, prev_reading, curr_reading, total_amount::float total, status
         FROM water_bills_v2 WHERE organization_id = $1 AND period_year = $2 AND period_month = $3`, [ORG, p.year, p.month]);
    const ob = new Map(rows.map((x) => [x.customer_code, x]));
    const bd: string[] = [];
    for (const b of list) {
      const x = ob.get(String(b.B03));
      if (!x) { if (oursBy.has(String(b.B03))) bd.push(`${r} ${b.B03} ไม่มีบิล`); continue; }
      const want = { prev: intOr(b.B18, 0), curr: intOr(b.B20, 0), total: billTotal(b), status: billPaid(b) ? 'paid' : 'unpaid' };
      if (x.prev_reading !== want.prev || x.curr_reading !== want.curr || Math.abs(x.total - want.total) > 0.005 || x.status !== want.status)
        bd.push(`${r} ${b.B03}: เดิม ${want.prev}→${want.curr} ${want.total}฿ ${want.status} · เรา ${x.prev_reading}→${x.curr_reading} ${x.total}฿ ${x.status}`);
    }
    show(`บิลรอบ ${r} ไม่ตรง`, bd);
  }

  log(problems ? `✗ พบส่วนต่าง ${problems} จุด` : '✓ ตรงกับระบบเดิมทั้งหมด');
  return problems;
}
