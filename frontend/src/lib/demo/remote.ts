/**
 * เดโม่: อ่าน/เขียนสถานะทั้งระบบผ่าน Supabase REST (แถว id = 'main' ในตาราง demo_state — ดู supabase/demo/state.sql)
 * เปิดใช้เมื่อมี NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY ตอน build · ไม่มีค่า = ใช้ IndexedDB ของเครื่องเหมือนเดิม
 */
const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const remoteEnabled = !!(URL_BASE && ANON);
const headers = { apikey: ANON, 'Content-Type': 'application/json' }; // publishable key ใช้ใน apikey อย่างเดียว (ไม่ส่ง Bearer เพราะไม่ใช่ JWT)

/** คืน null เมื่อยังไม่มีแถว · โยน error เมื่อเชื่อมต่อไม่ได้ (ผู้เรียกต้องไม่เขียนทับข้อมูลเดิม) */
export async function remoteLoad(): Promise<unknown | null> {
  const r = await fetch(`${URL_BASE}/rest/v1/demo_state?id=eq.main&select=data`, { headers, cache: 'no-store' });
  if (!r.ok) throw new Error(`remote load ${r.status}`);
  const rows = (await r.json()) as { data: unknown }[];
  return rows[0]?.data ?? null;
}

export async function remoteSave(data: unknown): Promise<void> {
  const r = await fetch(`${URL_BASE}/rest/v1/demo_state`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: 'main', data, updated_at: new Date().toISOString() }),
  });
  if (!r.ok) throw new Error(`remote save ${r.status}`);
}
