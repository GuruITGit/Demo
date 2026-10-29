/** ป้ายภาษาไทยของงวด/สถานะ/วิธีรับเงิน ใช้ร่วมหน้าค่าแผงและค่าขยะ (เจ้าหน้าที่) */
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

/** "2569-10" → "ตุลาคม 2569" */
export const periodLabel = (period: string) => {
  const [y, m] = period.split('-');
  return `${MONTHS[Number(m) - 1] ?? m} ${y}`;
};

export const BILL_STATUS: Record<string, string> = {
  unpaid: 'ค้างชำระ', pending: 'รอตรวจ', paid: 'ชำระแล้ว', mismatch: 'ตีกลับ (รอแจ้งใหม่)',
};

export const PAY_METHOD: Record<string, string> = { cash: 'เงินสด', qr: 'สแกนจ่าย', transfer: 'โอน' };

export const money = (n: string | number) => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
