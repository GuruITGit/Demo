import { getOrgBrand, FALLBACK_ICON } from '@/lib/org-brand.server';

/**
 * /favicon.ico — บางที่ (Google, บุ๊กมาร์ก, เบราว์เซอร์เก่า) ขอไฟล์นี้ตรง ๆ ไม่อ่าน <link rel="icon">
 * → ส่งต่อไปโลโก้ อบต. ตามโดเมน (ตั้งที่ /hub หรือ /settings) หรือไอคอน Smart SAO สำรอง
 * ใช้ Location แบบ relative — หลัง nginx req.url เป็นที่อยู่ภายใน container ไม่ใช่โดเมนจริง
 */
export async function GET() {
  const brand = await getOrgBrand();
  return new Response(null, {
    status: 302,
    headers: { Location: brand?.logoUrl || FALLBACK_ICON, 'Cache-Control': 'public, max-age=3600' },
  });
}
