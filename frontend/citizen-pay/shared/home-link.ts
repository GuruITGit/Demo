/** ลิงก์กลับหน้าหลักบนทุกหน้าค่าแผง/ขยะ/เจ้าหน้าที่ — เดโม่ Vercel กลับไป "/" · ระบบจริงกลับไป /citizen */
function homeBackHTML() {
  const demo = location.pathname.includes('/citizen-pay/') || location.hostname.endsWith('vercel.app');
  return `<a class="home-back" href="${demo ? '/' : '/citizen'}">‹ กลับหน้าหลัก</a>`;
}
