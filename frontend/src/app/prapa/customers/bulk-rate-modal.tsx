'use client';
import { useState } from 'react';
import { Coins } from 'lucide-react';
import { Sheet, Field, inputCls, btn } from '../ui';
import { useBulkRate } from './use-customers';

export function BulkRateModal({ villages, currentVillage, onClose, onDone }: {
  villages: { villageNo: number; count: number }[]; currentVillage: string;
  onClose: () => void; onDone: () => void;
}) {
  const [scope, setScope] = useState<'all' | 'village'>(currentVillage ? 'village' : 'all');
  const [village, setVillage] = useState(currentVillage || '');
  const [price, setPrice] = useState('4');
  const [clear, setClear] = useState(false);
  const run = useBulkRate(onDone);
  const target = scope === 'all' ? 'ผู้ใช้น้ำทุกคน' : `หมู่ ${village || '—'}`;
  return (
    <Sheet onClose={onClose}
      title={<span className="flex items-center gap-2"><Coins className="h-5 w-5 shrink-0 text-amber-500" /> ตั้งราคาต่อหน่วยหลายคน</span>}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className={btn('secondary')}>ยกเลิก</button>
          <button
            onClick={() => run.mutate({ unitPrice: clear ? null : Number(price), scope, villageNo: scope === 'village' && village ? Number(village) : undefined })}
            disabled={run.isPending || (scope === 'village' && !village) || (!clear && !price)}
            className={`${btn('primary')} flex-1`}>
            {run.isPending ? 'กำลังตั้ง...' : 'ตั้งราคา'}
          </button>
        </div>
      }>
        <p className="mb-3 text-xs text-slate-500">แทนการแก้ทีละคน — เลือกขอบเขตแล้วตั้งราคาครั้งเดียว</p>
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs font-medium text-slate-600">ใช้กับ</span>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setScope('all')} className={`h-11 rounded-xl border px-3 text-sm sm:h-10 ${scope === 'all' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600'}`}>ทุกคน</button>
              <button onClick={() => setScope('village')} className={`h-11 rounded-xl border px-3 text-sm sm:h-10 ${scope === 'village' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600'}`}>เฉพาะหมู่</button>
            </div>
          </div>
          {scope === 'village' && (
            <Field label="หมู่">
              <select value={village} onChange={(e) => setVillage(e.target.value)} className={inputCls}>
                <option value="">— เลือกหมู่ —</option>
                {villages.map((v) => <option key={v.villageNo} value={v.villageNo}>หมู่ {v.villageNo} ({v.count} ราย)</option>)}
              </select></Field>
          )}
          <label className="flex items-center gap-2.5 py-1 text-sm text-slate-600">
            <input type="checkbox" className="h-5 w-5 shrink-0 accent-sky-600" checked={clear} onChange={(e) => setClear(e.target.checked)} /> ล้างราคาเฉพาะราย (กลับไปใช้เรตกลาง)
          </label>
          {!clear && (
            <Field label="ราคาต่อหน่วย (บาท)">
              <input type="number" inputMode="decimal" step="0.01" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} /></Field>
          )}
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            จะ{clear ? 'ล้างราคาเฉพาะราย' : `ตั้งราคา ${price || '—'} บาท/หน่วย`}ให้ <b>{target}</b>
          </div>
        </div>
    </Sheet>
  );
}
