'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Send } from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { BOX, BackLink } from '../cz-ui';

/** คะแนน 1–5 ชุดเดียวกับหน้าแรก (กดคะแนนจากหน้าแรก → มาที่นี่พร้อม ?score=) */
const SCORES = [
  { n: 1, label: 'ปรับปรุง' },
  { n: 2, label: 'พอใช้' },
  { n: 3, label: 'ดี' },
  { n: 4, label: 'ดีมาก' },
  { n: 5, label: 'ดีเยี่ยม' },
];

/**
 * แบบประเมินความพึงพอใจ (k24) แบบสั้น — คะแนน + ความเห็น (ไม่บังคับ) + ชื่อ/เบอร์ (ไม่บังคับ)
 * ส่งเข้าช่องทางเดียวกับฟอร์มอื่น (/citizen/report/submit, formKey k24) เจ้าหน้าที่เห็นในหน้าคำร้องเหมือนเดิม
 */
export function FeedbackForm({ formKey, title }: { formKey: string; title: string }) {
  return <Suspense fallback={null}><Inner formKey={formKey} title={title} /></Suspense>;
}

function Inner({ formKey, title }: { formKey: string; title: string }) {
  const q = Number(useSearchParams().get('score'));
  const [score, setScore] = useState<number | null>(q >= 1 && q <= 5 ? q : null);
  const [note, setNote] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!score) { toast.error('กรุณาเลือกคะแนน'); return; }
    setLoading(true);
    try {
      const label = SCORES[score - 1].label;
      const answers: Record<string, string> = {
        คะแนน: `${score} — ${label}`,
        detail: `คะแนน ${score}/5 (${label})${note.trim() ? ` · ${note.trim()}` : ''}`,
      };
      if (note.trim()) answers.ความคิดเห็น = note.trim();
      if (name.trim()) answers.fullName = name.trim();
      if (phone.trim()) answers.phone = phone.trim();
      const fd = new FormData();
      fd.append('formKey', formKey);
      fd.append('formTitle', title);
      fd.append('answers', JSON.stringify(answers));
      await api.post('/citizen/report/submit', fd);
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error(getErrorMessage(err, 'ส่งไม่สำเร็จ ลองใหม่อีกครั้ง'));
    } finally { setLoading(false); }
  };

  if (done) return (
    <div className="mx-auto max-w-xl">
      <div className={`${BOX} text-center`}>
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h1 className="mt-3 text-[24px] font-bold text-[#0F2A44] max-[720px]:text-[20px]">ขอบคุณสำหรับความคิดเห็น</h1>
        <p className="mt-1 text-[#64748B] max-[720px]:text-[14px]">เราจะนำไปปรับปรุงบริการให้ดียิ่งขึ้น</p>
        <Link href="/citizen" className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-full bg-sky-600 px-7 font-semibold text-white transition hover:bg-sky-700">กลับหน้าแรก</Link>
      </div>
    </div>
  );

  const field = 'w-full rounded-xl border border-[#DCEBF8] bg-white px-4 py-3 text-[16px] text-[#0F2A44] outline-none transition placeholder:text-[#94A3B8] focus:border-sky-500 focus:ring-2 focus:ring-sky-100 max-[720px]:text-[15px]';
  return (
    <div className="mx-auto max-w-xl">
      <BackLink href="/citizen">หน้าแรก</BackLink>
      <form onSubmit={submit} className={`${BOX} flex flex-col gap-6 max-[720px]:gap-5`}>
        <div>
          <h1 className="text-[26px] font-bold leading-tight text-[#0F2A44] max-[720px]:text-[21px]">วันนี้ใช้บริการเป็นอย่างไรบ้าง</h1>
          <p className="mt-1 text-[#64748B] max-[720px]:text-[14px]">ใช้เวลาไม่ถึง 1 นาที ไม่ต้องใส่ชื่อก็ได้</p>
        </div>

        <fieldset>
          <legend className="mb-2.5 font-semibold text-[#0F2A44]">ให้คะแนนความพึงพอใจ</legend>
          <div className="grid grid-cols-5 gap-2 max-[720px]:gap-1.5">
            {SCORES.map((s) => {
              const on = score === s.n;
              return (
                <button key={s.n} type="button" onClick={() => setScore(s.n)} aria-pressed={on}
                  className={`flex min-h-[80px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border p-1 text-center transition max-[720px]:min-h-[68px] ${on ? 'border-sky-600 bg-sky-600 text-white' : 'border-[#DCEBF8] bg-[#F7FBFF] text-[#0F2A44] hover:border-sky-400'}`}>
                  <b className="text-[26px] leading-none max-[720px]:text-xl">{s.n}</b>
                  <span className={`text-[13px] font-medium leading-tight max-[720px]:text-[11px] ${on ? 'text-white/90' : 'text-[#64748B]'}`}>{s.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-2 block font-semibold text-[#0F2A44]">อยากบอกอะไรเราเพิ่มเติม <span className="font-normal text-[#94A3B8]">(ไม่บังคับ)</span></span>
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} rows={4}
            placeholder="เช่น เจ้าหน้าที่บริการดี / อยากให้ชำระค่าน้ำได้หลายช่องทาง" className={`${field} resize-none`} />
        </label>

        <div>
          <p className="mb-2 font-semibold text-[#0F2A44]">ให้ติดต่อกลับ <span className="font-normal text-[#94A3B8]">(ไม่บังคับ)</span></p>
          <div className="grid grid-cols-2 gap-3 max-[520px]:grid-cols-1">
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 150))} placeholder="ชื่อ-นามสกุล" className={field} autoComplete="name" />
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d\s-]/g, '').slice(0, 15))} placeholder="เบอร์โทรศัพท์" inputMode="tel" className={field} autoComplete="tel" />
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-sky-600 px-7 text-[17px] font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60">
          <Send className="h-5 w-5" /> {loading ? 'กำลังส่ง…' : 'ส่งความคิดเห็น'}
        </button>
        <p className="-mt-2 text-center text-[13px] text-[#94A3B8]">ข้อมูลใช้เพื่อปรับปรุงบริการของ อบต. เท่านั้น</p>
      </form>
    </div>
  );
}
