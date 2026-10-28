'use client';
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Sheet, btn } from '../ui';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';

type ImportRow = { customerCode: string; fullName: string; villageNo: number | null };
type ImportIssue = { line: number; reason: string; raw?: string; kind: 'skip' | 'warn' };
type Result = {
  preview: boolean; total: number; created: number; updated: number; unchanged: number;
  sample: ImportRow[]; issues: ImportIssue[]; skipped: number; warned: number;
};

/**
 * นำเข้าทะเบียนผู้ใช้น้ำจากไฟล์ (.csv จาก Excel หรือ .json) — ใช้ endpoint ที่มีอยู่แล้ว
 * POST /water/customers/import (preview=1 = ตรวจไฟล์เฉยๆ ไม่บันทึกจริง)
 * เทียบรหัสผู้ใช้น้ำ: รหัสเดิมมี → อัปเดตชื่อ/หมู่ถ้าต่าง · รหัสใหม่ → เพิ่มเข้าไป
 */
export function ImportModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<Result | null>(null);
  const [done, setDone] = useState<Result | null>(null);

  const run = async (f: File, dryRun: boolean) => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const { data } = await api.post(`/water/customers/import?preview=${dryRun ? '1' : '0'}`, fd);
      const res: Result = data.data;
      if (dryRun) setPreview(res);
      else {
        setDone(res);
        toast.success(`นำเข้าสำเร็จ — เพิ่มใหม่ ${res.created} · อัปเดต ${res.updated} ราย`);
        qc.invalidateQueries({ queryKey: ['prapa-customers'] });
        qc.invalidateQueries({ queryKey: ['water-villages'] });
        qc.invalidateQueries({ queryKey: ['water-next-customer-code'] });
      }
    } catch (e) { toast.error(getErrorMessage(e, 'นำเข้าไม่สำเร็จ')); }
    finally { setBusy(false); }
  };

  const pick = (f: File) => { setFile(f); setPreview(null); setDone(null); run(f, true); };
  const reset = () => { setFile(null); setPreview(null); setDone(null); };

  return (
    <Sheet size="xl" onClose={onClose}
      title={<span className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-500" /> นำเข้าข้อมูลทะเบียนผู้ใช้น้ำ</span>}>

        {done ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              <span className="text-sm font-semibold">นำเข้าสำเร็จ — เพิ่มใหม่ {done.created} ราย · อัปเดต {done.updated} ราย · ไม่เปลี่ยนแปลง {done.unchanged} ราย</span>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={reset} className={btn('secondary')}>นำเข้าไฟล์อื่นต่อ</button>
              <button onClick={onClose} className={btn('primary')}>เสร็จสิ้น</button>
            </div>
          </div>
        ) : !file ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-5 py-8 text-center sm:p-10">
            <Upload className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-600">เลือกไฟล์ทะเบียนผู้ใช้น้ำ (.csv จาก Excel หรือ .json)</p>
            <p className="mt-1 text-xs text-slate-400">ต้องมีอย่างน้อยคอลัมน์ รหัส / ชื่อ-สกุล / หมู่ (ชื่อหัวตารางไทย/อังกฤษก็ได้) — ถ้าเป็นไฟล์ .xlsx ให้เปิดใน Excel แล้ว &quot;Save As&quot; เป็น CSV ก่อน</p>
            <input ref={fileRef} type="file" accept=".csv,.json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              className={`${btn('primary')} mt-4 w-full sm:w-auto`}>
              {busy ? 'กำลังอ่านไฟล์…' : 'เลือกไฟล์'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">ไฟล์: <b className="text-slate-700">{file.name}</b></p>
            {busy && <p className="py-10 text-center text-sm text-slate-400">กำลังตรวจไฟล์…</p>}
            {preview && (
              <>
                <div className="grid grid-cols-3 gap-2.5">
                  <Stat label="รวมในไฟล์" value={preview.total} tone="text-slate-700" bg="bg-slate-50" />
                  <Stat label="จะเพิ่มใหม่" value={preview.created} tone="text-emerald-600" bg="bg-emerald-50" />
                  <Stat label="จะอัปเดต" value={preview.updated} tone="text-sky-600" bg="bg-sky-50" />
                </div>
                {preview.issues.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                      <AlertTriangle className="h-4 w-4" /> ข้าม/เตือน {preview.skipped + preview.warned} แถว
                    </p>
                    <div className="max-h-32 overflow-auto text-xs text-amber-700">
                      {preview.issues.slice(0, 20).map((it, i) => (
                        <p key={i}>บรรทัด {it.line}: {it.reason}</p>
                      ))}
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto rounded-lg border border-slate-100">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-slate-50 text-slate-500">
                      <th className="px-2 py-1.5 text-left font-medium">รหัส</th>
                      <th className="px-2 py-1.5 text-left font-medium">ชื่อ-สกุล</th>
                      <th className="px-2 py-1.5 text-left font-medium">หมู่</th>
                    </tr></thead>
                    <tbody>{preview.sample.map((r, i) => (
                      <tr key={i} className="border-t border-slate-50">
                        <td className="px-2 py-1 font-mono text-slate-700">{r.customerCode}</td>
                        <td className="px-2 py-1 text-slate-600">{r.fullName}</td>
                        <td className="px-2 py-1 text-slate-600">{r.villageNo ?? '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400">นี่คือพรีวิว — ยังไม่บันทึกจริง</p>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button onClick={reset} className={btn('secondary')}>เลือกไฟล์ใหม่</button>
                  <button onClick={() => run(file, false)} disabled={busy || preview.total === 0} className={btn('success')}>
                    {busy ? 'กำลังนำเข้า…' : `ยืนยันนำเข้าจริง (${preview.created + preview.updated} รายการ)`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
    </Sheet>
  );
}

function Stat({ label, value, tone, bg }: { label: string; value: number; tone: string; bg: string }) {
  return (
    <div className={`rounded-xl border border-slate-100 ${bg} p-3`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums sm:text-xl ${tone}`}>{value.toLocaleString()}</p>
    </div>
  );
}
