/**
 * ภาพประกอบบริการบนหน้าแรกประชาชน (วาดเวกเตอร์เอง สไตล์แอปทางรัฐ) — ฉากวัตถุสีพาสเทล ไม่มีเส้นขอบ ใช้เงาสองโทนแทน
 * viewBox 120×100 · วางมุมขวาล่างของการ์ด · inline SVG → ไม่พึ่งรูปจากเน็ต
 */
const ART = {
  // ค่าน้ำประปา — ก๊อกน้ำ + หยดน้ำลงแก้ว + เหรียญบาท
  water: `<ellipse cx="66" cy="96" rx="40" ry="4" fill="#0c4a6e" opacity=".08"/>
<rect x="6" y="20" width="12" height="30" rx="4" fill="#94a3b8"/><rect x="6" y="20" width="5" height="30" rx="2.5" fill="#cbd5e1"/>
<rect x="14" y="27" width="56" height="16" rx="8" fill="#38bdf8"/><rect x="14" y="35" width="56" height="8" rx="4" fill="#0ea5e9"/>
<rect x="56" y="33" width="16" height="24" rx="7" fill="#38bdf8"/><rect x="64" y="33" width="8" height="24" rx="4" fill="#0ea5e9"/>
<rect x="37" y="13" width="7" height="16" rx="2" fill="#0284c7"/><rect x="26" y="8" width="29" height="8" rx="4" fill="#0369a1"/>
<path d="M64 60c0 0-5 6-5 9a5 5 0 0 0 10 0c0-3-5-9-5-9z" fill="#0ea5e9"/>
<path d="M48 72h32l-4 24h-24z" fill="#e0f2fe"/><path d="M50 82h28l-2.4 14h-23.2z" fill="#7dd3fc"/><path d="M52 74h3l-1.8 18h-2z" fill="#fff" opacity=".7"/>
<circle cx="100" cy="76" r="13" fill="#f59e0b"/><circle cx="100" cy="74.5" r="11.5" fill="#fbbf24"/>
<path d="M97 68v13M96 69.5h4.6a2.6 2.6 0 0 1 0 5.2h-4.6h5.2a2.6 2.6 0 0 1 0 5.2h-5.2" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,

  // ค่าเก็บขยะ — ถังขยะล้อลาก + ถุงขยะ
  garbage: `<ellipse cx="64" cy="96" rx="44" ry="4" fill="#064e3b" opacity=".08"/>
<path d="M30 34h50l-4.5 56h-41z" fill="#22c55e"/><path d="M66 34h14l-4.5 56h-11z" fill="#16a34a"/>
<rect x="26" y="25" width="58" height="11" rx="4" fill="#15803d"/><rect x="46" y="19" width="18" height="8" rx="3.5" fill="#166534"/>
<g fill="#bbf7d0"><rect x="38" y="44" width="4" height="36" rx="2"/><rect x="53" y="44" width="4" height="36" rx="2"/></g>
<circle cx="40" cy="92" r="6" fill="#334155"/><circle cx="40" cy="92" r="2.4" fill="#94a3b8"/>
<circle cx="72" cy="92" r="6" fill="#334155"/><circle cx="72" cy="92" r="2.4" fill="#94a3b8"/>
<path d="M88 95c-5-13 0-25 11-27 11 2 16 14 11 27z" fill="#64748b"/><path d="M101 68c6 3 9 13 7 27h-6c2-12 1-21-1-27z" fill="#475569"/>
<path d="M95 69l4-8 5 8z" fill="#475569"/>`,

  // ค่าแผงตลาด — แผงลอยหลังคาลายทาง + ผลไม้
  market: `<ellipse cx="60" cy="96" rx="50" ry="4" fill="#78350f" opacity=".08"/>
<rect x="18" y="36" width="5" height="58" rx="2" fill="#92400e"/><rect x="97" y="36" width="5" height="58" rx="2" fill="#92400e"/>
<path d="M10 24L22 10h76l12 14z" fill="#ea580c"/>
<g><rect x="10" y="24" width="100" height="12" fill="#fff"/>
<rect x="10" y="24" width="12.5" height="12" fill="#ef4444"/><rect x="35" y="24" width="12.5" height="12" fill="#ef4444"/><rect x="60" y="24" width="12.5" height="12" fill="#ef4444"/><rect x="85" y="24" width="12.5" height="12" fill="#ef4444"/></g>
<g fill="#ef4444"><circle cx="16.25" cy="36" r="6.25"/><circle cx="41.25" cy="36" r="6.25"/><circle cx="66.25" cy="36" r="6.25"/><circle cx="91.25" cy="36" r="6.25"/></g>
<g fill="#fff"><circle cx="28.75" cy="36" r="6.25"/><circle cx="53.75" cy="36" r="6.25"/><circle cx="78.75" cy="36" r="6.25"/><circle cx="103.75" cy="36" r="6.25"/></g>
<circle cx="31" cy="61" r="7" fill="#ef4444"/><circle cx="46" cy="62" r="6" fill="#f97316"/><circle cx="61" cy="60" r="8" fill="#84cc16"/><circle cx="77" cy="61" r="7" fill="#ef4444"/><circle cx="91" cy="62" r="6" fill="#facc15"/>
<g fill="#16a34a"><path d="M31 54l3-4 1 4z"/><path d="M77 54l3-4 1 4z"/></g>
<rect x="14" y="67" width="92" height="27" rx="3" fill="#fbbf24"/><rect x="14" y="76" width="92" height="18" rx="2" fill="#f59e0b"/>
<rect x="46" y="80" width="28" height="9" rx="2" fill="#fff" opacity=".85"/>`,

  // เงินฌาปนกิจสงเคราะห์ — ดอกบัวชมพูบนพานทอง + เทียน
  lotus: `<ellipse cx="58" cy="96" rx="40" ry="4" fill="#4c1d95" opacity=".08"/>
<path d="M40 84h36l-6 8h-24z" fill="#a16207"/><ellipse cx="58" cy="84" rx="26" ry="5" fill="#eab308"/>
<path d="M58 82C38 82 22 72 20 60c16 0 30 8 38 22z" fill="#f472b6"/><path d="M58 82C78 82 94 72 96 60c-16 0-30 8-38 22z" fill="#ec4899"/>
<path d="M58 80C42 76 32 62 32 48c12 4 22 14 26 32z" fill="#fbcfe8"/><path d="M58 80C74 76 84 62 84 48c-12 4-22 14-26 32z" fill="#f9a8d4"/>
<path d="M58 30c10 12 12 34 0 50-12-16-10-38 0-50z" fill="#fff"/><path d="M58 30c10 12 12 34 0 50z" fill="#fce7f3"/>
<rect x="100" y="56" width="7" height="34" rx="2" fill="#fde68a"/><rect x="104" y="56" width="3" height="34" rx="1.5" fill="#fcd34d"/>
<path d="M103.5 42c0 0-5 6-5 9.5a5 5 0 0 0 10 0c0-3.5-5-9.5-5-9.5z" fill="#f59e0b"/><path d="M103.5 47c0 0-2.4 3-2.4 4.8a2.4 2.4 0 0 0 4.8 0c0-1.8-2.4-4.8-2.4-4.8z" fill="#fef3c7"/>`,

  // แจ้งเหตุ / ร้องเรียน — โทรโข่ง + กล่องข้อความ "!"
  megaphone: `<ellipse cx="56" cy="96" rx="40" ry="4" fill="#1e3a8a" opacity=".08"/>
<rect x="38" y="62" width="9" height="24" rx="3.5" fill="#1e3a8a" transform="rotate(-12 42 74)"/>
<rect x="16" y="46" width="14" height="22" rx="4" fill="#1e40af"/>
<path d="M28 46l40-18v58L28 68z" fill="#3b82f6"/><path d="M28 57l40-6v35L28 68z" fill="#2563eb"/>
<ellipse cx="68" cy="57" rx="8" ry="29" fill="#1d4ed8"/><ellipse cx="68" cy="57" rx="4.5" ry="22" fill="#93c5fd"/>
<g fill="none" stroke="#60a5fa" stroke-width="3.5" stroke-linecap="round"><path d="M84 46c4 7 4 15 0 22"/><path d="M93 40c7 11 7 23 0 34"/></g>
<path d="M82 8h28a6 6 0 0 1 6 6v14a6 6 0 0 1-6 6h-18l-7 6v-6h-3a6 6 0 0 1-6-6v-14a6 6 0 0 1 6-6z" fill="#fff"/>
<rect x="94.5" y="12" width="5" height="12" rx="2.5" fill="#ef4444"/><circle cx="97" cy="29" r="2.6" fill="#ef4444"/>`,

  // ขอรถน้ำ / รถบริการ — รถบรรทุกน้ำ
  truck: `<ellipse cx="60" cy="96" rx="52" ry="4" fill="#164e63" opacity=".08"/>
<rect x="8" y="34" width="68" height="36" rx="18" fill="#22d3ee"/><path d="M8 52h68v0a18 18 0 0 1-18 18H26A18 18 0 0 1 8 52z" fill="#06b6d4"/>
<path d="M42 40c0 0-7 8-7 12.5a7 7 0 0 0 14 0c0-4.5-7-12.5-7-12.5z" fill="#fff"/>
<path d="M76 42h20l14 16v14H76z" fill="#0891b2"/><path d="M81 47h13l9 10H81z" fill="#cffafe"/>
<rect x="6" y="68" width="106" height="9" rx="2" fill="#334155"/>
<circle cx="28" cy="82" r="10" fill="#1e293b"/><circle cx="28" cy="82" r="4.4" fill="#94a3b8"/>
<circle cx="92" cy="82" r="10" fill="#1e293b"/><circle cx="92" cy="82" r="4.4" fill="#94a3b8"/>
<rect x="104" y="62" width="6" height="4" rx="1.5" fill="#fde68a"/>`,

  // ขอยืมเต็นท์ / สถานที่ — เต็นท์งาน + โต๊ะ เก้าอี้
  tent: `<ellipse cx="60" cy="96" rx="50" ry="4" fill="#312e81" opacity=".08"/>
<rect x="17" y="50" width="4" height="44" rx="2" fill="#475569"/><rect x="99" y="50" width="4" height="44" rx="2" fill="#475569"/>
<path d="M12 46L60 16l48 30z" fill="#818cf8"/><path d="M60 16l48 30H60z" fill="#6366f1"/>
<rect x="12" y="44" width="96" height="7" fill="#4f46e5"/>
<g fill="#4f46e5"><circle cx="18" cy="51" r="6"/><circle cx="42" cy="51" r="6"/><circle cx="66" cy="51" r="6"/><circle cx="90" cy="51" r="6"/></g>
<g fill="#fff"><circle cx="30" cy="51" r="6"/><circle cx="54" cy="51" r="6"/><circle cx="78" cy="51" r="6"/><circle cx="102" cy="51" r="6"/></g>
<rect x="38" y="70" width="44" height="6" rx="2" fill="#e0e7ff"/><rect x="42" y="76" width="3.5" height="18" fill="#a5b4fc"/><rect x="74.5" y="76" width="3.5" height="18" fill="#a5b4fc"/>
<rect x="24" y="68" width="10" height="14" rx="2" fill="#a5b4fc"/><rect x="24" y="80" width="13" height="4" rx="1.5" fill="#818cf8"/><rect x="25" y="84" width="2.6" height="10" fill="#818cf8"/><rect x="33.5" y="84" width="2.6" height="10" fill="#818cf8"/>
<rect x="86" y="68" width="10" height="14" rx="2" fill="#a5b4fc"/><rect x="83" y="80" width="13" height="4" rx="1.5" fill="#818cf8"/><rect x="84" y="84" width="2.6" height="10" fill="#818cf8"/><rect x="92.5" y="84" width="2.6" height="10" fill="#818cf8"/>`,

  // ลงทะเบียนเบี้ยยังชีพ — กระเป๋าสตางค์ + เหรียญ + หัวใจ
  wallet: `<ellipse cx="56" cy="96" rx="44" ry="4" fill="#831843" opacity=".08"/>
<g stroke="#b45309" stroke-width="1.6"><ellipse cx="40" cy="40" rx="15" ry="5" fill="#fbbf24"/><ellipse cx="40" cy="34" rx="15" ry="5" fill="#fcd34d"/><ellipse cx="40" cy="28" rx="15" ry="5" fill="#fde68a"/></g>
<rect x="14" y="44" width="74" height="48" rx="9" fill="#ec4899"/><rect x="14" y="44" width="74" height="12" rx="6" fill="#f472b6"/>
<rect x="60" y="58" width="34" height="22" rx="7" fill="#db2777"/><circle cx="72" cy="69" r="4.5" fill="#fce7f3"/>
<path d="M100 22c-3-6-12-5-12 2 0 6 8 10 12 14 4-4 12-8 12-14 0-7-9-8-12-2z" fill="#f43f5e"/><path d="M93 22c1.5-2 4-2 5 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>`,

  // ขอใช้รถดับเพลิง — รถแดง + บันไดบนหลังคา + ม้วนสายฉีด
  fire: `<ellipse cx="60" cy="96" rx="52" ry="4" fill="#7f1d1d" opacity=".08"/>
<rect x="12" y="27" width="60" height="9" rx="2" fill="none" stroke="#cbd5e1" stroke-width="2.4"/>
<g stroke="#cbd5e1" stroke-width="2.2"><path d="M22 27v9M32 27v9M42 27v9M52 27v9M62 27v9"/></g>
<rect x="8" y="38" width="72" height="32" rx="4" fill="#ef4444"/><rect x="8" y="58" width="72" height="4" fill="#fde68a"/>
<circle cx="30" cy="48" r="6.5" fill="#b91c1c"/><circle cx="30" cy="48" r="2.6" fill="#fca5a5"/>
<rect x="46" y="43" width="22" height="10" rx="2" fill="#fecaca"/>
<path d="M80 40h15l15 16v14H80z" fill="#dc2626"/><path d="M85 45h9l11 11H85z" fill="#fee2e2"/>
<rect x="84" y="33" width="12" height="5" rx="2" fill="#60a5fa"/>
<rect x="6" y="68" width="106" height="9" rx="2" fill="#334155"/>
<circle cx="28" cy="82" r="10" fill="#1e293b"/><circle cx="28" cy="82" r="4.4" fill="#94a3b8"/>
<circle cx="92" cy="82" r="10" fill="#1e293b"/><circle cx="92" cy="82" r="4.4" fill="#94a3b8"/>
<rect x="104" y="62" width="6" height="4" rx="1.5" fill="#fde68a"/>`,

  // ขอใช้รถส่งผู้ป่วย — รถพยาบาลสีขาว กากบาทแดง ไฟไซเรน
  ambulance: `<ellipse cx="60" cy="96" rx="52" ry="4" fill="#0f172a" opacity=".08"/>
<rect x="8" y="34" width="74" height="38" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
<path d="M82 42h13l15 14v16H82z" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5"/><path d="M86 46h8l12 10H86z" fill="#bae6fd"/>
<rect x="8" y="60" width="102" height="5" fill="#ef4444"/>
<rect x="38.5" y="38" width="7" height="18" rx="1.5" fill="#ef4444"/><rect x="33" y="43.5" width="18" height="7" rx="1.5" fill="#ef4444"/>
<rect x="60" y="29" width="7" height="5" rx="2" fill="#ef4444"/><rect x="67" y="29" width="7" height="5" rx="2" fill="#3b82f6"/>
<rect x="6" y="70" width="106" height="7" rx="2" fill="#475569"/>
<circle cx="28" cy="82" r="10" fill="#1e293b"/><circle cx="28" cy="82" r="4.4" fill="#94a3b8"/>
<circle cx="92" cy="82" r="10" fill="#1e293b"/><circle cx="92" cy="82" r="4.4" fill="#94a3b8"/>
<rect x="104" y="62" width="6" height="4" rx="1.5" fill="#fde68a"/>`,

  // ขอใช้รถกู้ภัย — กระบะส้ม ไฟสัญญาณบนหลังคา อุปกรณ์ท้ายกระบะ
  rescue: `<ellipse cx="60" cy="96" rx="52" ry="4" fill="#7c2d12" opacity=".08"/>
<rect x="16" y="40" width="18" height="10" rx="2" fill="#fde68a"/><rect x="38" y="42" width="16" height="8" rx="2" fill="#fdba74"/>
<rect x="8" y="48" width="58" height="22" rx="3" fill="#f97316"/>
<path d="M64 36h25l19 18v16H64z" fill="#ea580c"/><path d="M70 41h17l13 13H70z" fill="#ffedd5"/>
<rect x="68" y="30" width="11" height="5" rx="2" fill="#ef4444"/><rect x="79" y="30" width="11" height="5" rx="2" fill="#3b82f6"/>
<rect x="8" y="59" width="100" height="4" fill="#fff" opacity=".85"/>
<rect x="6" y="68" width="106" height="9" rx="2" fill="#334155"/>
<circle cx="28" cy="82" r="10" fill="#1e293b"/><circle cx="28" cy="82" r="4.4" fill="#94a3b8"/>
<circle cx="92" cy="82" r="10" fill="#1e293b"/><circle cx="92" cy="82" r="4.4" fill="#94a3b8"/>
<rect x="104" y="62" width="6" height="4" rx="1.5" fill="#fde68a"/>`,
} as const;

export type ServiceArt = keyof typeof ART;

export function ServiceIllus({ name, className = '' }: { name: ServiceArt; className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden="true" xmlns="http://www.w3.org/2000/svg"
      dangerouslySetInnerHTML={{ __html: ART[name] }} />
  );
}
