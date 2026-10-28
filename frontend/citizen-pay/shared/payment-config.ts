/** ช่องทางรับเงินค่าแผง/ค่าขยะ — ตอนนี้ตั้งในไฟล์นี้ (ยังไม่มี backend) · ภายหลังต้องย้ายไปดึงจากหน้าตั้งค่า อบต. (ห้าม hardcode ต่อ อบต.)
 *  promptpayId ว่าง = ซ่อน QR/แอปธนาคาร เหลือแค่เงินสด · เลข 0000000000 = เลขตัวอย่าง โอนจริงไม่ได้ */
/** logo = path รูปโลโก้จริง (เช่น /citizen-pay/shared/vendor/banks/kbank.png) ถ้าไม่ใส่ = ป้ายสีประจำธนาคาร + ตัวย่อ */
interface BankApp { name: string; scheme: string; short: string; color: string; ink?: string; logo?: string }
interface PaymentConfig { demo: boolean; promptpayId: string; promptpayType: 'mobile' | 'natid' | 'ewallet'; payeeName: string; cashPlace: string; cashHours: string; banks: BankApp[] }
const PAYMENT: PaymentConfig = {
  demo: true,
  promptpayId: '0000000000',
  promptpayType: 'mobile',
  payeeName: 'บัญชีรับเงิน อบต. (ตัวอย่าง)',
  cashPlace: 'งานการเงิน ที่ทำการ อบต.',
  cashHours: 'จันทร์–ศุกร์ 08:30–16:30 น. (เว้นวันหยุดราชการ)',
  // URL scheme เปิดแอปธนาคาร — แอปเปิดขึ้นมาเฉยๆ ไม่กรอกยอดให้ (ธนาคารไม่มี deeplink กลาง) · ต้องทดสอบบนมือถือจริงทุกตัว
  banks: [
    { name: 'กสิกรไทย', short: 'K+', color: '#138F2D', scheme: 'kplus://' },
    { name: 'ไทยพาณิชย์', short: 'SCB', color: '#4E2A84', scheme: 'scbeasy://' },
    { name: 'กรุงไทย', short: 'KTB', color: '#1BA5E1', scheme: 'ktbnext://' },
    { name: 'กรุงเทพ', short: 'BBL', color: '#1E4598', scheme: 'bualuang://' },
    { name: 'กรุงศรี', short: 'KMA', color: '#FEC43B', ink: '#4A3B00', scheme: 'kma://' },
    { name: 'ออมสิน', short: 'GSB', color: '#EB198D', scheme: 'mymo://' },
  ],
};
