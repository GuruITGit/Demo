import type { Metadata } from 'next';
import HubShell from './hub-shell';

/**
 * คอนโซลผู้ดูแลระบบ (/hub) — เว็บของ "เจ้าของระบบ/ผู้ขาย" แยกขาดจากเว็บสารบรรณของ อบต.
 * ไม่มีเมนูสารบรรณ/บุคลากร/ประปา ของ อบต. เลย · เข้าได้เฉพาะบัญชี SUPER_ADMIN
 * ผูกโดเมนของตัวเองได้ภายหลัง (เช่น admin.<โดเมนบริษัท>) โดยไม่ต้องแก้โค้ด
 */
export const metadata: Metadata = {
  title: 'คอนโซลผู้ดูแลระบบ · Smart SAO',
  description: 'จัดการทุก อบต. ในระบบ — เปิดหน่วยงานใหม่ แก้ข้อมูล โดเมน โมดูล และสิทธิ์',
  // คอนโซลผู้ขาย = แบรนด์ Smart SAO เสมอ (ไม่ใช้โลโก้ อบต. ตามโดเมนเหมือนหน้าอื่น)
  icons: { icon: '/brand/smart-sao-icon.png', apple: '/brand/smart-sao-apple.png' },
};

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return <HubShell>{children}</HubShell>;
}
