import { redirect } from 'next/navigation';

/** เดิมเป็นพอร์ทัลเช็คค่าน้ำแยก — ตอนนี้รวมเข้าพอร์ทัลประชาชนแล้ว (/citizen/water)
 *  คงเส้นทาง /checkbill ไว้ให้ลิงก์/QR เก่ายังใช้ได้ → ส่งต่อเข้า hub */
export default function CheckbillRedirect() {
  redirect('/citizen/water');
}
