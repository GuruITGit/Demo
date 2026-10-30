/** ลิงก์กลับหน้าหลักบนทุกหน้าค่าแผง/ขยะ/เจ้าหน้าที่ — เดโม่ Vercel กลับไป "/" · ระบบจริงกลับไป /citizen */
/** กล่องติดต่อเจ้าหน้าที่ท้ายหน้า (เบอร์ฉุกเฉิน) — ไม่มีเบอร์ = ไม่แสดง */
function contactFooterHTML() {
  const phone = PAYMENT.contactPhone;
  if (!phone) return '';
  return `<div class="contact-box"><b>ติดต่อเจ้าหน้าที่</b><span>${escapeHTML(PAYMENT.cashPlace)}</span><a href="tel:${escapeHTML(phone.replace(/[^0-9+]/g, ''))}">โทร ${escapeHTML(phone)}</a><small>มีเหตุฉุกเฉินหรือติดปัญหาการชำระ โทรหาเจ้าหน้าที่ได้ตามเวลาทำการ</small></div>`;
}
/** เดโม่: คีย์เทียบชื่อ ตัดคำนำหน้า/ช่องว่าง (ตรงกับ nameKey ฝั่ง backend) */
const demoNameKey = (n: string) => n.replace(/\s+/g, '').replace(/^(นางสาว|น\.ส\.|นาย|นาง|เด็กชาย|เด็กหญิง|คุณ)/, '').toLowerCase();
function homeBackHTML() {
  const demo = location.pathname.includes('/citizen-pay/') || location.hostname.endsWith('vercel.app');
  return `<a class="home-back" href="${demo ? '/' : '/citizen'}">‹ กลับหน้าหลัก</a>`;
}
