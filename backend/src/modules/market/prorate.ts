/**
 * สัดส่วนค่าเช่า/ค่าขยะของงวด ตามวันที่เริ่มใช้แผง (คิดตามวันใช้งานจริง ไม่คิดเต็มเดือน)
 * period = 'พ.ศ.-เดือน' เช่น 2569-11 · startDate = 'YYYY-MM-DD' (ค.ศ.) หรือ null
 * - เริ่มก่อนงวดนี้/ไม่ทราบวันเริ่ม → 1 (เต็ม) · เริ่มกลางงวด → (วันที่เหลือรวมวันเริ่ม ÷ วันในเดือน) · เริ่มหลังงวดนี้ → 0 (ยังไม่ออกบิล)
 */
export function prorateFactor(startDate: string | null | undefined, period: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(startDate ?? ''));
  const p = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m || !p) return 1;
  const year = Number(p[1]) - 543, month = Number(p[2]);
  const sy = Number(m[1]), sm = Number(m[2]), sd = Number(m[3]);
  if (sy < year || (sy === year && sm < month)) return 1;
  if (sy > year || sm > month) return 0;
  const dim = new Date(year, month, 0).getDate();
  return Math.max(0, Math.min(1, (dim - sd + 1) / dim));
}

/** คิดเงินตามสัดส่วน ปัดเป็นสตางค์ */
export const prorate = (amount: number, factor: number) => Math.round(amount * factor * 100) / 100;
