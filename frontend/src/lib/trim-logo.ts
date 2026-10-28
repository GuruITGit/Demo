/**
 * ตัดขอบขาว/โปร่งรอบโลโก้ แล้วทำเป็นสี่เหลี่ยมจัตุรัสกึ่งกลาง (สูงสุด 512px PNG) ก่อนอัปโหลด
 * ตรา อบต. ที่หามามักมีขอบขาวกว้าง → แสดงในกรอบวงกลมแล้วเห็นเป็นวงขาวล้อม · ตัดแล้วตราเต็มวงพอดี
 * อ่านรูปไม่ได้ / ไม่เจอเนื้อรูป → คืนไฟล์เดิม (ไม่ทำให้การอัปโหลดล้ม)
 */
export async function trimLogo(file: File): Promise<File> {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    URL.revokeObjectURL(url);
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return file;

    const src = document.createElement('canvas');
    src.width = w; src.height = h;
    const sctx = src.getContext('2d');
    if (!sctx) return file;
    sctx.drawImage(img, 0, 0);
    const { data } = sctx.getImageData(0, 0, w, h);

    // กรอบของ "เนื้อรูป" = พิกเซลที่ไม่โปร่งและไม่ขาว (เผื่อขาวอมเทาจาก JPG)
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4;
        const a = data[k + 3];
        if (a < 24) continue;
        if (data[k] > 235 && data[k + 1] > 235 && data[k + 2] > 235) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return file;

    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const side = Math.max(bw, bh);
    const out = Math.min(512, side);
    const dst = document.createElement('canvas');
    dst.width = out; dst.height = out;
    const dctx = dst.getContext('2d');
    if (!dctx) return file;
    // วางเนื้อรูปกึ่งกลางสี่เหลี่ยมจัตุรัส (พื้นโปร่ง)
    const scale = out / side;
    dctx.drawImage(img, minX, minY, bw, bh, ((side - bw) / 2) * scale, ((side - bh) / 2) * scale, bw * scale, bh * scale);

    const blob = await new Promise<Blob | null>((ok) => dst.toBlob(ok, 'image/png'));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
  } catch {
    return file;
  }
}
