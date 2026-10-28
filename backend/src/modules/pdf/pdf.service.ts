import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as puppeteer from 'puppeteer';
import { GARUDA_EMBLEM } from './garuda-emblem';
import { noticeFontCss } from '../water/notice-fonts';

@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: puppeteer.Browser | null = null;
  private launching: Promise<puppeteer.Browser> | null = null;

  /** อนุญาตเฉพาะ data URL รูปภาพจริง — กัน XSS/SSRF ผ่านฟิลด์ลายเซ็น (base64 เท่านั้น) */
  private static readonly DATA_IMAGE_RE = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i;

  /** คืนค่า data-image ที่ปลอดภัยสำหรับใส่ใน <img src>; ค่าที่ไม่ใช่ data:image → '' */
  static safeDataImage(v: any): string {
    const s = String(v ?? '').trim();
    return PdfService.DATA_IMAGE_RE.test(s) ? s : '';
  }

  constructor(private configService: ConfigService) {}

  /**
   * ดึงรูป (โลโก้/ตรา) เป็น data URL base64 เพื่อฝังใน PDF
   * (hardenPage บล็อก http ตอนเรนเดอร์เพื่อกัน SSRF → ต้องฝัง base64 ครุฑถึงจะขึ้น)
   */
  async fetchImageAsDataUrl(url?: string): Promise<string> {
    const s = String(url || '').trim();
    if (!s) return '';
    if (/^data:image\//i.test(s)) return PdfService.safeDataImage(s);
    if (!/^https?:\/\//i.test(s)) return '';
    try {
      const res = await fetch(s);
      if (!res.ok) return '';
      const ct = (res.headers.get('content-type') || '').toLowerCase().split(';')[0];
      if (!ct.startsWith('image/')) return '';
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 2_000_000) return ''; // กันรูปใหญ่เกิน
      return `data:${ct};base64,${buf.toString('base64')}`;
    } catch (e: any) {
      this.logger.warn('fetch emblem failed: ' + (e?.message || e));
      return '';
    }
  }

  /** ตรา/โลโก้หัวหนังสือ — ตราองค์กร > โลโก้องค์กร > ตราครุฑมาตรฐาน (default) */
  async resolveOrgEmblem(orgInfo: any): Promise<string> {
    return (await this.fetchImageAsDataUrl(orgInfo?.sealUrl))
      || (await this.fetchImageAsDataUrl(orgInfo?.logoUrl))
      || GARUDA_EMBLEM;
  }

  /**
   * ล็อกหน้าเว็บก่อน setContent (defense-in-depth):
   * - ปิด JavaScript → กัน on-error/on-load handler รันโค้ดฝั่ง server
   * - จำกัด network ให้โหลดได้เฉพาะ data: และฟอนต์ Google → กัน SSRF (file:///, 169.254.169.254, host ภายใน)
   * HTML template ของเราไม่ใช้ JS/resource ภายนอกอื่น จึงไม่กระทบการเรนเดอร์
   */
  private async hardenPage(page: puppeteer.Page): Promise<void> {
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      const allowed =
        url.startsWith('data:') ||
        url.startsWith('https://fonts.googleapis.com/') ||
        url.startsWith('https://fonts.gstatic.com/');
      (allowed ? req.continue() : req.abort()).catch(() => undefined);
    });
  }

  /** เปิด Chromium ครั้งเดียวแล้วใช้ซ้ำ (เปิดใหม่เฉพาะตอนยังไม่มี/หลุดการเชื่อมต่อ) */
  private async getBrowser(): Promise<puppeteer.Browser> {
    if (this.browser?.connected) return this.browser;
    if (this.launching) return this.launching;

    this.launching = puppeteer
      .launch({
        headless: true,
        executablePath: this.configService.get('PUPPETEER_EXECUTABLE_PATH') || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      })
      .then((b) => {
        this.browser = b;
        this.launching = null;
        b.on('disconnected', () => { this.browser = null; });
        return b;
      })
      .catch((err) => {
        this.launching = null;
        throw err;
      });

    return this.launching;
  }

  async onModuleDestroy() {
    if (this.browser) await this.browser.close().catch(() => undefined);
  }

  async generateFromHtml(html: string, options?: puppeteer.PDFOptions): Promise<Buffer> {
    let page: puppeteer.Page;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      await this.hardenPage(page);
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
        ...options,
      });

      return Buffer.from(pdf);
    } catch (err) {
      this.logger.error('PDF generation failed', err);
      throw err;
    } finally {
      // ปิดเฉพาะ page (ไม่ปิด browser ที่ใช้ซ้ำ) เพื่อกัน memory leak ต่อครั้ง
      if (page) await page.close().catch(() => undefined);
    }
  }

  /**
   * PDF กระดาษม้วน (เช่น 58mm) สูงพอดีเนื้อหา — วัดความสูงจริงหลังเรนเดอร์ ไม่ตัดท้าย/ไม่เหลือกระดาษเปล่า
   */
  async generateRollPdf(html: string, widthMm: number): Promise<Buffer> {
    let page: puppeteer.Page;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      await this.hardenPage(page);
      await page.setViewport({ width: Math.round(widthMm * 96 / 25.4), height: 800 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const px = await page.evaluate(() => document.documentElement.scrollHeight);
      const pdf = await page.pdf({
        width: `${widthMm}mm`, height: `${Math.ceil(px * 25.4 / 96) + 2}mm`, pageRanges: '1',
        printBackground: true, preferCSSPageSize: false,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });
      return Buffer.from(pdf);
    } catch (err) {
      this.logger.error('PDF generation failed', err);
      throw err;
    } finally {
      if (page) await page.close().catch(() => undefined);
    }
  }

  /**
   * เรนเดอร์ HTML เป็นรูป PNG โปร่งใส (ใช้ทำตราประทับรับเพื่อ overlay ลงบน PDF จริง)
   * selector = element ที่จะแคป (เช่น '.stamp') — Thai text ถูก rasterize โดย Chromium จึงไม่ต้อง embed font
   */
  /**
   * เรนเดอร์สลิป 58mm เป็น PNG กว้างเท่าหัวพิมพ์พอดี (default 384px = 58mm) scale 1
   * ไม่ต้อง resize ทีหลัง → ป้อน escpos-raster (pngjs) ได้ตรง ไม่พึ่ง sharp
   */
  async generateThermalPng(html: string, widthPx = 384, selector = '.slip'): Promise<Buffer> {
    let page: puppeteer.Page;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      await this.hardenPage(page);
      await page.setViewport({ width: widthPx, height: 1200, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const el = await page.$(selector);
      const target = el || page;
      const png = await (target as any).screenshot({ type: 'png' });
      return Buffer.from(png);
    } catch (err) {
      this.logger.error('Thermal PNG generation failed', err);
      throw err;
    } finally {
      if (page) await page.close().catch(() => undefined);
    }
  }

  async generatePngFromHtml(html: string, selector = '.stamp'): Promise<Buffer> {
    let page: puppeteer.Page;
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      await this.hardenPage(page);
      await page.setViewport({ width: 800, height: 600, deviceScaleFactor: 3 });
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const el = await page.$(selector);
      const target = el || page;
      const png = await (target as any).screenshot({ omitBackground: true, type: 'png' });
      return Buffer.from(png);
    } catch (err) {
      this.logger.error('PNG generation failed', err);
      throw err;
    } finally {
      if (page) await page.close().catch(() => undefined);
    }
  }

  /**
   * หนังสือสารบรรณ (Rework v3) — เอกสาร + "ลายเซ็นรวม" ของผู้ลงนามทุกคน (คนแรก→นายก) ในหน้าเดียว
   * แต่ละบล็อก: ลายเซ็น + (ชื่อ-นามสกุล) + ตำแหน่ง + วันที่ · ลายเซ็นแสดงเมื่อเรื่องเสร็จสิ้น (เซ็นครบ)
   * ตัดออก: ไทม์ไลน์/สถานะ/กองเจ้าของ/ความเร่งด่วน/ชั้นความลับ/วันครบกำหนด
   */
  generateTicketHtml(t: any, orgInfo: any, emblemDataUrl = ''): string {
    const esc = (s: any) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
    const nl2br = (s: any) => esc(s).replace(/\n/g, '<br>');
    const d = (x: any) => x ? new Date(x).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    const orgName = esc(orgInfo?.nameTh || 'องค์การบริหารส่วนตำบล');
    // ตรา/โลโก้ = data URL ที่ดึงฝังมาแล้ว (controller เรียก resolveOrgEmblem) — กัน injection + ไม่ต้องโหลดผ่านเน็ตตอนเรนเดอร์
    const emblem = PdfService.safeDataImage(emblemDataUrl);
    const orgAddr = nl2br(orgInfo?.address || '');
    const orgContact = [orgInfo?.phone ? `โทร. ${esc(orgInfo.phone)}` : '', orgInfo?.fax ? `โทรสาร ${esc(orgInfo.fax)}` : ''].filter(Boolean).join('&nbsp;&nbsp;');

    const purposeText = t.purpose === 'อื่นๆ' ? (t.purposeOther || '') : (t.purpose || '');
    const refText = [t.refDocNumber, t.refDocDetail].filter(Boolean).map(esc).join(' ');
    const encl = Array.isArray(t.enclosures) ? t.enclosures : [];
    const enclText = encl
      .map((x: any) => { const q = [x.qty, x.unit].filter(Boolean).join(' '); return `${esc(x.name)}${q ? ` จำนวน ${esc(q)}` : ''}`; })
      .join(', ');

    // ลูกโซ่ลายเซ็น (เฉพาะรายการ timeline ที่มีลายเซ็นจริง) — ผู้ปฏิบัติ → ปลัด → นายก
    const signs = (t.timeline || []).filter((e: any) => PdfService.safeDataImage(e.signatureImage));
    const signBlocks = signs.map((e: any) => `
      <div class="sig">
        <img class="sig-img" src="${PdfService.safeDataImage(e.signatureImage)}" />
        <div class="sig-name">(${esc(e.actor?.fullNameTh || '')})</div>
        <div class="sig-pos">${esc(e.actor?.positionName || e.action || '')}</div>
        <div class="sig-date">${d(e.actedAt)}</div>
      </div>`).join('');

    const commentOf = (kw: string) => (t.timeline || [])
      .filter((e: any) => String(e.action || '').includes(kw) && e.note)
      .map((e: any) => esc(e.note)).join(' / ');
    const clerkComment = commentOf('ปลัด');
    const mayorComment = commentOf('นายก');

    // กล่องเลขทะเบียนรับ (มุมขวาบน) — เฉพาะเมื่อมีเลขทะเบียนรับ
    const receiveDate = t.receivedRecordAt || t.receivedDate;
    const recvBox = t.receiveRegNumber ? `
      <div class="recv">
        <div class="recv-title">${orgName}</div>
        <div class="recv-row"><span>เลขทะเบียนรับ</span><b>${esc(t.receiveRegNumber)}</b></div>
        <div class="recv-row"><span>วันที่</span><span>${receiveDate ? d(receiveDate) : '…………'}</span></div>
        <div class="recv-row"><span>เวลา</span><span>${esc(t.receivedTime || '……')}</span></div>
      </div>` : '';

    const badges = [
      t.urgencyLevel && t.urgencyLevel !== 'ปกติ' ? `<span class="badge urgent">${esc(t.urgencyLevel)}</span>` : '',
      t.confidentiality && t.confidentiality !== 'ปกติ' ? `<span class="badge confid">${esc(t.confidentiality)}</span>` : '',
    ].filter(Boolean).join(' ');

    // กอง (มุมซ้ายบน) — ชื่อกองที่เกี่ยวข้องกับเรื่องนี้
    const deptNames = [...new Set((t.ticketDepartments || []).map((td: any) => td.department?.nameTh).filter(Boolean))] as string[];
    const deptBox = deptNames.length
      ? `<div class="deptbox"><div class="deptbox-t">กอง</div>${deptNames.map((n) => `<div>• ${esc(n)}</div>`).join('')}</div>`
      : '';

    const line = (label: string, val: string) => val
      ? `<div class="lrow"><div class="lbl">${label}</div><div class="val">${val}</div></div>` : '';

    return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><style>
      @page{size:A4;margin:1.5cm 2cm 1.5cm 2.5cm;}
      *{box-sizing:border-box;}
      body{font-family:'TH Sarabun New','Sarabun',sans-serif;font-size:14pt;color:#000;line-height:1.3;margin:0;}
      .topbar{width:100%;border-collapse:collapse;table-layout:fixed;}
      .topbar td{vertical-align:top;padding:0;}
      .tb-left{width:24%;} .tb-center{width:52%;text-align:center;} .tb-right{width:24%;text-align:right;}
      .emblem-img{height:52px;margin-bottom:2px;}
      .org{font-size:15.5pt;font-weight:bold;line-height:1.2;}
      .addr{font-size:11pt;color:#222;}
      .deptbox{display:inline-block;border:1px solid #000;padding:2px 6px;font-size:10pt;text-align:left;line-height:1.3;margin-top:2px;min-width:96px;}
      .deptbox-t{font-weight:bold;text-align:center;border-bottom:1px solid #000;margin:-2px -6px 2px;padding:1px 4px;}
      .recv{display:inline-block;border:1px solid #000;padding:3px 6px;font-size:10pt;text-align:left;line-height:1.3;min-width:132px;}
      .recv-title{text-align:center;font-weight:bold;border-bottom:1px solid #000;margin:-3px -6px 3px;padding:2px 4px;font-size:9.5pt;}
      .recv-row{display:flex;justify-content:space-between;gap:6px;}
      .topmeta{display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px;}
      .badge{display:inline-block;border:1px solid #b00;color:#b00;border-radius:4px;padding:1px 7px;font-size:10.5pt;font-weight:bold;margin-bottom:3px;}
      .confid{border-color:#a00;color:#a00;}
      .datewrap{text-align:right;}
      .lrow{display:flex;margin-top:3px;} .lbl{font-weight:bold;white-space:nowrap;padding-right:8px;}
      .val{flex:1;}
      .body{margin-top:10px;text-align:justify;text-indent:2.5em;}
      .purpose{margin-top:8px;text-indent:2.5em;}
      .comments{margin-top:10px;font-size:11.5pt;color:#333;border-top:1px dashed #bbb;padding-top:6px;}
      .closing{margin-top:22px;text-align:center;}
      .sigs{display:flex;flex-wrap:wrap;justify-content:space-around;gap:14px 20px;margin-top:6px;}
      .sig{text-align:center;min-width:160px;}
      .sig-img{height:46px;display:block;margin:0 auto 2px;}
      .sig-name{font-size:12pt;} .sig-pos{font-size:10.5pt;color:#333;} .sig-date{font-size:10pt;color:#666;margin-top:2px;}
      .pending{margin-top:8px;text-align:center;color:#888;font-size:11.5pt;}
    </style></head><body>
      <table class="topbar"><tr>
        <td class="tb-left">${badges ? `<div>${badges}</div>` : ''}${deptBox}</td>
        <td class="tb-center">
          ${emblem ? `<img class="emblem-img" src="${emblem}" alt="ตรา" />` : ''}
          <div class="org">${orgName}</div>
          ${orgAddr ? `<div class="addr">${orgAddr}</div>` : ''}
          ${orgContact ? `<div class="addr">${orgContact}</div>` : ''}
        </td>
        <td class="tb-right">${recvBox}</td>
      </tr></table>

      <div class="topmeta">
        <div>${line('ที่', esc(t.externalDocNumber || '-'))}</div>
        <div class="datewrap">${t.docDate ? d(t.docDate) : (receiveDate ? d(receiveDate) : '')}</div>
      </div>

      <div style="margin-top:10px;">
        ${line('เรื่อง', `<b>${esc(t.subject)}</b>`)}
        ${line('เรียน', esc(t.recipient))}
        ${line('อ้างถึง', refText)}
        ${line('สิ่งที่ส่งมาด้วย', enclText)}
        ${line('จาก', esc(t.sourceOrg))}
      </div>

      ${t.body ? `<div class="body">${nl2br(t.body)}</div>` : ''}
      ${purposeText ? `<div class="purpose">จึงเรียนมาเพื่อ${esc(purposeText)}</div>` : ''}

      ${(clerkComment || mayorComment) ? `<div class="comments">
        ${clerkComment ? `<div><b>ความเห็นปลัด:</b> ${clerkComment}</div>` : ''}
        ${mayorComment ? `<div><b>ความเห็นนายก:</b> ${mayorComment}</div>` : ''}
      </div>` : ''}

      <div class="closing">
        <div>ขอแสดงความนับถือ</div>
        ${signBlocks ? `<div class="sigs">${signBlocks}</div>` : `<div class="pending">— รอลงนามตามลำดับ (ผู้ปฏิบัติ / ปลัด / นายก) —</div>`}
      </div>
    </body></html>`;
  }

  /** ขอบกระดาษคำร้องทั่วไปตามแบบราชการ (ซ้าย 3 / ขวา 2 / บน-ล่าง 2.5 ซม.) — ส่งเข้า generateFromHtml */
  static readonly PETITION_MARGIN = { top: '25mm', right: '20mm', bottom: '25mm', left: '30mm' };

  /** อักษรย่อจังหวัด (ใช้บรรทัดที่อยู่หัวคำร้อง เช่น "อำเภอโนนดินแดง บร ๓๑๒๖๐") */
  private static readonly PROVINCE_ABBR: Record<string, string> = {
    'กรุงเทพมหานคร': 'กท', 'กระบี่': 'กบ', 'กาญจนบุรี': 'กจ', 'กาฬสินธุ์': 'กส', 'กำแพงเพชร': 'กพ', 'ขอนแก่น': 'ขก',
    'จันทบุรี': 'จบ', 'ฉะเชิงเทรา': 'ฉช', 'ชลบุรี': 'ชบ', 'ชัยนาท': 'ชน', 'ชัยภูมิ': 'ชย', 'ชุมพร': 'ชพ', 'เชียงราย': 'ชร',
    'เชียงใหม่': 'ชม', 'ตรัง': 'ตง', 'ตราด': 'ตร', 'ตาก': 'ตก', 'นครนายก': 'นย', 'นครปฐม': 'นฐ', 'นครพนม': 'นพ',
    'นครราชสีมา': 'นม', 'นครศรีธรรมราช': 'นศ', 'นครสวรรค์': 'นว', 'นนทบุรี': 'นบ', 'นราธิวาส': 'นธ', 'น่าน': 'นน',
    'บึงกาฬ': 'บก', 'บุรีรัมย์': 'บร', 'ปทุมธานี': 'ปท', 'ประจวบคีรีขันธ์': 'ปข', 'ปราจีนบุรี': 'ปจ', 'ปัตตานี': 'ปน',
    'พระนครศรีอยุธยา': 'อย', 'พะเยา': 'พย', 'พังงา': 'พง', 'พัทลุง': 'พท', 'พิจิตร': 'พจ', 'พิษณุโลก': 'พล', 'เพชรบุรี': 'พบ',
    'เพชรบูรณ์': 'พช', 'แพร่': 'พร', 'ภูเก็ต': 'ภก', 'มหาสารคาม': 'มค', 'มุกดาหาร': 'มห', 'แม่ฮ่องสอน': 'มส', 'ยโสธร': 'ยส',
    'ยะลา': 'ยล', 'ร้อยเอ็ด': 'รอ', 'ระนอง': 'รน', 'ระยอง': 'รย', 'ราชบุรี': 'รบ', 'ลพบุรี': 'ลบ', 'ลำปาง': 'ลป', 'ลำพูน': 'ลพ',
    'เลย': 'ลย', 'ศรีสะเกษ': 'ศก', 'สกลนคร': 'สน', 'สงขลา': 'สข', 'สตูล': 'สต', 'สมุทรปราการ': 'สป', 'สมุทรสงคราม': 'สส',
    'สมุทรสาคร': 'สค', 'สระแก้ว': 'สก', 'สระบุรี': 'สบ', 'สิงห์บุรี': 'สห', 'สุโขทัย': 'สท', 'สุพรรณบุรี': 'สพ',
    'สุราษฎร์ธานี': 'สฎ', 'สุรินทร์': 'สร', 'หนองคาย': 'นค', 'หนองบัวลำภู': 'นภ', 'อ่างทอง': 'อท', 'อำนาจเจริญ': 'อจ',
    'อุดรธานี': 'อด', 'อุตรดิตถ์': 'อต', 'อุทัยธานี': 'อน', 'อุบลราชธานี': 'อบ',
  };

  /**
   * คำร้องทั่วไป (e-Service) — จัดหน้าตามแบบฟอร์มกระดาษของ อบต. (A4 · TH Sarabun 16pt · หัวเรื่อง 20pt)
   * สถานะลงนาม 3 ผู้เซ็น (ผอ.กอง → ปลัด → นายก) คนละกลไกกับ generateTicketHtml/สารบรรณทั้งหมด
   * ชื่อ/ตำแหน่ง/ที่อยู่ ดึงจาก DB ทั้งหมด (ไม่ฮาร์ดโค้ด เพราะขายหลาย อบต.) — signers มาจาก petitionPdfData()
   * ใช้คู่กับ PETITION_MARGIN ตอน generateFromHtml
   */
  generatePetitionHtml(r: any, orgInfo: any, signers: any): string {
    const esc = (s: any) => String(s ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] as string));
    const nl2br = (s: any) => esc(s).replace(/\n/g, '<br>');
    const thaiDigits = (s: string) => s.replace(/[0-9]/g, (n) => '๐๑๒๓๔๕๖๗๘๙'[+n]);

    const orgName = esc(orgInfo?.nameTh || 'องค์การบริหารส่วนตำบล');
    // บรรทัดที่อยู่ใต้ชื่อ อบต. — "อำเภอX บร ๓๑๒๖๐" (ไม่มีอักษรย่อในตาราง = ใช้ชื่อเต็ม) รหัสไปรษณีย์ดึงจาก address
    const province = String(orgInfo?.province || '').replace(/^จังหวัด/, '');
    const provinceAbbr = PdfService.PROVINCE_ABBR[province] || (province ? `จังหวัด${province}` : '');
    const postcode = (String(orgInfo?.address || '').match(/\d{5}/g) || []).pop() || '';
    const orgAddrLine = [orgInfo?.district ? `อำเภอ${esc(orgInfo.district)}` : '', esc(provinceAbbr), thaiDigits(postcode)].filter(Boolean).join(' ');

    // admin แก้ "เรื่อง" เองได้ (r.subject) — ว่าง = fallback รายละเอียด 80 ตัวอักษรแรก
    // ขอใช้บริการ (รถกู้ภัย/ดับเพลิง/ฯลฯ) ใช้เอกสารนี้เหมือนกัน — "เรื่อง" ว่าง = ใช้ชื่อบริการ + แสดงจุดเกิดเหตุต่อท้ายความประสงค์
    const isService = String(r.category || '').startsWith('ขอใช้บริการ');
    const subject = r.subject || (isService ? r.category : (r.detail || '').slice(0, 80) + ((r.detail?.length || 0) > 80 ? '…' : ''));
    const a = r.answers || {};
    // ช่องที่อยู่ที่เป็นแค่พิกัด "lat, lng" (เรื่องเก่าก่อนแยกพิกัดออก) ไม่พิมพ์ลงเอกสาร — ตำแหน่งดูจากแผนที่ในระบบแทน
    const location = /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(r.location || '') ? '' : r.location;
    const serviceSpot = isService && location && location !== a.houseNo ? ` (จุดเกิดเหตุ: ${esc(location)})` : '';
    // วันที่เอกสาร แยก วัน/เดือน/พ.ศ. ลงช่องจุดไข่ปลา
    const docDate = new Date(a.docDate || r.createdAt || Date.now());
    const dPart = (opt: Intl.DateTimeFormatOptions) => docDate.toLocaleDateString('th-TH', opt);
    const year = dPart({ year: 'numeric' }).replace(/\D/g, '');

    // ช่องกรอก: ค่าวางบนเส้นจุดไข่ปลา (มี min-width เสมอ กันเส้นยุบเมื่อค่าว่าง)
    const fill = (val: any, w: number) => `<span class="fill" style="min-width:${w}px">${esc(val || '')}</span>`;
    // ( ) / (✓) — วาดเครื่องหมายถูกเป็น SVG เพราะ TH Sarabun New ไม่มีอักษร ✓ (ไม่งั้นไปดึงฟอนต์อื่นมาแทน หน้าตาเพี้ยน)
    const box = (checked: any) => `(<span class="ck">${checked ? '<svg viewBox="0 0 12 12"><path d="M2 6.5l2.6 2.6L10 3.2" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}</span>)`;
    // ช่อง (ลงชื่อ) — มีรูปลายเซ็นแนบ = วางรูปลอยบนเส้นจุด / ไม่มี = เส้นจุดเปล่าไว้เซ็นมือ
    const signLine = (signatureImage?: string) => {
      const img = PdfService.safeDataImage(signatureImage);
      return `(ลงชื่อ)<span class="sigslot">${img ? `<img src="${img}" />` : ''}</span>`;
    };
    const nameLine = (name?: string) => `(${name ? esc(name) : '<span class="dots-name"></span>'})`;
    // ความประสงค์สั้น = เติมเส้นจุดว่างอีกบรรทัดตามแบบฟอร์ม
    const detailShort = (r.detail || '').length < 120;

    return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><style>
      ${noticeFontCss()}
      @page{size:A4 portrait;margin:25mm 20mm 25mm 30mm;}
      *{box-sizing:border-box;}
      body{font-family:'TH SarabunNew','TH Sarabun New','TH SarabunPSK',sans-serif;font-size:16pt;color:#000;background:#fff;line-height:1.25;margin:0;}
      /* ฟอนต์ฝังใน PDF (noticeFontCss) — เซิร์ฟเวอร์ docker ไม่มีฟอนต์ไทยติดตั้ง */
      .ck{display:inline-block;width:0.75em;height:0.75em;vertical-align:-0.05em;}
      .ck svg{display:block;width:100%;height:100%;}
      .title{text-align:center;font-size:20pt;font-weight:bold;margin:0;line-height:1.2;}
      .orgaddr{text-align:right;}
      .date{margin:4px 0 4px 42%;white-space:nowrap;}
      .p{margin:0;}
      .ind1{text-indent:2.5cm;}
      .ind2{text-indent:5cm;}
      /* line-height:1 ให้เส้นจุดชิดใต้ตัวอักษร (TH Sarabun มีที่ว่างใต้ตัวเยอะ เส้นเลยลอยห่าง) */
      .fill{display:inline-block;border-bottom:1.5px dotted #000;padding:0 3px;text-align:center;line-height:1;}
      .detail{text-decoration:underline dotted 1.5px;text-underline-offset:5px;}
      .dotline{border-bottom:1.5px dotted #000;height:1.3em;}
      .sigslot{display:inline-block;position:relative;width:5.5cm;border-bottom:1.5px dotted #000;height:1.1em;vertical-align:baseline;}
      .sigslot img{position:absolute;left:50%;bottom:1px;transform:translateX(-50%);max-height:1cm;max-width:5cm;}
      .dots-name{display:inline-block;width:5.5cm;border-bottom:1.5px dotted #000;height:1.1em;vertical-align:baseline;}
      .blk{margin-top:6px;}
      /* ช่องลงนามทั้งชุดห้ามถูกตัดข้ามหน้า — ความประสงค์ยาวจนไม่พอ ให้ย้ายไปหน้าถัดไปทั้งก้อน */
      .signatures{break-inside:avoid;page-break-inside:avoid;}
      /* เว้นที่ด้านบนเส้นลงชื่อของผู้พิจารณา ให้รูปลายเซ็น/เซ็นมือไม่ทับบรรทัดก่อนหน้า */
      .sp{padding-top:0.35cm;}
      .center{text-align:center;}
      .sig{display:inline-block;text-align:center;white-space:nowrap;}
      .sig .who{display:block;}
      .right{padding-left:38%;}
      .centerright{padding-left:32%;}
      /* ปลัด (ซ้าย) + นายก (ขวา) วางคู่กันแถวเดียว ให้ทั้งฟอร์มจบใน 1 หน้า A4 */
      .pair{display:flex;gap:0.6cm;margin-top:4px;}
      .pair > div{flex:1;min-width:0;}
      .op{display:flex;white-space:nowrap;}
      .opfill{flex:1;border-bottom:1.5px dotted #000;height:1.1em;margin-left:2px;}
      .pair .sig{display:block;}
      .pair .sigslot,.pair .dots-name{width:4.8cm;}
    </style></head><body>
      <div class="title">คำร้องทั่วไป</div>
      <div class="orgaddr">${orgName}<br>${orgAddrLine}</div>
      <div class="date">วันที่${fill(dPart({ day: 'numeric' }), 40)}เดือน${fill(dPart({ month: 'long' }), 110)}พ.ศ.${fill(year, 55)}</div>

      <p class="p">เรื่อง${fill(subject, 420)}</p>
      <p class="p">เรียน นายก${orgName}</p>

      <p class="p ind1">ด้วย ข้าพเจ้า (${esc(a.titlePrefix || 'นาย/นาง/นางสาว')})${fill(r.reporterName, 330)}</p>
      <p class="p">บ้านเลขที่${fill(a.houseNo || (isService ? '' : location), 45)}หมู่ที่${fill(r.villageNo, 30)}ตำบล${fill(a.subDistrict || orgInfo?.subDistrict, 80)}อำเภอ${fill(a.district || orgInfo?.district, 80)}จังหวัด${fill(a.province || orgInfo?.province, 80)}</p>
      <p class="p">เบอร์โทรศัพท์${fill(r.reporterPhone, 180)}</p>
      <p class="p">ขอยื่นคำร้องต่อ${orgName}</p>

      <p class="p ind1">ข้าพเจ้ามีความประสงค์ <span class="detail">${nl2br(r.detail || '')}${serviceSpot}</span></p>
      ${detailShort && !serviceSpot ? '<div class="dotline"></div>' : ''}

      <p class="p ind1">ฉะนั้น จึงเรียนมาเพื่อโปรดพิจารณาดำเนินการให้แก่ข้าพเจ้าตามความประสงค์ หวังเป็นอย่างยิ่งว่าคงได้รับความอนุเคราะห์จากท่าน</p>
      <p class="p ind2">จึงขอขอบคุณมา ณ โอกาสนี้</p>

      <div class="signatures">
      <!-- บล็อก 1: กึ่งกลาง — ผู้ยื่น / ผู้รับรอง (ผู้รับรองไม่มีขั้นตอนในระบบ เว้นไว้เซ็นมือ) -->
      <div class="blk center">
        <div>ขอแสดงความนับถือ</div>
        <div class="sig" style="margin-top:4px;">${signLine()} ผู้ยื่นคำร้อง<span class="who">${nameLine(r.reporterName)}</span></div>
        <div class="sig" style="margin-top:4px;">${signLine()} ผู้รับรอง<span class="who">${nameLine()}</span><span class="who">ผู้ใหญ่บ้าน/กำนัน/ส.อบต.</span></div>
        <div style="margin-top:4px;">${box(r.deptHeadSignedAt)} ทราบ/เพื่อพิจารณาดำเนินการต่อไป</div>
      </div>

      <!-- บล็อก 2: เยื้องขวา — หัวหน้าส่วน/ผอ.กอง -->
      <div class="blk right">
        <div class="sig sp">${signLine(r.deptHeadSignature)} หัวหน้าส่วน/ผอ.กอง<span class="who">${nameLine(signers?.deptHeadName)}</span><span class="who">${esc(signers?.deptHeadPos || (r.targetDept?.nameTh ? `หัวหน้า${r.targetDept.nameTh}` : ''))}</span></div>
      </div>

      <!-- บล็อก 3 (ซ้าย) ปลัด + บล็อก 4 (ขวา) นายก -->
      <div class="pair">
        <div>
          <div class="op">${box(r.clerkSignedAt)} ทราบ/เห็นควรให้ดำเนินการ<span class="opfill"></span></div>
          <div class="sig sp">${signLine(r.clerkSignature)}<span class="who">${nameLine(signers?.clerkName)}</span><span class="who">ปลัด${orgName}</span></div>
        </div>
        <div>
          <div class="op">${box(r.mayorSignedAt)} ทราบ/เห็นควรให้ดำเนินการ<span class="opfill"></span></div>
          <div class="sig sp">${signLine(r.mayorSignature)}<span class="who">${nameLine(signers?.mayorName)}</span><span class="who">นายก${orgName}</span></div>
        </div>
      </div>
      </div>
    </body></html>`;
  }

  /** ส่งออกรายการสารบรรณ (ตามผลค้นหา) เป็นตาราง PDF */
  generateTicketListHtml(rows: any[], orgInfo: any): string {
    const esc = (s: any) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
    const d = (x: any) => (x ? new Date(x).toLocaleDateString('th-TH') : '-');
    const body = rows.map((t, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(t.ticketNumber)}</td>
        <td>${esc(t.subject)}</td>
        <td>${esc(t.sourceOrg || '-')}</td>
        <td>${esc(t.ownerDept?.nameTh || '-')}</td>
        <td>${esc(t.urgencyLevel)}</td>
        <td>${esc(t.confidentiality || 'ปกติ')}</td>
        <td>${esc(t.status)}</td>
        <td>${d(t.sentDate)}</td>
      </tr>`).join('');
    return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8"><style>
      body{font-family:'TH Sarabun New','Sarabun',sans-serif;font-size:13px;color:#111;padding:8px 12px;}
      .header{text-align:center;margin-bottom:10px;} .header h2{margin:0;}
      table{width:100%;border-collapse:collapse;margin-top:6px;}
      th,td{border:1px solid #ccc;padding:3px 5px;text-align:left;vertical-align:top;}
      th{background:#f0f0f0;}
    </style></head><body>
      <div class="header"><h2>${esc(orgInfo?.nameTh || 'องค์การบริหารส่วนตำบล')}</h2><p>รายการสารบรรณ (${rows.length} รายการ)</p></div>
      <table>
        <tr><th>#</th><th>เลขสารบรรณ</th><th>เรื่อง</th><th>จาก</th><th>กองเจ้าของเรื่อง</th><th>ความเร่งด่วน</th><th>ชั้นความลับ</th><th>สถานะ</th><th>วันที่ส่ง</th></tr>
        ${body || '<tr><td colspan="9" style="text-align:center;color:#888;">ไม่พบรายการ</td></tr>'}
      </table>
    </body></html>`;
  }

  generateIncomingDocHtml(doc: any, orgInfo: any): string {
    const esc = (s: any) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'TH Sarabun New', 'Sarabun', sans-serif; font-size: 16px; }
    .header { text-align: center; margin-bottom: 20px; }
    .doc-number { text-align: right; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 4px 8px; }
    .label { font-weight: bold; width: 150px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${esc(orgInfo?.nameTh || 'หน่วยงาน')}</h2>
    <p>บันทึกรับหนังสือ</p>
  </div>
  <div class="doc-number">เลขรับ: ${esc(doc.receiveNumber)}</div>
  <table>
    <tr><td class="label">วันที่รับ</td><td>${esc(new Date(doc.receivedAt).toLocaleDateString('th-TH'))}</td></tr>
    <tr><td class="label">หน่วยงานต้นทาง</td><td>${esc(doc.senderOrg || '-')}</td></tr>
    <tr><td class="label">เรื่อง</td><td>${esc(doc.subject)}</td></tr>
    <tr><td class="label">สถานะ</td><td>${esc(doc.status)}</td></tr>
    <tr><td class="label">ระดับความสำคัญ</td><td>${esc(doc.urgencyLevel)}</td></tr>
    <tr><td class="label">รายละเอียด</td><td>${esc(doc.body || '-')}</td></tr>
  </table>
</body>
</html>`;
  }

  generateApprovalRequestHtml(req: any, orgInfo: any): string {
    const esc = (s: any) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c] as string));
    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'TH Sarabun New', 'Sarabun', sans-serif; font-size: 16px; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; }
    .info-row { display: flex; margin-bottom: 8px; }
    .info-label { font-weight: bold; min-width: 180px; }
    .section { margin: 20px 0; border-top: 1px solid #ccc; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${esc(orgInfo?.nameTh || 'หน่วยงาน')}</h2>
    <h3>${esc(req.type?.nameTh || 'คำขออนุมัติ')}</h3>
    <p>เลขที่: ${esc(req.requestNumber)}</p>
  </div>
  <div class="info-row"><span class="info-label">ผู้ยื่น:</span><span>${esc(req.requester?.fullNameTh || '-')}</span></div>
  <div class="info-row"><span class="info-label">กอง:</span><span>${esc(req.department?.nameTh || '-')}</span></div>
  <div class="info-row"><span class="info-label">วันที่ยื่น:</span><span>${esc(req.submittedAt ? new Date(req.submittedAt).toLocaleDateString('th-TH') : '-')}</span></div>
  <div class="section">
    <h4>เรื่อง: ${esc(req.subject)}</h4>
    <p>${esc(req.body)}</p>
  </div>
</body>
</html>`;
  }
}
