'use client';
import { useRef, useState } from 'react';
import { api, getErrorMessage } from '@/lib/water-api';
import { ShieldCheck, ShieldAlert, Camera, RotateCw } from 'lucide-react';

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * ประตูตรวจสลิปก่อนรับเงิน (ใช้ทั้งหน้ารับชำระ และตอนจดมิเตอร์)
 * เจ้าหน้าที่ถ่าย/เลือกรูปสลิปของลูกค้า → ส่งไปตรวจกับธนาคาร → ยอดตรง+บัญชีตรง+ไม่ซ้ำ = ผ่าน
 * ผ่านแล้วเท่านั้นถึงจะส่ง verifyId ออกไปให้ปุ่ม "ยืนยันรับเงิน" เปิดใช้งาน
 */
export function SlipVerifyGate({
  billIds, amount, verifyId, onVerified,
}: {
  billIds: string[];
  amount: number;
  verifyId: string | null;
  onVerified: (v: { verifyId: string; amount: number; transRef?: string } | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<string>('');
  const [info, setInfo] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const check = async (file: File) => {
    setBusy(true); setFail(''); setInfo(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('billIds', JSON.stringify(billIds));
      const { data } = await api.post('/water/billing/verify-slip', fd);
      const r = data.data;
      if (r?.ok) { setInfo(r); onVerified({ verifyId: r.verifyId, amount: r.amount, transRef: r.transRef }); }
      else { setFail(r?.reason || 'ตรวจสลิปไม่ผ่าน'); onVerified(null); }
    } catch (e) {
      setFail(getErrorMessage(e, 'ตรวจสลิปไม่สำเร็จ')); onVerified(null);
    } finally { setBusy(false); }
  };

  const reset = () => { setFail(''); setInfo(null); onVerified(null); };

  if (verifyId && info) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">ตรวจสลิปผ่าน — ลูกค้าโอนมาแล้ว {money(info.amount)} บาท</p>
          <p className="text-xs text-emerald-700">
            อ้างอิง <span className="font-mono">{info.transRef}</span>{info.receiverName ? ` · เข้าบัญชี ${info.receiverName}` : ''}
          </p>
        </div>
        <button onClick={reset} title="ตรวจสลิปใหม่" className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-100"><RotateCw className="h-4 w-4" /></button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${fail ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-start gap-2">
        <ShieldAlert className={`mt-0.5 h-4 w-4 shrink-0 ${fail ? 'text-rose-500' : 'text-amber-500'}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${fail ? 'text-rose-700' : 'text-amber-800'}`}>
            {fail || 'ให้ลูกค้าสแกน QR จ่ายก่อน แล้วถ่ายรูปสลิปเพื่อตรวจ'}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">ต้องตรวจสลิปผ่านก่อน ปุ่มยืนยันรับเงินถึงจะกดได้ (ยอดต้องตรง {money(amount)} บาท)</p>
        </div>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) check(f); e.target.value = ''; }} />
      <button onClick={() => fileRef.current?.click()} disabled={busy || !billIds.length || !(amount > 0)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
        <Camera className="h-4 w-4" /> {busy ? 'กำลังตรวจกับธนาคาร…' : fail ? 'ถ่ายสลิปใหม่' : 'ถ่าย/เลือกรูปสลิป เพื่อตรวจ'}
      </button>
    </div>
  );
}
