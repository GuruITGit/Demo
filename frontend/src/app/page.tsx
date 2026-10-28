import { redirect } from 'next/navigation';

/**
 * หน้าแรกของโดเมน (เช่น เปิดจาก Google) → หน้าบริการประชาชน
 * เจ้าหน้าที่เข้าระบบผ่านปุ่ม "สำหรับเจ้าหน้าที่" ในหน้านั้น (ล็อกอินค้างไว้แล้ว = เข้า /dashboard ให้เลย)
 */
export default function Home() {
  redirect('/citizen');
}
