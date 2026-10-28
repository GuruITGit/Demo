import { PNG } from 'pngjs';

/**
 * แปลงรูป PNG (กว้างเท่าหัวพิมพ์อยู่แล้ว) → คำสั่ง ESC/POS raster (GS v 0) สำหรับเครื่องพิมพ์ความร้อน 58mm ผ่าน RawBT
 * ใช้ pngjs (pure JS) ถอดรหัส PNG → ไม่พึ่ง sharp (native) ที่อาจไม่พร้อมบน container prod
 * ส่งทั้งใบเป็นรูป → ภาษาไทย/ครุฑออกครบ ไม่ต้องยุ่ง codepage เครื่องพิมพ์
 */
export function pngToEscposRaster(png: Buffer, copies = 1): Buffer {
  const img = PNG.sync.read(png);
  const w = img.width, h = img.height;
  const widthBytes = Math.ceil(w / 8);

  // pack 1-bit ต่อแถว (bit=1 = ดำ) threshold 160 · โปร่งใส = พื้นขาว
  const raster = Buffer.alloc(widthBytes * h, 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = img.data[i + 3];
      const gray = a < 128 ? 255 : (img.data[i] * 0.299 + img.data[i + 1] * 0.587 + img.data[i + 2] * 0.114);
      if (gray < 160) raster[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }

  const header = Buffer.from([0x1d, 0x76, 0x30, 0x00,           // GS v 0 m=0
    widthBytes & 0xff, (widthBytes >> 8) & 0xff, h & 0xff, (h >> 8) & 0xff]);
  const ESC_INIT = Buffer.from([0x1b, 0x40]);                   // init
  const FEED_CUT = Buffer.from([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00]); // เว้น 3 บรรทัด + ตัดกระดาษ
  const n = Math.min(Math.max(1, Math.floor(copies) || 1), 5); // จำกัด 1–5 สำเนากันพิมพ์รัว
  const one = Buffer.concat([header, raster, FEED_CUT]);
  return Buffer.concat([ESC_INIT, ...Array.from({ length: n }, () => one)]);
}
