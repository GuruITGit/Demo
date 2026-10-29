/** บัญชีทดลองของเดโม่ (รหัสผ่านเดียวกันทุกบัญชี) — ใช้ในหน้าเข้าสู่ระบบและปุ่มสลับบัญชี */
export const DEMO_PASSWORD = 'demo1234';

export const DEMO_LOGINS: { username: string; label: string; hint: string }[] = [
  { username: 'admin', label: 'ผู้ดูแลระบบ', hint: 'เห็นและจัดการได้ทุกเมนู' },
  { username: 'mayor', label: 'นายก อบต.', hint: 'ลงนามปิดงาน · ดูภาพรวมผู้บริหาร' },
  { username: 'clerk', label: 'ปลัด อบต.', hint: 'เซ็นส่งนายก · รายงานสรุป' },
  { username: 'head_admin', label: 'หัวหน้าสำนักปลัด', hint: 'รับเรื่อง ส่งต่อปลัด' },
  { username: 'off_civil', label: 'เจ้าหน้าที่กองช่าง', hint: 'ลงรับสารบรรณ' },
  { username: 'off_revenue', label: 'เจ้าหน้าที่จัดเก็บรายได้', hint: 'รับชำระค่าแผง/ค่าขยะ' },
];
