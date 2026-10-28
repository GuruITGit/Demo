// ─────────────────────────────────────────────────────────────────────────────
// ตัวช่วยพิมพ์ใบเสร็จ/ใบแจ้งหนี้ ระบบประปา — รวมที่เดียว ใช้ทุกหน้า (cashier/collect/reading/check)
//
// ช่องทางพิมพ์:
//   thermal → ส่ง ESC/POS raster (base64) ให้แอป RawBT บนมือถือ Android แล้ว RawBT
//             คุยกับเครื่องพิมพ์ความร้อน 58mm (Goojprt/PT-210) ผ่าน Bluetooth
//             (เบราว์เซอร์ต่อ Bluetooth Classic ตรงไม่ได้ จึงพึ่ง RawBT)
//   pdf     → เปิดไฟล์ PDF 58mm ให้พิมพ์ผ่านไดอะล็อกของเครื่อง (เครื่องสำนักงาน/ทุกระบบ)
//
// ตั้งค่าเก็บใน localStorage "ต่ออุปกรณ์" (แต่ละเครื่อง จนท. ตั้งของตัวเอง) — โหมด + จำนวนสำเนา
// ─────────────────────────────────────────────────────────────────────────────
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';

export type PrintMode = 'thermal' | 'pdf';
export type PrinterPrefs = { mode: PrintMode; copies: number };

const KEY = 'prapa-printer-prefs';
const DEFAULT: PrinterPrefs = { mode: 'thermal', copies: 1 };

/** อ่านการตั้งค่าเครื่องพิมพ์ของอุปกรณ์นี้ (กันพังถ้าอ่าน localStorage ไม่ได้) */
export function getPrinterPrefs(): PrinterPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    const p = JSON.parse(raw);
    return {
      mode: p.mode === 'pdf' ? 'pdf' : 'thermal',
      copies: Math.min(Math.max(1, Number(p.copies) || 1), 5),
    };
  } catch { return { ...DEFAULT }; }
}

export function setPrinterPrefs(p: PrinterPrefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* โหมดส่วนตัว/ปิด storage — ข้ามได้ */ }
}

/** ยิง ESC/POS base64 ให้ RawBT */
function sendToRawBT(base64: string) {
  window.location.href = `rawbt:base64,${base64}`;
}

/** เปิด PDF ของบิลในแท็บใหม่ (ให้พิมพ์เอง) */
async function openBillPdf(billId: string, kind: 'invoice' | 'receipt') {
  const res = await api.get(`/water/billing/${billId}/${kind}`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * พิมพ์บิล 1 ใบ ตามโหมดที่ตั้งไว้ (หรือบังคับด้วย mode)
 * @returns true ถ้าสั่งพิมพ์ได้ (thermal = ส่งไป RawBT แล้ว), false ถ้า error (แจ้ง toast ให้แล้ว)
 */
export async function printBill(
  billId: string,
  kind: 'invoice' | 'receipt',
  mode?: PrintMode,
): Promise<boolean> {
  const prefs = getPrinterPrefs();
  const useMode = mode || prefs.mode;
  try {
    if (useMode === 'pdf') {
      await openBillPdf(billId, kind);
      return true;
    }
    const { base64 } = (await api.get(`/water/billing/${billId}/slip-escpos`, {
      params: { kind, copies: prefs.copies },
    })).data.data as { base64: string };
    sendToRawBT(base64);
    return true;
  } catch (e) {
    toast.error(getErrorMessage(e, useMode === 'thermal'
      ? 'ส่งไปเครื่องพิมพ์ไม่สำเร็จ — ติดตั้งแอป RawBT + จับคู่เครื่องพิมพ์ก่อน (ดูหน้า "ตั้งค่าเครื่องพิมพ์")'
      : 'เปิดเอกสารไม่สำเร็จ'));
    return false;
  }
}

/** ยิงใบทดสอบพิมพ์ (ไม่ต้องมีบิลจริง) ผ่าน RawBT — ใช้ในหน้าตั้งค่าเครื่องพิมพ์ */
export async function printTest(): Promise<boolean> {
  try {
    const { base64 } = (await api.get('/water/billing/print-test')).data.data as { base64: string };
    sendToRawBT(base64);
    return true;
  } catch (e) {
    toast.error(getErrorMessage(e, 'ทดสอบพิมพ์ไม่สำเร็จ — ติดตั้ง RawBT + จับคู่เครื่องพิมพ์ก่อน'));
    return false;
  }
}
