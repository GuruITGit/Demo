'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, Settings2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, Sheet, Field, inputCls, btn } from '../ui';

type Job = { status: 'running' | 'done' | 'failed'; startedAt: string; finishedAt?: string; by: string; log: string[]; error?: string };
type LastRun = {
  at: string; by: string; status: 'done' | 'failed'; error?: string | null;
  result?: { customers: { inserted: number; updated: number }; bills: { inserted: number; updated: number }; problems: number; extraCustomers: string[]; notInLegacy: number } | null;
};
type State = { url: string; org: string; user: string; hasPassword: boolean; lastRun: LastRun | null; job: Job | null };

const fmtTime = (s?: string) => (s ? new Date(s).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : '-');

/** ปุ่มอัปเดตข้อมูลผู้ใช้น้ำ/บิลจากระบบประปาเดิม — แสดงเฉพาะแอดมิน */
export function LegacySyncCard() {
  const qc = useQueryClient();
  const [form, setForm] = useState<{ url: string; org: string; user: string; password: string } | null>(null);
  const [showLog, setShowLog] = useState(false);

  const { data: st } = useQuery({
    queryKey: ['water-legacy-sync'],
    queryFn: async () => (await api.get('/water/legacy-sync')).data.data as State,
    // ระหว่างรันถามสถานะทุก 2 วินาที
    refetchInterval: (q) => ((q.state.data as State | undefined)?.job?.status === 'running' ? 2000 : false),
  });
  const running = st?.job?.status === 'running';

  const run = useMutation({
    mutationFn: () => api.post('/water/legacy-sync/run'),
    onSuccess: () => { setShowLog(true); qc.invalidateQueries({ queryKey: ['water-legacy-sync'] }); },
    onError: (err) => toast.error(getErrorMessage(err, 'เริ่มอัปเดตไม่สำเร็จ')),
  });
  const save = useMutation({
    mutationFn: () => {
      const body: any = { url: form!.url, org: form!.org, user: form!.user };
      if (form!.password) body.password = form!.password;
      return api.put('/water/legacy-sync', body);
    },
    onSuccess: () => { toast.success('บันทึกแล้ว'); setForm(null); qc.invalidateQueries({ queryKey: ['water-legacy-sync'] }); },
    onError: (err) => toast.error(getErrorMessage(err, 'บันทึกไม่สำเร็จ')),
  });

  const configured = !!(st?.org && st?.user && st?.hasPassword);
  const last = st?.lastRun;
  const ok = last?.status === 'done' && !last.result?.problems;
  const askRun = () => { if (confirm('อัปเดตผู้ใช้น้ำและบิลทั้งหมดให้ตรงกับระบบเดิม?\nข้อมูลในระบบเราที่ต่างจากระบบเดิมจะถูกแทนที่')) run.mutate(); };

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-semibold text-slate-800">อัปเดตข้อมูลจากระบบประปาเดิม</h2>
          <p className="mt-0.5 text-xs text-slate-500">ดึงผู้ใช้น้ำและบิลทุกรอบจากระบบเดิมมาให้ตรงกัน · ใช้เวลา 1–2 นาที · ระบบเดิมไม่ถูกแก้ไข</p>
        </div>
        <div className="grid shrink-0 grid-cols-[auto_1fr] gap-2 sm:flex">
          <button onClick={() => setForm({ url: st?.url || '', org: st?.org || '', user: st?.user || '', password: '' })} className={btn('secondary')}>
            <Settings2 className="h-4 w-4" /> ตั้งค่า
          </button>
          <button disabled={!configured || running || run.isPending} onClick={askRun} className={btn('primary')}>
            <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} /> {running ? 'กำลังอัปเดต...' : 'อัปเดตจากระบบเดิม'}
          </button>
        </div>
      </div>

      {!configured && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">ยังไม่ได้ตั้งรหัสเข้าระบบเดิม — กด &quot;ตั้งค่า&quot; ก่อน</p>}

      {!running && last && (
        <div className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <div className="min-w-0">
            <div>อัปเดตล่าสุด {fmtTime(last.at)} โดย {last.by}</div>
            {last.status === 'failed' ? <div>ไม่สำเร็จ: {last.error}</div> : last.result && (
              <div>
                ผู้ใช้น้ำ เพิ่ม {last.result.customers.inserted} · แก้ {last.result.customers.updated} · บิล เพิ่ม {last.result.bills.inserted} · แก้ {last.result.bills.updated}
                {' · '}{last.result.problems ? `พบส่วนต่าง ${last.result.problems} จุด` : 'ตรงกับระบบเดิมทั้งหมด'}
              </div>
            )}
          </div>
        </div>
      )}

      {st?.job && (
        <div className="mt-3">
          <button onClick={() => setShowLog((v) => !v)} className="py-1 text-xs text-sky-600 hover:underline">{showLog || running ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}</button>
          {(showLog || running) && (
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-600">{st.job.log.join('\n')}</pre>
          )}
        </div>
      )}

      {form && (
        <Sheet title="รหัสเข้าระบบประปาเดิม" onClose={() => setForm(null)}
          footer={
            <div className="flex gap-2">
              <button onClick={() => setForm(null)} className={btn('secondary')}>ยกเลิก</button>
              <button onClick={() => save.mutate()} disabled={save.isPending || !form.org.trim() || !form.user.trim() || (!st?.hasPassword && !form.password)} className={`${btn('primary')} flex-1`}>บันทึก</button>
            </div>
          }>
          <div className="space-y-3">
            <Field label="ที่อยู่ระบบเดิม"><input value={form.url} autoCapitalize="none" onChange={(e) => setForm({ ...form, url: e.target.value })} className={`${inputCls} font-mono`} placeholder="http://139.59.124.118" /></Field>
            <Field label="รหัสองค์กร"><input value={form.org} autoCapitalize="none" onChange={(e) => setForm({ ...form, org: e.target.value })} className={`${inputCls} font-mono`} /></Field>
            <Field label="ชื่อผู้ใช้"><input value={form.user} autoCapitalize="none" onChange={(e) => setForm({ ...form, user: e.target.value })} className={`${inputCls} font-mono`} /></Field>
            <Field label={`รหัสผ่าน${st?.hasPassword ? ' (เว้นว่าง = ไม่เปลี่ยน)' : ''}`}>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} autoComplete="new-password" />
            </Field>
          </div>
        </Sheet>
      )}
    </Card>
  );
}
