// สร้างไอคอนแท็บ/PWA: หลัก (Smart SAO = วงกลม O + ติ๊กถูก) และ ประปา (โลโก้หยดน้ำใหม่)
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// รัน: node scripts/gen-icons.mjs (cwd: frontend/) — สร้างใหม่เมื่อโลโก้เปลี่ยน
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const NAVY = '#073c5e';
// ---------- 1) Smart SAO mark (vector, ทำให้เส้นหนาขึ้นเล็กน้อยให้ชัดที่ 16px) ----------
const saoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#1e9ad6"/><stop offset="1" stop-color="#7fe0ff"/></linearGradient></defs>
<circle cx="28" cy="36" r="21" fill="none" stroke="${NAVY}" stroke-width="7"/>
<path d="M17 37l9 9 28-34" fill="none" stroke="url(#g)" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// ---------- 2) ประปา: ตัดพื้นขาวรอบนอกออก (flood-fill จากขอบ ไม่แตะสีขาวข้างในโลโก้) ----------
async function keyOutside(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const bg = new Uint8Array(W * H); // 1 = พื้นหลังนอกโลโก้
  const near = (i) => Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) > 238;
  const stack = [];
  for (let x = 0; x < W; x++) { stack.push(x, (H - 1) * W + x); }
  for (let y = 0; y < H; y++) { stack.push(y * W, y * W + W - 1); }
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || !near(i)) continue;
    bg[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack.push(i - 1); if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W); if (y < H - 1) stack.push(i + W);
  }
  // ขอบ: พิกเซลติดพื้นหลังที่ยังสว่างอยู่ → alpha ตามความเข้ม (anti-alias)
  for (let i = 0; i < W * H; i++) {
    if (bg[i]) { data[i * 4 + 3] = 0; continue; }
    const x = i % W, y = (i / W) | 0;
    const touch = (x > 0 && bg[i - 1]) || (x < W - 1 && bg[i + 1]) || (y > 0 && bg[i - W]) || (y < H - 1 && bg[i + W]);
    if (touch) {
      const mn = Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      data[i * 4 + 3] = Math.max(0, Math.min(255, Math.round((255 - mn) * 1.6)));
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: 4 } }).png();
}

const out = (p) => path.join(ROOT, p);
const write = async (img, p) => { await img.toFile(out(p)); console.log('wrote', p); };

// Smart SAO
await write(sharp(Buffer.from(saoSvg)).resize(128, 128), 'src/app/icon.png');
await write(
  sharp({ create: { width: 180, height: 180, channels: 4, background: '#ffffff' } })
    .composite([{ input: await sharp(Buffer.from(saoSvg)).resize(140, 140).png().toBuffer(), left: 20, top: 20 }]).png(),
  'src/app/apple-icon.png',
);

// ประปา
const mark = await (await keyOutside(out('public/prapa/logo-mark.png'))).toBuffer();
const markPad = async (size, pad, bgColor) => {
  const inner = size - pad * 2;
  return sharp({ create: { width: size, height: size, channels: 4, background: bgColor } })
    .composite([{ input: await sharp(mark).resize(inner, inner).png().toBuffer(), left: pad, top: pad }]).png();
};
await write(sharp(mark).resize(128, 128), 'src/app/prapa/icon.png');
await write(sharp(mark).resize(128, 128), 'src/app/checkbill/icon.png');
await write(await markPad(180, 14, '#ffffff'), 'src/app/prapa/apple-icon.png');
await write(await markPad(192, 12, '#ffffff'), 'public/prapa-icon-192.png');
await write(await markPad(512, 32, '#ffffff'), 'public/prapa-icon-512.png');
await write(await markPad(512, 104, '#ffffff'), 'public/prapa-icon-maskable.png');
