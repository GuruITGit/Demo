/** สร้าง PDF ภาษาไทยฝั่งเบราว์เซอร์ (jsPDF + ฟอนต์ TH Sarabun จาก /fonts) — ใช้แทน PDF ที่ backend ออกให้ในระบบจริง */

let fontB64: Promise<{ regular: string; bold: string }> | null = null;

async function loadFonts() {
  if (!fontB64) {
    const toB64 = async (url: string) => {
      const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
      let s = '';
      for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return btoa(s);
    };
    fontB64 = Promise.all([toB64('/fonts/THSarabunNew.ttf'), toB64('/fonts/THSarabunNew-Bold.ttf')]).then(([regular, bold]) => ({ regular, bold }));
  }
  return fontB64;
}

export interface PdfLine { text: string; bold?: boolean; size?: number; indent?: number; gap?: number; align?: 'center' | 'left' }

export async function thaiPdf(lines: PdfLine[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const f = await loadFonts();
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  pdf.addFileToVFS('TH.ttf', f.regular); pdf.addFont('TH.ttf', 'TH', 'normal');
  pdf.addFileToVFS('THB.ttf', f.bold); pdf.addFont('THB.ttf', 'TH', 'bold');
  let y = 24;
  const left = 25, width = 160;
  for (const l of lines) {
    pdf.setFont('TH', l.bold ? 'bold' : 'normal');
    pdf.setFontSize(l.size ?? 16);
    const wrapped: string[] = pdf.splitTextToSize(l.text || ' ', width - (l.indent ?? 0));
    for (const w of wrapped) {
      if (y > 275) { pdf.addPage(); y = 24; }
      if (l.align === 'center') pdf.text(w, 105, y, { align: 'center' });
      else pdf.text(w, left + (l.indent ?? 0), y);
      y += ((l.size ?? 16) * 0.42) + 1.2;
    }
    y += l.gap ?? 0;
  }
  return pdf.output('blob');
}

const A4W = 794, A4H = 1123;
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image')); i.src = src; });

/** ตัวแต่งเอกสารส่งชั้น HTML (ข้อความ/ตรา/ลายเซ็น) ต่อหน้ามา — วาดทับภาพพื้นหลังแล้วรวมเป็น PDF (ฝั่งเบราว์เซอร์ แทน Chromium ของ backend) */
export async function composeOverlayPdf(pages: { html?: string; bg?: string | null }[]): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  for (let i = 0; i < pages.length; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = A4W * 2; canvas.height = A4H * 2;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const bg = pages[i].bg;
    if (bg) { try { ctx.drawImage(await loadImg(bg), 0, 0, canvas.width, canvas.height); } catch { /* พื้นหลังโหลดไม่ได้ ใช้หน้าขาว */ } }
    if (pages[i].html) {
      try {
        const box = document.createElement('div');
        box.innerHTML = pages[i].html!;
        const xhtml = new XMLSerializer().serializeToString(box);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${A4W}" height="${A4H}"><foreignObject width="${A4W}" height="${A4H}"><div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:${A4W}px;height:${A4H}px;font-family:'TH Sarabun New',Sarabun,Tahoma,sans-serif">${xhtml}</div></foreignObject></svg>`;
        ctx.drawImage(await loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`), 0, 0, canvas.width, canvas.height);
      } catch { /* ชั้นแต่งวาดไม่ได้ ข้ามหน้านี้ */ }
    }
    if (i > 0) pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
  }
  return pdf.output('blob');
}
