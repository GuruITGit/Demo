/**
 * ภาพประกอบโมดูลประปา (เจนเวกเตอร์เอง) — line-art เส้นสะอาด + ระบายอ่อน เป็นฉากวัตถุล้วน (ไม่มีคน)
 * ใช้ในการ์ดหน้าหลัก (/prapa) · inline SVG ฝังในแอป → ออฟไลน์ได้ (PWA) · ไม่พึ่งรูปจากเน็ต
 *
 * กติกาวาด: การ์ดใช้ viewBox 160×90 (16:9 ตรงกับ aspect-video → ไม่โดน slice ตัด) · hero ใช้ 240×150 ฉากใหญ่กว่า
 * พื้นเป็น tint-50 + วงกลมนุ่ม tint-100 · เส้นหลักสี 700 ของหมวด · ของหลัก 2-4 ชิ้น/ภาพ ไม่ให้รก
 * สีจับตามความหมาย: เงิน=เขียว/อำพัน · ค้างชำระ=แดง · ปัญหา=ส้ม · แผนที่=เขียว · ทะเบียน=ม่วง · สลิป=คราม · ตั้งค่า=เทา
 */
const ART: Record<string, { vb: string; d: string }> = {
  // hero — มาตรวัดน้ำ + ท่อ + เครื่องพิมพ์สลิป + สมุดจด (sky)
  meter: {
    vb: '0 0 240 150',
    d: `<rect width="240" height="150" fill="#f0f9ff"/><circle cx="120" cy="56" r="54" fill="#e0f2fe"/>
<g stroke="#94a3b8" stroke-width="2" fill="#e2e8f0"><rect x="12" y="52" width="70" height="16" rx="3"/><rect x="158" y="52" width="70" height="16" rx="3"/></g>
<rect x="76" y="30" width="88" height="60" rx="12" fill="#fff" stroke="#0369a1" stroke-width="2.4"/>
<circle cx="120" cy="53" r="17" fill="#f0f9ff" stroke="#0284c7" stroke-width="2"/>
<g stroke="#7dd3fc" stroke-width="2" stroke-linecap="round"><path d="M120 39v3"/><path d="M120 64v3"/><path d="M104 53h3"/><path d="M133 53h3"/></g>
<path d="M120 53l9.5-6.5" stroke="#0c4a6e" stroke-width="2.6" stroke-linecap="round"/><circle cx="120" cy="53" r="2.8" fill="#0c4a6e"/>
<rect x="100" y="74" width="40" height="12" rx="2.5" fill="#0c4a6e"/>
<g fill="#7dd3fc"><rect x="104" y="77" width="6" height="6" rx="1"/><rect x="112" y="77" width="6" height="6" rx="1"/><rect x="120" y="77" width="6" height="6" rx="1"/><rect x="128" y="77" width="6" height="6" rx="1" fill="#f59e0b"/></g>
<rect x="28" y="76" width="30" height="26" rx="2" fill="#fff" stroke="#94a3b8" stroke-width="2"/>
<g fill="#cbd5e1"><rect x="33" y="82" width="20" height="3" rx="1.5"/><rect x="33" y="90" width="13" height="3" rx="1.5"/></g>
<rect x="16" y="104" width="54" height="30" rx="7" fill="#fff" stroke="#0369a1" stroke-width="2.2"/>
<rect x="24" y="100" width="38" height="6" rx="3" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.6"/>
<g transform="rotate(-4 192 121)"><rect x="160" y="102" width="64" height="38" rx="5" fill="#fff" stroke="#0369a1" stroke-width="2.2"/><path d="M175 106v30" stroke="#bae6fd" stroke-width="2"/><g fill="#bae6fd"><rect x="181" y="112" width="34" height="3.4" rx="1.7"/><rect x="181" y="124" width="34" height="3.4" rx="1.7"/></g></g>`,
  },
  // รับชำระเงิน (สำนักงาน) — ลิ้นชักเก็บเงิน + ธนบัตร + ใบเสร็จติ๊กถูก + เหรียญ (green)
  pay: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#f0fdf4"/><circle cx="80" cy="45" r="39" fill="#dcfce7"/>
<rect x="90" y="14" width="42" height="34" rx="3" fill="#fff" stroke="#15803d" stroke-width="2.2"/>
<rect x="96" y="20" width="22" height="4.5" rx="2" fill="#4ade80"/>
<g fill="#bbf7d0"><rect x="96" y="30" width="30" height="3.2" rx="1.6"/><rect x="96" y="37" width="20" height="3.2" rx="1.6"/></g>
<circle cx="126" cy="44" r="8.5" fill="#16a34a"/><path d="M122.2 44.2l2.6 2.6 5-5.4" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<g transform="rotate(-7 48 34)"><rect x="22" y="24" width="52" height="20" rx="2.5" fill="#bbf7d0" stroke="#15803d" stroke-width="2"/><circle cx="48" cy="34" r="6" fill="#fff" stroke="#15803d" stroke-width="1.6"/></g>
<rect x="14" y="46" width="66" height="30" rx="5" fill="#fff" stroke="#15803d" stroke-width="2.2"/><path d="M14 60h66" stroke="#15803d" stroke-width="2"/>
<rect x="34" y="65" width="26" height="6" rx="3" fill="#86efac" stroke="#15803d" stroke-width="1.8"/>
<g stroke="#b45309" stroke-width="1.8"><ellipse cx="112" cy="68" rx="16" ry="5.4" fill="#fcd34d"/><ellipse cx="112" cy="61" rx="16" ry="5.4" fill="#fde68a"/></g>`,
  },
  // รับชำระ (ภาคสนาม) — ถุงเงิน ฿ + เหรียญ + เครื่องพิมพ์พกพา (amber)
  coins: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#fffbeb"/><circle cx="76" cy="46" r="39" fill="#fef3c7"/>
<path d="M52 34c-14 6-22 16-22 28a22 22 0 0 0 44 0c0-12-8-22-22-28z" fill="#fde68a" stroke="#b45309" stroke-width="2.2" stroke-linejoin="round"/>
<rect x="44" y="26" width="16" height="9" rx="3" fill="#fcd34d" stroke="#b45309" stroke-width="2"/>
<path d="M44 26l-3-6M60 26l3-6" stroke="#b45309" stroke-width="2" stroke-linecap="round"/>
<path d="M52 46v17M49 48.5h4.5a2.2 2.2 0 0 1 0 4.4h-3.5a2.2 2.2 0 0 0 0 4.4h4.5" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round"/>
<g stroke="#b45309" stroke-width="1.8"><ellipse cx="100" cy="74" rx="14" ry="4.6" fill="#fcd34d"/><circle cx="112" cy="62" r="10" fill="#fde68a"/></g>
<rect x="112" y="4" width="20" height="24" rx="1.5" fill="#fff" stroke="#cbd5e1" stroke-width="1.8"/>
<g fill="#e2e8f0"><rect x="116" y="9" width="12" height="2.4" rx="1.2"/><rect x="116" y="14" width="8" height="2.4" rx="1.2"/><rect x="116" y="19" width="10" height="2.4" rx="1.2"/></g>
<rect x="104" y="26" width="36" height="22" rx="5" fill="#fff" stroke="#b45309" stroke-width="2.2"/>
<rect x="110" y="24" width="24" height="4" rx="2" fill="#fde68a" stroke="#b45309" stroke-width="1.6"/>
<circle cx="133" cy="40" r="2.4" fill="#f59e0b"/>`,
  },
  // สรุปการเก็บค่าน้ำ — แผงกราฟแท่ง + โดนัท (sky)
  report: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#f0f9ff"/><circle cx="72" cy="45" r="39" fill="#e0f2fe"/>
<rect x="22" y="14" width="76" height="60" rx="5" fill="#fff" stroke="#0369a1" stroke-width="2.2"/>
<path d="M30 66h62" stroke="#bae6fd" stroke-width="2" stroke-linecap="round"/>
<rect x="32" y="52" width="10" height="14" rx="1.5" fill="#7dd3fc"/><rect x="48" y="44" width="10" height="22" rx="1.5" fill="#38bdf8"/><rect x="64" y="48" width="10" height="18" rx="1.5" fill="#0ea5e9"/><rect x="80" y="34" width="10" height="32" rx="1.5" fill="#0284c7"/>
<circle cx="126" cy="40" r="16" fill="none" stroke="#bae6fd" stroke-width="8"/>
<path d="M126 24A16 16 0 1 1 110.8 44.9" fill="none" stroke="#0284c7" stroke-width="8" stroke-linecap="butt"/>`,
  },
  // ทะเบียนผู้ใช้น้ำ — บ้าน + บัตรทะเบียน (violet)
  cust: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#f5f3ff"/><circle cx="72" cy="46" r="39" fill="#ede9fe"/>
<rect x="36" y="44" width="36" height="30" rx="2" fill="#fff" stroke="#6d28d9" stroke-width="2.2"/>
<path d="M30 46l24-20 24 20z" fill="#ddd6fe" stroke="#6d28d9" stroke-width="2.4" stroke-linejoin="round"/>
<rect x="50" y="58" width="9" height="16" rx="1.5" fill="#c4b5fd"/><rect x="62" y="52" width="7" height="7" rx="1" fill="#ede9fe" stroke="#a78bfa" stroke-width="1.6"/>
<rect x="88" y="24" width="50" height="40" rx="4" fill="#fff" stroke="#6d28d9" stroke-width="2.2"/>
<rect x="95" y="31" width="22" height="5" rx="2" fill="#8b5cf6"/>
<g fill="#ddd6fe"><rect x="95" y="42" width="36" height="3.2" rx="1.6"/><rect x="95" y="49" width="26" height="3.2" rx="1.6"/><rect x="95" y="56" width="18" height="3.2" rx="1.6"/></g>`,
  },
  // หนังสือแจ้งค้างชำระ — ซอง + หนังสือ + นาฬิกาเลยกำหนด (rose)
  notice: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#fff1f2"/><circle cx="68" cy="45" r="39" fill="#ffe4e6"/>
<rect x="32" y="10" width="54" height="44" rx="3" fill="#fff" stroke="#be123c" stroke-width="2.2"/>
<rect x="40" y="17" width="24" height="4.5" rx="2" fill="#fb7185"/>
<g fill="#fecdd3"><rect x="40" y="27" width="38" height="3.2" rx="1.6"/><rect x="40" y="34" width="26" height="3.2" rx="1.6"/></g>
<rect x="18" y="40" width="76" height="40" rx="4" fill="#ffe4e6" stroke="#be123c" stroke-width="2.2"/>
<path d="M18 43l38 24 38-24" fill="none" stroke="#be123c" stroke-width="2.2" stroke-linejoin="round"/>
<circle cx="122" cy="58" r="15" fill="#fff" stroke="#e11d48" stroke-width="2.4"/>
<path d="M122 48v10l7 4.5" fill="none" stroke="#e11d48" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  // แบบคำขอ / สัญญา — ฟอร์มมีช่องติ๊ก + ลายเซ็น + ปากกา (teal)
  request: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#f0fdfa"/><circle cx="74" cy="45" r="39" fill="#ccfbf1"/>
<rect x="40" y="10" width="56" height="68" rx="4" fill="#fff" stroke="#0f766e" stroke-width="2.2"/>
<rect x="48" y="18" width="26" height="4.5" rx="2" fill="#14b8a6"/>
<g stroke="#0f766e" stroke-width="1.6" fill="#fff"><rect x="48" y="30" width="6" height="6" rx="1"/><rect x="48" y="41" width="6" height="6" rx="1"/><rect x="48" y="52" width="6" height="6" rx="1"/></g>
<path d="M49.5 33l1.6 1.6 3-3.2M49.5 44l1.6 1.6 3-3.2" fill="none" stroke="#0f766e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
<g fill="#99f6e4"><rect x="58" y="31.5" width="28" height="3" rx="1.5"/><rect x="58" y="42.5" width="22" height="3" rx="1.5"/><rect x="58" y="53.5" width="26" height="3" rx="1.5"/><rect x="48" y="71" width="36" height="1.8" rx="0.9"/></g>
<path d="M50 68q4-7 8 0t8 0t8-4" fill="none" stroke="#0f766e" stroke-width="2" stroke-linecap="round"/>
<g transform="rotate(-40 122 52)"><rect x="104" y="48" width="34" height="8" rx="3" fill="#fff" stroke="#0f766e" stroke-width="2"/><path d="M138 48l8 4-8 4z" fill="#14b8a6" stroke="#0f766e" stroke-width="2" stroke-linejoin="round"/><path d="M110 48v8" stroke="#99f6e4" stroke-width="2"/></g>`,
  },
  // มาตรวัดน้ำที่มีปัญหา — มาตรหน้าปัดร้าว + ป้ายเตือน (orange)
  issue: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#fff7ed"/><circle cx="66" cy="48" r="39" fill="#ffedd5"/>
<g stroke="#94a3b8" stroke-width="2" fill="#e2e8f0"><rect x="14" y="48" width="18" height="10" rx="2"/><rect x="88" y="48" width="18" height="10" rx="2"/></g>
<rect x="30" y="30" width="60" height="42" rx="9" fill="#fff" stroke="#c2410c" stroke-width="2.2"/>
<circle cx="60" cy="48" r="12" fill="#fff7ed" stroke="#f97316" stroke-width="2"/>
<path d="M53 40l4 6-3 4 5 6" fill="none" stroke="#c2410c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M60 48l6-4" stroke="#7c2d12" stroke-width="2.2" stroke-linecap="round"/><circle cx="60" cy="48" r="2.2" fill="#7c2d12"/>
<rect x="46" y="62" width="28" height="7" rx="1.5" fill="#9a3412"/>
<path d="M126 22l16 28h-32z" fill="#fb923c" stroke="#c2410c" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M126 33v8" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="126" cy="45.5" r="1.7" fill="#fff"/>`,
  },
  // แผนที่มาตรวัดน้ำ (GIS) — แผนที่พับ + ถนน + หมุด (green)
  gis: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#f0fdf4"/><circle cx="80" cy="45" r="39" fill="#dcfce7"/>
<path d="M22 22l32-8 32 8 32-8v52l-32 8-32-8-32 8z" fill="#fff" stroke="#15803d" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M54 14v52M86 22v52" stroke="#bbf7d0" stroke-width="1.8"/>
<path d="M30 48q16-12 32 0t34-6" fill="none" stroke="#86efac" stroke-width="3" stroke-linecap="round"/>
<path d="M40 30q10 14 24 22" fill="none" stroke="#bbf7d0" stroke-width="2.5" stroke-linecap="round"/>
<path d="M104 24a11 11 0 0 0-11 11c0 8 11 19 11 19s11-11 11-19a11 11 0 0 0-11-11z" fill="#ef4444" stroke="#b91c1c" stroke-width="2" stroke-linejoin="round"/>
<circle cx="104" cy="35" r="4" fill="#fff"/>`,
  },
  // ตรวจสลิปโอน — มือถือโชว์สลิป QR + ตราติ๊กถูก (indigo)
  slip: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#eef2ff"/><circle cx="78" cy="45" r="39" fill="#e0e7ff"/>
<rect x="52" y="8" width="42" height="74" rx="7" fill="#fff" stroke="#4338ca" stroke-width="2.2"/>
<rect x="57" y="15" width="32" height="54" rx="3" fill="#eef2ff"/><rect x="67" y="10.5" width="12" height="2" rx="1" fill="#c7d2fe"/>
<rect x="61" y="20" width="24" height="40" rx="2" fill="#fff" stroke="#a5b4fc" stroke-width="1.4"/>
<g fill="#4338ca"><rect x="66" y="25" width="5" height="5"/><rect x="75" y="25" width="5" height="5"/><rect x="66" y="34" width="5" height="5"/><rect x="75" y="34" width="5" height="5"/></g>
<g fill="#c7d2fe"><rect x="65" y="45" width="16" height="2.5" rx="1.2"/><rect x="65" y="50" width="10" height="2.5" rx="1.2"/><rect x="68" y="74" width="10" height="2.5" rx="1.2"/></g>
<circle cx="112" cy="60" r="13" fill="#4f46e5" stroke="#fff" stroke-width="2.5"/>
<path d="M106 60l4 4 8-8.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  // ตรวจสอบการชำระเงิน — รายการชำระ + แว่นขยายติ๊กถูก (cyan)
  verifypay: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#ecfeff"/><circle cx="72" cy="45" r="39" fill="#cffafe"/>
<rect x="28" y="12" width="64" height="66" rx="4" fill="#fff" stroke="#0e7490" stroke-width="2.2"/>
<rect x="36" y="18" width="22" height="4" rx="2" fill="#22d3ee"/>
<g fill="#a5f3fc"><circle cx="39.5" cy="31" r="3.5"/><circle cx="39.5" cy="43" r="3.5"/><circle cx="39.5" cy="55" r="3.5"/><circle cx="39.5" cy="67" r="3.5"/></g>
<g fill="#cffafe"><rect x="47" y="29.5" width="36" height="3" rx="1.5"/><rect x="47" y="41.5" width="30" height="3" rx="1.5"/><rect x="47" y="53.5" width="34" height="3" rx="1.5"/><rect x="47" y="65.5" width="26" height="3" rx="1.5"/></g>
<circle cx="112" cy="52" r="15" fill="#fff" stroke="#0e7490" stroke-width="2.6"/>
<path d="M123 63l11 11" stroke="#0e7490" stroke-width="4" stroke-linecap="round"/>
<path d="M105 52l5 5 9-10" fill="none" stroke="#06b6d4" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  // ตั้งค่าระบบ — แผงสไลเดอร์ + เฟือง (slate)
  settings: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#f8fafc"/><circle cx="72" cy="45" r="39" fill="#f1f5f9"/>
<rect x="24" y="18" width="76" height="54" rx="6" fill="#fff" stroke="#475569" stroke-width="2.2"/>
<g stroke="#cbd5e1" stroke-width="3" stroke-linecap="round"><path d="M34 32h56"/><path d="M34 45h56"/><path d="M34 58h56"/></g>
<g stroke="#64748b" stroke-width="3" stroke-linecap="round"><path d="M34 32h38"/><path d="M34 45h16"/><path d="M34 58h48"/></g>
<g fill="#fff" stroke="#475569" stroke-width="2"><circle cx="72" cy="32" r="4.5"/><circle cx="50" cy="45" r="4.5"/><circle cx="82" cy="58" r="4.5"/></g>
<g fill="#cbd5e1" stroke="#475569" stroke-width="2"><rect x="-3" y="-16" width="6" height="7" rx="1" transform="translate(126 56)"/><rect x="-3" y="-16" width="6" height="7" rx="1" transform="translate(126 56) rotate(45)"/><rect x="-3" y="-16" width="6" height="7" rx="1" transform="translate(126 56) rotate(90)"/><rect x="-3" y="-16" width="6" height="7" rx="1" transform="translate(126 56) rotate(135)"/><rect x="-3" y="-16" width="6" height="7" rx="1" transform="translate(126 56) rotate(180)"/><rect x="-3" y="-16" width="6" height="7" rx="1" transform="translate(126 56) rotate(225)"/><rect x="-3" y="-16" width="6" height="7" rx="1" transform="translate(126 56) rotate(270)"/><rect x="-3" y="-16" width="6" height="7" rx="1" transform="translate(126 56) rotate(315)"/></g>
<circle cx="126" cy="56" r="11" fill="#e2e8f0" stroke="#475569" stroke-width="2.2"/><circle cx="126" cy="56" r="4.5" fill="#f8fafc" stroke="#475569" stroke-width="2"/>`,
  },
  // รอบบิล / รอบส่งเงิน — ปฏิทินวงวันปิดรอบ + กองเหรียญ (amber)
  calendar: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#fffbeb"/><circle cx="72" cy="45" r="39" fill="#fef3c7"/>
<rect x="34" y="16" width="66" height="60" rx="5" fill="#fff" stroke="#b45309" stroke-width="2.2"/>
<path d="M34 21a5 5 0 0 1 5-5h56a5 5 0 0 1 5 5v9H34z" fill="#fcd34d" stroke="#b45309" stroke-width="2.2"/>
<g stroke="#b45309" stroke-width="2.4" stroke-linecap="round"><path d="M50 11v9"/><path d="M84 11v9"/></g>
<g fill="#fde68a"><rect x="42" y="38" width="9" height="7" rx="1.5"/><rect x="55" y="38" width="9" height="7" rx="1.5"/><rect x="68" y="38" width="9" height="7" rx="1.5"/><rect x="81" y="38" width="9" height="7" rx="1.5"/><rect x="42" y="50" width="9" height="7" rx="1.5"/><rect x="55" y="50" width="9" height="7" rx="1.5"/><rect x="81" y="50" width="9" height="7" rx="1.5"/><rect x="42" y="62" width="9" height="7" rx="1.5"/><rect x="55" y="62" width="9" height="7" rx="1.5"/></g>
<circle cx="72.5" cy="53.5" r="7.5" fill="none" stroke="#dc2626" stroke-width="2.2"/>
<g stroke="#b45309" stroke-width="1.8"><ellipse cx="124" cy="70" rx="14" ry="4.8" fill="#fcd34d"/><ellipse cx="124" cy="63" rx="14" ry="4.8" fill="#fde68a"/><ellipse cx="124" cy="56" rx="14" ry="4.8" fill="#fcd34d"/></g>`,
  },
  // กระทบยอดจากธนาคาร — อาคารธนาคาร + ลูกศรสองทาง + รายการติ๊กถูก (teal)
  bank: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#f0fdfa"/><circle cx="74" cy="45" r="39" fill="#ccfbf1"/>
<path d="M22 34l30-18 30 18z" fill="#99f6e4" stroke="#0f766e" stroke-width="2.2" stroke-linejoin="round"/>
<circle cx="52" cy="27" r="3.2" fill="#fff" stroke="#0f766e" stroke-width="1.6"/>
<rect x="24" y="34" width="56" height="5" rx="1" fill="#fff" stroke="#0f766e" stroke-width="2"/>
<g fill="#fff" stroke="#0f766e" stroke-width="2"><rect x="29" y="40" width="7" height="26"/><rect x="42" y="40" width="7" height="26"/><rect x="55" y="40" width="7" height="26"/><rect x="68" y="40" width="7" height="26"/></g>
<rect x="20" y="66" width="64" height="8" rx="1.5" fill="#99f6e4" stroke="#0f766e" stroke-width="2.2"/>
<g fill="none" stroke="#14b8a6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M88 38h16l-4-4"/><path d="M104 48H88l4 4"/></g>
<rect x="110" y="22" width="34" height="46" rx="3" fill="#fff" stroke="#0f766e" stroke-width="2.2"/>
<g fill="#99f6e4"><rect x="116" y="30" width="16" height="3" rx="1.5"/><rect x="116" y="40" width="20" height="3" rx="1.5"/><rect x="116" y="50" width="14" height="3" rx="1.5"/></g>
<circle cx="138" cy="64" r="8" fill="#0d9488" stroke="#fff" stroke-width="2"/><path d="M134.5 64l2.4 2.4 4.6-5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  // รายงาน ป.17 / ป.32 — ตารางทะเบียนพร้อมหัวตาราง + ตราประทับ (blue)
  ledger: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#eff6ff"/><circle cx="70" cy="45" r="39" fill="#dbeafe"/>
<rect x="36" y="14" width="64" height="66" rx="4" fill="#fff" stroke="#1d4ed8" stroke-width="2.2" transform="rotate(4 68 47)"/>
<rect x="30" y="10" width="64" height="66" rx="4" fill="#fff" stroke="#1d4ed8" stroke-width="2.2"/>
<rect x="30" y="10" width="64" height="12" rx="4" fill="#bfdbfe" stroke="#1d4ed8" stroke-width="2.2"/>
<text x="38" y="19.5" font-size="8" font-weight="700" fill="#1e40af" font-family="sans-serif">ป.17</text>
<g stroke="#bfdbfe" stroke-width="1.6"><path d="M30 34h64"/><path d="M30 44h64"/><path d="M30 54h64"/><path d="M30 64h64"/><path d="M48 22v54"/><path d="M74 22v54"/></g>
<g fill="#60a5fa"><rect x="34" y="27" width="10" height="3" rx="1.5"/><rect x="52" y="27" width="16" height="3" rx="1.5"/><rect x="78" y="27" width="11" height="3" rx="1.5"/><rect x="34" y="37" width="8" height="3" rx="1.5"/><rect x="52" y="37" width="18" height="3" rx="1.5"/><rect x="78" y="37" width="9" height="3" rx="1.5"/><rect x="34" y="47" width="10" height="3" rx="1.5"/><rect x="52" y="47" width="14" height="3" rx="1.5"/><rect x="78" y="47" width="12" height="3" rx="1.5"/></g>
<circle cx="124" cy="54" r="16" fill="#fff" stroke="#2563eb" stroke-width="2.2" stroke-dasharray="4 2.5"/>
<circle cx="124" cy="54" r="10" fill="#dbeafe" stroke="#2563eb" stroke-width="1.8"/>
<path d="M119 54l3.5 3.5 6.5-7" fill="none" stroke="#1d4ed8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  // ตรวจสอบจดมิเตอร์ก่อนปิดรอบ — คลิปบอร์ดมีหน้าปัดมาตร + ติ๊กถูก (sky)
  verifymeter: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#f0f9ff"/><circle cx="72" cy="45" r="39" fill="#e0f2fe"/>
<rect x="38" y="14" width="56" height="66" rx="5" fill="#fff" stroke="#0369a1" stroke-width="2.2"/>
<rect x="52" y="9" width="28" height="10" rx="3" fill="#bae6fd" stroke="#0369a1" stroke-width="2"/>
<circle cx="66" cy="38" r="12" fill="#f0f9ff" stroke="#0284c7" stroke-width="2"/>
<g stroke="#7dd3fc" stroke-width="1.8" stroke-linecap="round"><path d="M66 28v2.4"/><path d="M56 38h2.4"/><path d="M73.6 38H76"/></g>
<path d="M66 38l6.5-4.5" stroke="#0c4a6e" stroke-width="2.2" stroke-linecap="round"/><circle cx="66" cy="38" r="2.2" fill="#0c4a6e"/>
<g fill="#bae6fd"><rect x="46" y="57" width="40" height="3.2" rx="1.6"/><rect x="46" y="64" width="30" height="3.2" rx="1.6"/><rect x="46" y="71" width="34" height="3.2" rx="1.6"/></g>
<circle cx="116" cy="56" r="14" fill="#0ea5e9" stroke="#fff" stroke-width="2.5"/>
<path d="M109.5 56l4.3 4.3 8.2-8.8" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  // ตั้งค่าเครื่องพิมพ์ — เครื่องพิมพ์ความร้อน + กระดาษสลิป + สัญญาณบลูทูธ (slate)
  printer: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#f8fafc"/><circle cx="76" cy="45" r="39" fill="#f1f5f9"/>
<rect x="56" y="10" width="40" height="26" rx="2" fill="#fff" stroke="#94a3b8" stroke-width="2"/>
<g fill="#e2e8f0"><rect x="62" y="16" width="24" height="3" rx="1.5"/><rect x="62" y="23" width="16" height="3" rx="1.5"/></g>
<rect x="38" y="32" width="76" height="32" rx="7" fill="#fff" stroke="#475569" stroke-width="2.2"/>
<rect x="50" y="38" width="52" height="5" rx="2.5" fill="#cbd5e1" stroke="#475569" stroke-width="1.6"/>
<circle cx="102" cy="54" r="3" fill="#22c55e"/><rect x="46" y="51" width="20" height="5" rx="2.5" fill="#e2e8f0"/>
<path d="M56 64h40v18l-5-3-5 3-5-3-5 3-5-3-5 3-5-3-5 3z" fill="#fff" stroke="#475569" stroke-width="2" stroke-linejoin="round"/>
<g fill="#cbd5e1"><rect x="62" y="68" width="22" height="2.6" rx="1.3"/><rect x="62" y="73" width="14" height="2.6" rx="1.3"/></g>
<g fill="none" stroke="#0ea5e9" stroke-width="2.4" stroke-linecap="round"><path d="M124 30a10 10 0 0 1 0 14"/><path d="M130 25a17 17 0 0 1 0 24"/></g>`,
  },
  // ข้อมูลพื้นฐาน — ชั้นข้อมูลซ้อน 3 ชั้น + ป้ายรายการ (slate/sky)
  layers: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#f8fafc"/><circle cx="72" cy="45" r="39" fill="#f1f5f9"/>
<path d="M30 58l36 16 36-16-36-16z" fill="#e2e8f0" stroke="#475569" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M30 45l36 16 36-16-36-16z" fill="#f1f5f9" stroke="#475569" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M30 32l36 16 36-16-36-16z" fill="#bae6fd" stroke="#0369a1" stroke-width="2.2" stroke-linejoin="round"/>
<rect x="112" y="22" width="34" height="44" rx="4" fill="#fff" stroke="#475569" stroke-width="2.2"/>
<g fill="#38bdf8"><circle cx="119" cy="32" r="2.6"/><circle cx="119" cy="44" r="2.6"/><circle cx="119" cy="56" r="2.6"/></g>
<g fill="#cbd5e1"><rect x="125" y="30.5" width="15" height="3" rx="1.5"/><rect x="125" y="42.5" width="11" height="3" rx="1.5"/><rect x="125" y="54.5" width="13" height="3" rx="1.5"/></g>`,
  },
  // จัดการผู้ใช้ / สิทธิ์ — เจ้าหน้าที่ + กุญแจสิทธิ์ (slate/amber)
  admin: {
    vb: '0 0 160 90',
    d: `<rect width="160" height="90" fill="#f8fafc"/><circle cx="72" cy="46" r="39" fill="#f1f5f9"/>
<path d="M38 78a26 22 0 0 1 52 0z" fill="#e2e8f0" stroke="#475569" stroke-width="2.2" stroke-linejoin="round"/>
<path d="M58 57l6 8 6-8" fill="#fff" stroke="#475569" stroke-width="1.8" stroke-linejoin="round"/>
<circle cx="64" cy="36" r="14" fill="#fff" stroke="#475569" stroke-width="2.2"/>
<path d="M50.5 33c3-9 23-10 27 0" fill="#94a3b8" stroke="#475569" stroke-width="2" stroke-linejoin="round"/>
<circle cx="110" cy="44" r="10" fill="#fde68a" stroke="#b45309" stroke-width="2.2"/><circle cx="110" cy="44" r="3.6" fill="#fff" stroke="#b45309" stroke-width="1.8"/>
<path d="M120 44h24M136 44v7M142 44v5" fill="none" stroke="#b45309" stroke-width="3" stroke-linecap="round"/>
<rect x="96" y="60" width="44" height="14" rx="7" fill="#fff" stroke="#475569" stroke-width="2"/>
<circle cx="104" cy="67" r="3" fill="#22c55e"/><rect x="111" y="65.5" width="22" height="3" rx="1.5" fill="#cbd5e1"/>`,
  },
};

export type IllusName = keyof typeof ART;

export function WaterIllus({ name, className = 'h-full w-full' }: { name: IllusName; className?: string }) {
  const art = ART[name];
  return (
    <svg
      viewBox={art.vb}
      className={className}
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: art.d }}
    />
  );
}
