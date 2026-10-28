import { Repository } from 'typeorm';

/** ข้อมูลหน่วยงานที่แถบบน/เอกสารประปาใช้ (รวมค่าที่ตั้งเองในประปาแล้ว) */
export type OrgIdentity = {
  id?: string; code?: string; nameTh?: string; nameEn?: string; type?: string;
  subDistrict?: string; district?: string; province?: string;
  phone?: string; address?: string; logoUrl?: string | null;
  hostnames?: string[];
};

/**
 * ค่าที่ตั้งในระบบประปา (water_rate.org_*) ทับค่าจากทะเบียนหน่วยงานหลัก (organizations) ทีละฟิลด์
 * ที่อยู่: ถ้าไม่ได้ตั้งเองจะเป็น undefined → ตัวเรนเดอร์ประกอบ "ต./อ./จ." เองเหมือนเดิม
 * ใช้ repo ไหนก็ได้ (แค่ยืม .query) — ทุก service ประปามี orgRepo อยู่แล้ว
 */
export async function loadOrgIdentity(repo: Repository<any>, orgId: string): Promise<OrgIdentity> {
  const [r] = await repo.query(
    `SELECT o.id, o.code, o.name_th, o.name_en, o.type, o.sub_district, o.district, o.province, o.phone, o.logo_url, o.hostnames,
            w.org_name, w.org_address, w.org_phone, w.org_logo_url
       FROM organizations o
       LEFT JOIN water_rate w ON w.organization_id = o.id
      WHERE o.id = $1 LIMIT 1`, [orgId]);
  if (!r) return {};
  return {
    id: r.id, code: r.code, nameEn: r.name_en, type: r.type,
    nameTh: r.org_name || r.name_th || undefined,
    subDistrict: r.sub_district || undefined, district: r.district || undefined, province: r.province || undefined,
    phone: r.org_phone || r.phone || undefined,
    address: r.org_address || undefined,
    logoUrl: r.org_logo_url || r.logo_url || null,
    hostnames: r.hostnames || undefined,
  };
}
