'use client';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import type { FormDef, Field } from './form-config';
import { saveMyReport } from '../my-reports';
import { BackLink } from '../cz-ui';
import {
  FileEdit, Paperclip, Hourglass, Search, MapPin, Navigation,
  Camera, CheckCircle2, Copy, Send, X, ExternalLink, Check, Mic, Square,
} from 'lucide-react';

const STEPS = [
  { icon: FileEdit, label: 'กรอกข้อมูล', sub: 'ระบุรายละเอียดคำร้อง' },
  { icon: Paperclip, label: 'แนบเอกสาร', sub: 'รูป/เอกสาร (ถ้ามี)' },
  { icon: Hourglass, label: 'รอตรวจสอบ', sub: 'เจ้าหน้าที่พิจารณา' },
  { icon: Search, label: 'ติดตามสถานะ', sub: 'ด้วยเลขอ้างอิง' },
];

export function FormEngine({ def }: { def: FormDef }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [pdpa, setPdpa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<{ refNo: string } | null>(null);
  const needMap = def.needMap !== false;

  const set = (name: string, v: string) => setAnswers((a) => ({ ...a, [name]: v }));
  const setFile = (name: string, f: File | null) => setFiles((s) => { const n = { ...s }; if (f) n[name] = f; else delete n[name]; return n; });

  const missing = useMemo(() => {
    const req: Field[] = def.sections.flatMap((s) => s.fields).filter((f) => f.required && f.type !== 'info' && f.type !== 'file');
    return req.filter((f) => !answers[f.name]?.trim());
  }, [answers, def]);

  const locateMe = () => {
    if (!window.isSecureContext) { toast.error('ระบุตำแหน่งได้เฉพาะเว็บที่เปิดแบบ https — พิมพ์ที่อยู่เองหรือข้ามขั้นนี้ได้'); return; }
    if (!navigator.geolocation) { toast.error('เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง'); return; }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeo({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) }); setGpsBusy(false); },
      (err) => {
        // code 1 = PERMISSION_DENIED — มักเกิดเพราะเคยกดปิด/ปฏิเสธ popup ขอสิทธิ์ไปแล้ว เบราว์เซอร์เลยบล็อกไม่ถามซ้ำ
        // ต้องไปเปิดสิทธิ์เองที่ไอคอนข้างช่อง URL ถึงจะขอใหม่ได้ — ข้อความเดิมบอกแค่ "กรุณาอนุญาต" ซึ่งกดยังไงก็ไม่ขึ้น popup ให้
        const msg = err.code === 1
          ? 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง — กดไอคอนรูปกุญแจ/ข้อมูลเว็บไซต์ข้างช่อง URL ด้านบน แล้วเปิดสิทธิ์ "ตำแหน่งที่ตั้ง" ใหม่ หรือข้ามขั้นนี้แล้วพิมพ์ที่อยู่ในช่องรายละเอียดแทนได้'
          : err.code === 3
            ? 'ค้นหาตำแหน่งนานเกินไป ลองใหม่อีกครั้ง'
            : 'ระบุตำแหน่งไม่สำเร็จ — ลองใหม่อีกครั้ง หรือข้ามขั้นนี้ได้ (ไม่บังคับ)';
        toast.error(msg);
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missing.length) { toast.error(`กรุณากรอก: ${missing[0].label}`); return; }
    if (!pdpa) { toast.error('กรุณายินยอมการให้ข้อมูลส่วนบุคคล (PDPA)'); return; }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('formKey', def.key);
      fd.append('formTitle', def.title);
      fd.append('answers', JSON.stringify(answers));
      const name = `${answers.prefix ? answers.prefix + ' ' : ''}${answers.fullName || ''}`.trim();
      if (name) fd.append('reporterName', name);
      if (answers.phone) fd.append('reporterPhone', answers.phone);
      if (geo) { fd.append('geoLat', String(geo.lat)); fd.append('geoLng', String(geo.lng)); }
      Object.entries(files).forEach(([field, f]) => fd.append(field, f));
      const { data } = await api.post('/citizen/report/submit', fd);
      setDone({ refNo: data.data.refNo });
      saveMyReport({ refNo: data.data.refNo, phone: answers.phone || '', title: def.title, at: new Date().toISOString() });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error(getErrorMessage(err, 'ส่งคำร้องไม่สำเร็จ'));
    } finally { setLoading(false); }
  };

  if (done) return <Success refNo={done.refNo} onNew={() => { setDone(null); setAnswers({}); setFiles({}); setGeo(null); setPdpa(false); }} />;

  return (
    <div className="cz-anim-in mx-auto max-w-3xl">
      <BackLink href="/citizen/all">กลับรวมบริการ</BackLink>
      <h1 className="mb-1 flex items-center gap-2 text-xl font-bold text-slate-800 sm:text-2xl">
        <FileEdit className="h-6 w-6 text-cyan-500" /> {def.title}
      </h1>
      <p className="text-xs text-slate-400">ช่องที่มีเครื่องหมาย <span className="text-rose-500">*</span> จำเป็นต้องกรอก · ข้อมูลของท่านถูกเก็บเป็นความลับ</p>

      <Stepper />

      <form onSubmit={submit} className="space-y-5">
        {def.sections.map((sec, i) => (
          <section key={i} className="cz-anim-up rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            {sec.title && (
              <h2 className="mb-1 flex items-center gap-2 border-b border-slate-100 pb-3 text-lg font-bold text-slate-900">
                <span className="h-5 w-1 rounded-full bg-cyan-500" aria-hidden="true" /> {sec.title}
              </h2>
            )}
            {sec.help && <p className="mb-3 text-xs text-slate-400">{sec.help}</p>}
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {sec.fields.map((f) => (
                <FieldRow key={f.name} f={f} value={answers[f.name] || ''} onChange={(v) => set(f.name, v)}
                  file={files[f.name]} onFile={(x) => setFile(f.name, x)} />
              ))}
            </div>
          </section>
        ))}

        {needMap && (
          <section className="cz-anim-up rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-slate-800"><MapPin className="h-5 w-5 text-cyan-500" /> ระบุพิกัดตำแหน่ง</h2>
            <p className="mb-3 text-xs text-slate-400">กดปุ่มด้านล่างเพื่อระบุพิกัดจากตำแหน่งปัจจุบัน (ช่วยให้เจ้าหน้าที่หาจุดได้แม่นยำ)</p>
            <button type="button" onClick={locateMe} disabled={gpsBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 disabled:opacity-60">
              <Navigation className="h-4 w-4" /> {gpsBusy ? 'กำลังระบุตำแหน่ง…' : geo ? 'ระบุตำแหน่งใหม่' : 'ใช้ตำแหน่งปัจจุบัน (GPS)'}
            </button>
            {geo && (
              <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><Check className="h-4 w-4" /> ระบุตำแหน่งแล้ว</span>
                  <button type="button" onClick={() => setGeo(null)} className="text-xs text-slate-400 hover:text-rose-500">ล้างตำแหน่ง</button>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500">พิกัด: {geo.lat}, {geo.lng}</p>
                <iframe title="แผนที่ตำแหน่ง" loading="lazy" className="mt-3 h-56 w-full rounded-xl border border-slate-200 bg-white"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${geo.lng - 0.004}%2C${geo.lat - 0.0025}%2C${geo.lng + 0.004}%2C${geo.lat + 0.0025}&layer=mapnik&marker=${geo.lat}%2C${geo.lng}`} />
                <a href={`https://www.openstreetmap.org/?mlat=${geo.lat}&mlon=${geo.lng}#map=17/${geo.lat}/${geo.lng}`} target="_blank" rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-700 hover:underline">
                  <ExternalLink className="h-4 w-4" /> เปิดแผนที่เต็ม (แท็บใหม่)
                </a>
              </div>
            )}
          </section>
        )}

        {/* PDPA */}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <input type="checkbox" checked={pdpa} onChange={(e) => setPdpa(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-600" />
          <span className="text-xs leading-relaxed text-slate-500">
            <b className="text-slate-700">ยินยอมการให้ข้อมูลส่วนบุคคล (PDPA)</b> — ข้าพเจ้ายินยอมให้หน่วยงานเก็บรวบรวม ใช้ และเปิดเผยข้อมูลส่วนบุคคลที่ให้ไว้ในแบบฟอร์มนี้ เพื่อวัตถุประสงค์ในการพิจารณาดำเนินการตามคำร้องและติดต่อประสานงานที่เกี่ยวข้อง ตาม พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
          </span>
        </label>

        <div className="flex items-center justify-end gap-3 pb-4">
          <Link href="/citizen/all" className="rounded-xl border border-slate-200 px-5 py-3 text-sm text-slate-600 hover:bg-slate-50">ยกเลิก</Link>
          <button type="submit" disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-linear-to-r from-cyan-600 to-sky-600 px-7 py-3 text-base font-bold text-white shadow-sm transition hover:opacity-95 disabled:opacity-50">
            {loading ? 'กำลังส่ง…' : 'ส่งคำร้อง'} <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

function Stepper() {
  return (
    <div className="my-6 flex items-start">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={i} className="flex flex-1 items-start last:flex-none">
            <div className="flex flex-col items-center gap-1 text-center">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full ring-2 ${i === 0 ? 'bg-cyan-500 text-white ring-cyan-500' : 'bg-white text-slate-300 ring-slate-200'}`}>
                <Icon className="h-5 w-5" />
              </div>
              <span className={`text-[11px] font-medium ${i === 0 ? 'text-cyan-600' : 'text-slate-400'}`}>{s.label}</span>
              <span className="hidden text-[10px] text-slate-400 sm:block">{s.sub}</span>
            </div>
            {i < STEPS.length - 1 && <div className="mx-1 mt-5 h-0.5 flex-1 rounded bg-slate-200" />}
          </div>
        );
      })}
    </div>
  );
}

const chipOn = 'border-cyan-500 bg-cyan-50 font-semibold text-cyan-700';
const chipOff = 'border-slate-200 text-slate-600 hover:bg-slate-50';
const MAX_FILE = 20 * 1024 * 1024;

function FieldRow({ f, value, onChange, file, onFile }: {
  f: Field; value: string; onChange: (v: string) => void; file?: File; onFile: (f: File | null) => void;
}) {
  const req = f.required ? <span className="text-rose-500"> *</span> : null;
  const optional = !f.required && f.name === 'contact' ? <span className="ml-1 text-xs font-normal text-slate-400">(ไม่บังคับ)</span> : null;
  const base = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100';
  const wrap = f.full || ['textarea', 'radio', 'file', 'info', 'datetime'].includes(f.type) ? 'sm:col-span-2' : '';
  // ช่องที่มีปุ่มหลายตัวข้างใน ใช้ div แทน label กัน label ไปแย่งโฟกัส/คลิกของปุ่ม
  const Wrap = ['textarea', 'radio', 'checkbox', 'file', 'datetime'].includes(f.type) ? 'div' : 'label';

  if (f.type === 'info') return <div className={`${wrap} rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500`}>{f.label}</div>;

  return (
    <Wrap className={`block min-w-0 ${wrap}`}>
      <span className="mb-2 block text-base font-semibold text-slate-800">{f.label}{req}{optional}{f.help && <span className="ml-1 text-xs font-normal text-slate-400">· {f.help}</span>}</span>

      {f.type === 'textarea' ? (
        <VoiceTextarea label={f.label} value={value} onChange={onChange} placeholder={f.placeholder} className={`${base} resize-none`}
          voice={f.name !== 'address'} />
      ) : f.type === 'radio' ? (
        <div>
          <div className="flex flex-wrap gap-2 pt-1">
            {f.options?.map((o) => (
              <button type="button" key={o} aria-pressed={value === o} onClick={() => onChange(value === o ? '' : o)}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition ${value === o ? chipOn : chipOff}`}>
                {o}
              </button>
            ))}
          </div>
          {value && (
            <button type="button" onClick={() => onChange('')} className="mt-2 text-xs text-slate-400 underline underline-offset-2 hover:text-rose-500">
              ล้างตัวเลือก
            </button>
          )}
        </div>
      ) : f.type === 'checkbox' ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {f.options?.map((o) => {
            const sel = (value ? value.split(' | ') : []).includes(o);
            return (
              <button type="button" key={o} aria-pressed={sel}
                onClick={() => {
                  const cur = value ? value.split(' | ') : [];
                  const next = sel ? cur.filter((x) => x !== o) : [...cur, o];
                  onChange(next.join(' | '));
                }}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition ${sel ? chipOn : chipOff}`}>
                {sel ? '✓ ' : ''}{o}
              </button>
            );
          })}
        </div>
      ) : f.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">— เลือก —</option>
          {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : f.type === 'datetime' ? (
        <WhenPicker onChange={onChange} />
      ) : f.type === 'file' ? (
        <FilePicker file={file} onFile={onFile} />
      ) : (
        <input type={f.type === 'tel' ? 'tel' : f.type === 'email' ? 'email' : f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'}
          inputMode={f.type === 'tel' || f.type === 'number' ? 'numeric' : undefined}
          autoComplete={f.name === 'fullName' ? 'name' : f.name === 'phone' || f.type === 'tel' ? 'tel' : f.name === 'contact' || f.type === 'email' ? 'email' : f.name === 'address' ? 'street-address' : 'off'}
          aria-required={f.required || undefined}
          value={value} onChange={(e) => onChange(e.target.value)} placeholder={f.placeholder} className={base} />
      )}
    </Wrap>
  );
}

/* ───────── วันที่ + เวลา แบบเลือกเอง (ตัวเลือกวัน/เวลาของเครื่อง) ───────── */
const thaiDate = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

function WhenPicker({ onChange }: { onChange: (v: string) => void }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const emit = (d: string, t: string) => {
    const dateTxt = d ? thaiDate(new Date(`${d}T00:00:00`)) : '';
    onChange([dateTxt, t ? `เวลา ${t} น.` : ''].filter(Boolean).join(' '));
  };
  // min-w-0 + max-w-full: ช่องวัน/เวลาบน iOS มีความกว้างขั้นต่ำของตัวเอง ถ้าไม่กันจะดันล้นขอบการ์ด (px-2 ให้ค่าเวลาไม่อึดอัดในครึ่งแถว)
  const box = 'block min-h-11 w-full min-w-0 max-w-full appearance-none rounded-xl border border-slate-200 bg-white px-2 py-2.5 text-base outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100';
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block min-w-0">
        <span className="mb-1 block text-xs text-slate-500">วันที่</span>
        <input type="date" value={date} className={box} onChange={(e) => { setDate(e.target.value); emit(e.target.value, time); }} />
      </label>
      <label className="block min-w-0">
        <span className="mb-1 block text-xs text-slate-500">เวลา (โดยประมาณ)</span>
        <input type="time" value={time} className={box} onChange={(e) => { setTime(e.target.value); emit(date, e.target.value); }} />
      </label>
    </div>
  );
}

/* ───────── ช่องข้อความยาว + พูดแทนพิมพ์ (Web Speech API) ───────── */
type SpeechRecLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
type SpeechCtor = new () => SpeechRecLike;
const getSpeechCtor = (): SpeechCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};
const noopSubscribe = () => () => {};

export function VoiceTextarea({ label, value, onChange, placeholder, className, voice = true }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; className: string; voice?: boolean;
}) {
  const supported = useSyncExternalStore(noopSubscribe, () => !!getSpeechCtor(), () => false);
  // กดแล้วไม่ทำงานเงียบ ๆ: บอกสาเหตุจริง (เว็บไม่ได้เปิดแบบ https / เบราว์เซอร์ไม่รองรับ)
  const speechBlocked = () => toast.error(!window.isSecureContext
    ? 'ใช้ไมค์ได้เฉพาะเว็บที่เปิดแบบ https — ลองเปิดจากลิงก์ https หรือพิมพ์เอง'
    : 'เบราว์เซอร์นี้ไม่รองรับการพูดแทนการพิมพ์ — ลองเปิดด้วย Chrome หรือ Safari หรือพิมพ์เอง');
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecLike | null>(null);
  const wantRef = useRef(false);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

  const stop = () => { wantRef.current = false; setListening(false); try { recRef.current?.stop(); } catch { /* ข้าม */ } };
  useEffect(() => () => { wantRef.current = false; try { recRef.current?.abort(); } catch { /* ข้าม */ } }, []);

  // ฟังทีละรอบ (continuous=false) แล้วเริ่มรอบใหม่เองจนกว่าผู้ใช้จะกดหยุด — เสถียรกว่า continuous บน Android
  const startSession = () => {
    const Ctor = getSpeechCtor();
    if (!Ctor || !wantRef.current) return;
    const rec = new Ctor();
    rec.lang = 'th-TH';
    rec.continuous = false;
    rec.interimResults = true;
    const cur = valueRef.current.replace(/\s+$/, '');
    const prefix = cur ? `${cur} ` : '';
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      onChange(prefix + text);
    };
    rec.onerror = (e) => {
      const msg: Record<string, string> = {
        'not-allowed': 'ไม่ได้รับอนุญาตใช้ไมโครโฟน — กรุณากดอนุญาตในเบราว์เซอร์',
        'service-not-allowed': 'ไม่ได้รับอนุญาตใช้ไมโครโฟน — กรุณากดอนุญาตในเบราว์เซอร์',
        'audio-capture': 'ไม่พบไมโครโฟนในอุปกรณ์นี้',
        network: 'ใช้เสียงไม่ได้ในขณะนี้ (ต้องเชื่อมต่ออินเทอร์เน็ต)',
      };
      if (e.error === 'no-speech') { stop(); toast.error('ไม่ได้ยินเสียง ลองกดปุ่มแล้วพูดใหม่'); return; }
      if (e.error !== 'aborted') { stop(); toast.error(msg[e.error] || 'พูดแทนพิมพ์ไม่สำเร็จ'); }
    };
    rec.onend = () => { if (wantRef.current) setTimeout(startSession, 150); else setListening(false); };
    recRef.current = rec;
    try { rec.start(); } catch { stop(); }
  };
  const start = () => { wantRef.current = true; setListening(true); startSession(); };

  return (
    <div>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder}
        aria-label={label} readOnly={listening} className={className} />
      {voice && (
        <div className="mt-2">
          <button type="button" onClick={listening ? stop : () => (supported && window.isSecureContext ? start() : speechBlocked())}
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-base font-semibold transition ${listening ? 'animate-pulse bg-rose-500 text-white' : 'border border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}`}>
            {listening ? <><Square className="h-4 w-4" /> กำลังฟัง… แตะเพื่อหยุด</> : <><Mic className="h-5 w-5" /> แตะแล้วพูดแทนการพิมพ์</>}
          </button>
          <p className="mt-1 text-[11px] text-slate-400">เสียงถูกแปลงเป็นข้อความโดยบริการของเบราว์เซอร์ · โปรดตรวจข้อความก่อนส่ง</p>
        </div>
      )}
    </div>
  );
}

/* ───────── แนบไฟล์: ถ่ายรูปเอง หรือเลือกไฟล์ ───────── */
export function FilePicker({ file, onFile }: { file?: File; onFile: (f: File | null) => void }) {
  const url = useMemo(() => (file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    e.target.value = '';
    if (f && f.size > MAX_FILE) { toast.error('ไฟล์ใหญ่เกิน 20 MB กรุณาเลือกไฟล์ที่เล็กกว่านี้'); return; }
    if (f) onFile(f);
  };

  if (file) {
    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="รูปที่แนบ" className="max-h-56 w-full bg-white object-contain" />
        )}
        <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
          <span className="truncate text-slate-600">{file.name}</span>
          <button type="button" onClick={() => onFile(null)}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-slate-500 hover:bg-white hover:text-rose-500">
            <X className="h-4 w-4" /> เปลี่ยน/ลบ
          </button>
        </div>
      </div>
    );
  }
  const btn = 'flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-5 text-base font-medium text-slate-600 transition hover:border-cyan-300 hover:bg-cyan-50/50';
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className={btn}>
        <Camera className="h-5 w-5 text-cyan-600" /> ถ่ายรูป
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
      </label>
      <label className={btn}>
        <Paperclip className="h-5 w-5 text-cyan-600" /> เลือกไฟล์
        <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={pick} />
      </label>
    </div>
  );
}

function Success({ refNo, onNew }: { refNo: string; onNew: () => void }) {
  return (
    <div className="cz-anim-in mx-auto max-w-lg">
      <div className="cz-anim-scale rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 className="h-12 w-12" /></div>
        <h2 className="text-2xl font-bold text-slate-800">ส่งคำร้องแล้ว</h2>
        <p className="mt-1 text-slate-500">เจ้าหน้าที่จะตรวจสอบและดำเนินการต่อไป</p>
        <div className="mt-5 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
          <p className="text-sm font-semibold text-amber-700">⚠ กรุณาจดเลขอ้างอิงนี้ไว้</p>
          <p className="mt-0.5 text-xs text-amber-600">ใช้สำหรับติดตามสถานะคำร้อง (ระบบไม่ได้ส่ง SMS แจ้งเตือน)</p>
          <p className="mt-1 text-xs text-amber-600">เครื่องนี้จำเลขไว้ให้แล้ว ลืมเลขเมื่อไหร่ เข้า “ติดตามสถานะ” ดูเรื่องของท่านได้</p>
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white py-3 ring-1 ring-amber-200">
            <span className="text-3xl font-extrabold tracking-widest text-slate-800">{refNo}</span>
            <button onClick={() => { navigator.clipboard?.writeText(refNo); toast.success('คัดลอกเลขอ้างอิงแล้ว'); }}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-cyan-600" title="คัดลอก"><Copy className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/citizen" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm text-slate-600 hover:bg-slate-50">หน้าแรก</Link>
          <Link href="/citizen/track" className="rounded-xl border border-cyan-200 bg-white px-5 py-2.5 text-sm font-semibold text-cyan-700 hover:bg-cyan-50">ติดตามสถานะ</Link>
          <button onClick={onNew} className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">ยื่นคำร้องใหม่</button>
        </div>
      </div>
    </div>
  );
}
