import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * ฟอนต์ TH Sarabun New — ฟอนต์มาตรฐานหนังสือราชการไทย (สพธอ./SIPA แจกฟรี GPL + font exception)
 *
 * ทำไมต้องฝังลงไปเอง ไม่พึ่งฟอนต์ในเครื่อง:
 *   เซิร์ฟเวอร์ (docker) ไม่มีฟอนต์ไทยติดตั้งอยู่ ถ้าไม่ฝังจะตกไปใช้ Sarabun ของ Google
 *   ซึ่ง "กว้างและสูงกว่า" TH Sarabun ที่ Word ใช้ ผลคือตัวอักษรใหญ่เกิน บรรทัดตกเร็ว
 *   หน้ากระดาษไม่ตรงกับต้นฉบับ — ปรับ CSS เท่าไหร่ก็ไม่ตรง เพราะรูปทรงตัวอักษรคนละแบบ
 *
 * ไฟล์อยู่ใน src/modules/water/fonts/ และถูก copy ไป dist โดย nest-cli (assets: **\/*.ttf)
 * อ่านครั้งเดียวตอนเรียกใช้ครั้งแรกแล้ว cache ไว้ (ไฟล์รวม ~800KB ไม่ควรอ่านซ้ำทุก request)
 */
let cache: string | null = null;

export function noticeFontCss(): string {
  if (cache) return cache;

  const dir = join(__dirname, 'fonts');
  const b64 = (f: string) => readFileSync(join(dir, f)).toString('base64');

  cache = `
    @font-face {
      font-family: 'TH SarabunNew';
      src: url(data:font/ttf;base64,${b64('THSarabunNew.ttf')}) format('truetype');
      font-weight: 400; font-style: normal;
    }
    @font-face {
      font-family: 'TH SarabunNew';
      src: url(data:font/ttf;base64,${b64('THSarabunNew-Bold.ttf')}) format('truetype');
      font-weight: 700; font-style: normal;
    }`;
  return cache;
}
