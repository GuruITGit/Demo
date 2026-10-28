import type { Metadata } from 'next';
import PrapaShell from './prapa-shell';

/**
 * ระบบประปา — ชื่อแท็บ/ไอคอนแยกจากระบบหลัก (Smart SAO) ให้เห็นชัดว่าเปิดเว็บไหนอยู่
 * ไอคอนแท็บ = ไฟล์ `icon.png` / `apple-icon.png` ในโฟลเดอร์นี้ (โลโก้หยดน้ำ) ระบุใน metadata.icons
 */
export const metadata: Metadata = {
  title: 'ระบบประปา',
  description: 'จดมิเตอร์ · เก็บค่าน้ำ · ออกบิล · รายงาน',
  // ระบุตรงๆ — root ใช้ generateMetadata (โลโก้ อบต.) ซึ่งทับไฟล์ icon.png ของโฟลเดอร์นี้
  icons: { icon: '/prapa/icon.png', apple: '/prapa/apple-icon.png' },
};

export default function PrapaLayout({ children }: { children: React.ReactNode }) {
  return <PrapaShell>{children}</PrapaShell>;
}
