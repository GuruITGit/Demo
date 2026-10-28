// ไอคอนเส้นบางแบบเดียวกับแถบเมนูของหน้าประชาชน (viewBox 24 · stroke currentColor) — ไม่ใช้ emoji
const STAFF_ICON_PATHS: Record<string, string> = {
  overview: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  stall: '<path d="M3 9h18l-1.5-5h-15z"/><path d="M5 9v11h14V9"/><path d="M9 20v-5h6v5"/>',
  payment: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v5M17.5 9.5v5"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5 10 17 19 7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  print: '<path d="M7 9V3h10v6M6 18H4v-7h16v7h-2M7 14h10v7H7z"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v7h-4"/>',
  queue: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  house:'<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
};

/** ไอคอนในปุ่มหรือแท็บ (aria-hidden เพราะข้อความอยู่ข้างๆ แล้ว) */
function staffIcon(name: string, size = 18) {
  const path = STAFF_ICON_PATHS[name] || '';
  return `<span class="staff-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
}
