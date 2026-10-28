import { headers } from 'next/headers';

/**
 * แบรนด์ อบต. ตามโดเมนที่เปิด (ฝั่ง server) — ใช้ทำชื่อแท็บ/ไอคอนเว็บ/ไอคอนใน Google
 * ข้อมูลจาก GET /organizations/by-host (ชื่อ+โลโก้ ตั้งที่ /hub หรือ /settings) — ห้าม hardcode ชื่อ อบต. ในโค้ด
 * ยิงไม่ได้/ไม่เจอโดเมน → null (ผู้เรียกใช้แบรนด์ Smart SAO สำรอง) — ห้ามทำให้หน้าเว็บพัง
 */
export type OrgBrand = { nameTh: string; logoUrl: string | null };

export const FALLBACK_ICON = '/brand/smart-sao-icon.png';
export const FALLBACK_APPLE_ICON = '/brand/smart-sao-apple.png';

// ยิงจาก server ไป backend: บน prod NEXT_PUBLIC_API_URL เป็น '/v1' (relative ใช้ฝั่ง server ไม่ได้)
// → ตั้ง INTERNAL_API_URL=http://backend:4000/v1 ใน docker-compose · dev ใช้ localhost
function apiBase(): string {
  if (process.env.INTERNAL_API_URL) return process.env.INTERNAL_API_URL.replace(/\/$/, '');
  const pub = process.env.NEXT_PUBLIC_API_URL;
  if (pub && /^https?:\/\//.test(pub)) return pub.replace(/\/$/, '');
  return 'http://localhost:4000/v1';
}

export async function getOrgBrand(): Promise<OrgBrand | null> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') || h.get('host');
    if (!host) return null;
    const res = await fetch(`${apiBase()}/organizations/by-host`, {
      headers: { 'x-forwarded-host': host },
      next: { revalidate: 300 }, // แก้ชื่อ/โลโก้แล้วเห็นผลภายใน ~5 นาที
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const d = (await res.json())?.data;
    if (!d?.found || !d.nameTh) return null;
    return { nameTh: d.nameTh, logoUrl: d.logoUrl || null };
  } catch {
    return null;
  }
}
