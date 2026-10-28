'use client';
import { useEffect, useState } from 'react';
import { User, Clock, FileText, ShieldCheck } from 'lucide-react';

/**
 * จอลูกค้า (customer display / kiosk) — หน้าต่างที่ 2 หันให้ผู้ใช้น้ำสแกน QR จ่ายเงิน
 * เจ้าหน้าที่กด "เปิดจอลูกค้า" ในหน้ารับชำระ → เปิดหน้านี้ · ข้อมูลผ่าน localStorage (storage event)
 */
type DisplayState = {
  qr?: string; amount?: number; payee?: string; name?: string; code?: string;
  meterSerial?: string; address?: string; billLabel?: string; org?: string; ts?: number;
} | null;
const KEY = 'prapa-display';
const EXPIRE = 180; // วินาที

const money = (n: any) => Number(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const THAI_DAY = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
const THAI_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

export default function CustomerDisplayPage() {
  const [s, setS] = useState<DisplayState>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const read = () => { try { setS(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch { setS(null); } };
    read();
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) read(); };
    window.addEventListener('storage', onStorage);
    const poll = setInterval(read, 800);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => { window.removeEventListener('storage', onStorage); clearInterval(poll); clearInterval(clock); };
  }, []);

  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const dateStr = `วัน${THAI_DAY[now.getDay()]}ที่ ${now.getDate()} ${THAI_MONTH[now.getMonth()]} ${now.getFullYear() + 543}`;
  const elapsed = s?.ts ? Math.floor((now.getTime() - s.ts) / 1000) : 0;
  const remain = Math.max(0, EXPIRE - elapsed);
  const active = !!s?.qr && remain > 0;

  return (
    <div className="relative flex min-h-screen flex-col text-white" style={{ background: 'linear-gradient(135deg, #172554 0%, #1d4ed8 55%, #0ea5e9 100%)' }}>
      {/* Header */}
      <header className="flex items-start justify-between px-8 py-5" style={{ background: 'rgba(8,20,60,0.35)' }}>
        <div className="flex items-center gap-3">
          <User className="h-9 w-9 text-white/80" />
          <div>
            <p className="text-xs text-white/60">ยินดีต้อนรับ</p>
            <p className="text-2xl font-bold">{s?.name || '—'}</p>
          </div>
        </div>
        <div className="text-right text-sm leading-relaxed text-white/85">
          <p>เลขที่ผู้ใช้น้ำ: {s?.code || '—'}</p>
          <p>หมายเลขมาตร: {s?.meterSerial || '-'}</p>
          {s?.address && <p className="max-w-md text-white/70">{s.address}</p>}
        </div>
      </header>

      {/* Center */}
      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-8 md:flex-row md:gap-16">
        {active ? (
          <>
            <div className="text-center">
              <div className="rounded-3xl bg-white p-6 shadow-2xl">
                <img src={s!.qr} alt="QR พร้อมเพย์" className="h-72 w-72" />
              </div>
              <p className="mt-3 text-lg text-white/90">📱 สแกนด้วยแอปธนาคาร</p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-xl text-white/70">ยอดชำระ</p>
              <p className="text-7xl font-extrabold leading-tight">{money(s!.amount)} <span className="text-4xl font-bold">บาท</span></p>
              {s?.billLabel && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm backdrop-blur">
                  <FileText className="h-4 w-4" /> {s.billLabel}
                </div>
              )}
              <div className="mt-6 max-w-xs">
                <p className="flex items-center gap-1.5 text-sm text-white/70"><Clock className="h-4 w-4" /> QR หมดอายุใน {remain} วินาที</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div className="h-full rounded-full bg-amber-400 transition-all duration-1000" style={{ width: `${(remain / EXPIRE) * 100}%` }} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="mb-6 text-8xl">💧</div>
            <p className="text-4xl font-bold">ยินดีต้อนรับ</p>
            <p className="mt-3 text-xl text-white/70">{s?.qr ? 'QR หมดอายุ — กรุณาแจ้งเจ้าหน้าที่' : 'รอเจ้าหน้าที่เลือกรายการชำระเงิน…'}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="flex items-end justify-between px-8 py-4" style={{ background: 'rgba(8,20,60,0.35)' }}>
        <p className="flex items-center gap-1.5 text-sm text-white/70"><ShieldCheck className="h-4 w-4" /> ระบบชำระเงินปลอดภัย · PromptPay</p>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums">{timeStr}</p>
          <p className="text-sm text-white/70">{dateStr}</p>
        </div>
      </footer>
    </div>
  );
}
