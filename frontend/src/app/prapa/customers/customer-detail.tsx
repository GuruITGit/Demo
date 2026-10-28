'use client';
import { type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Pencil, X, AlertCircle, Receipt, IdCard, Phone, MapPin, Gauge, Route, FileText, Printer, ClipboardList,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import { useCustomerDetail } from './use-customers';
import { MONTH_ABBR, StatusBadge, BILL_STATUS } from './shared';
import type { Customer } from './types';

function Field({ icon: Icon, label, children }: { icon?: any; label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center gap-1 text-xs text-slate-400">{Icon && <Icon className="h-3 w-3" />}{label}</div>
      <div className="text-sm text-slate-800">{children ?? <span className="text-slate-300">—</span>}</div>
    </div>
  );
}

export function CustomerDetail({ id, onClose, onEdit }: { id: string; onClose: () => void; onEdit?: (c: Customer) => void }) {
  const router = useRouter();
  const { data: c, isLoading } = useCustomerDetail(id);
  const val = (v: any) => (v === null || v === undefined || v === '' ? null : v);
  const money2 = (v: any) => (val(v) ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null);

  const printLatestBill = async () => {
    const b = c?.bills?.[0];
    if (!b) return;
    const kind = b.status === 'paid' ? 'receipt' : 'invoice';
    try {
      const res = await api.get(`/water/billing/${b.id}/${kind}`, { responseType: 'blob' });
      const u = URL.createObjectURL(res.data as Blob);
      window.open(u, '_blank');
      setTimeout(() => URL.revokeObjectURL(u), 60000);
    } catch (e) { toast.error(getErrorMessage(e, 'เปิดเอกสารไม่สำเร็จ')); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50" onClick={onClose}>
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 sm:px-5">
          <h3 className="font-semibold text-slate-900">รายละเอียดผู้ใช้น้ำ</h3>
          <div className="flex items-center gap-1">
            {onEdit && c && <button onClick={() => onEdit(c)} aria-label="แก้ไข" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-sky-600"><Pencil className="h-4 w-4" /></button>}
            <button onClick={onClose} aria-label="ปิด" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {isLoading || !c ? (
          <div className="flex flex-1 items-center justify-center text-slate-400">กำลังโหลด...</div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-sky-600">{c.customerCode}</span>
                <StatusBadge s={c.usageStatus} />
              </div>
              <div className="mt-0.5 text-lg font-semibold text-slate-900">{c.fullName}</div>
            </div>

            {/* ยอดค้างชำระ */}
            <div className={`flex items-center justify-between rounded-2xl p-4 ${c.outstanding ? 'bg-rose-50' : 'bg-emerald-50'}`}>
              <div className="flex items-center gap-2">
                {c.outstanding ? <AlertCircle className="h-5 w-5 text-rose-500" /> : <Receipt className="h-5 w-5 text-emerald-500" />}
                <div>
                  <div className="text-xs text-slate-500">ยอดค้างชำระรวม</div>
                  <div className={`text-sm ${c.outstanding ? 'text-rose-600' : 'text-emerald-600'}`}>{c.unpaidCount ? `ค้าง ${c.unpaidCount} งวด` : 'ไม่มีค้างชำระ'}</div>
                </div>
              </div>
              <div className={`text-2xl font-bold ${c.outstanding ? 'text-rose-600' : 'text-emerald-600'}`}>{money2(c.outstanding) || '0.00'}<span className="ml-1 text-sm font-normal text-slate-400">฿</span></div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-2xl bg-slate-50/70 p-4">
              <Field icon={IdCard} label="เลขบัตรประชาชน">{val(c.nationalId)}</Field>
              <Field icon={Phone} label="เบอร์โทร">{val(c.phone)}</Field>
              <div className="col-span-2"><Field icon={MapPin} label="ที่อยู่">
                {val([c.address, c.soi && `ซ.${c.soi}`, c.road && `ถ.${c.road}`, c.villageNo && `หมู่ ${c.villageNo}`].filter(Boolean).join(' '))}
              </Field></div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Gauge className="h-4 w-4 text-violet-500" /> มิเตอร์</div>
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 p-4">
                <Field label="เลขประจำมิเตอร์">{val(c.meterSerial)}</Field>
                <Field label="เลขมิเตอร์ล่าสุด">{val(c.meterLastReading)?.toLocaleString?.() ?? val(c.meterLastReading)}</Field>
                <Field label="ขนาดมิเตอร์">{val(c.meterSizeCode)}</Field>
                <Field label="จำนวนหลัก">{val(c.meterDigits)}</Field>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Route className="h-4 w-4 text-violet-500" /> การเก็บเงิน</div>
              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-100 p-4">
                <Field label="เส้นทางเก็บเงิน">{val(c.collectionRoute)}</Field>
                <Field label="วิธีชำระ">{val(c.payMethod)}</Field>
                <Field label="ค่าธรรมเนียม">{money2(c.feeRate)}</Field>
                <Field label="ค่าขยะ">{money2(c.garbageFee)}</Field>
                <Field label="วันขอใช้น้ำ">{val(c.applyDate)}</Field>
                <Field label="พิกัด GPS">{c.gps ? <a href={`https://www.google.com/maps?q=${encodeURIComponent(c.gps)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-600 underline">{c.gps} <MapPin className="h-3 w-3" /></a> : null}</Field>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Receipt className="h-4 w-4 text-violet-500" /> ประวัติบิล {c.bills?.length ? `(${c.bills.length} ล่าสุด)` : ''}</div>
              {!c.bills?.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">ยังไม่มีบิล</div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-100">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-slate-400">
                        <th className="px-3 py-2 font-medium">งวด</th><th className="px-2 py-2 font-medium">มิเตอร์</th>
                        <th className="px-2 py-2 text-right font-medium">หน่วย</th><th className="px-2 py-2 text-right font-medium">ยอด</th>
                        <th className="px-3 py-2 font-medium">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {c.bills.map((b) => {
                        const st = BILL_STATUS[b.status] || { label: b.status, cls: 'bg-slate-100 text-slate-400' };
                        return (
                          <tr key={b.id}>
                            <td className="px-3 py-2 text-slate-600">{MONTH_ABBR[b.periodMonth]} {String(b.periodYear).slice(-2)}</td>
                            <td className="px-2 py-2 font-mono text-slate-500">
                              {b.prevReading}→{b.currReading}
                              {!!b.editHistory?.length && (
                                <span title={b.editHistory.map((h) => `${h.prevReading}→${h.currReading} โดย ${h.by || '—'} ${new Date(h.at).toLocaleString('th-TH')}`).join('\n')}
                                  className="ml-1 cursor-help rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700">แก้ {b.editHistory.length}</span>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right text-slate-700">{b.units}</td>
                            <td className="px-2 py-2 text-right font-medium text-slate-800">{Number(b.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2"><span className={`inline-block rounded-full px-2 py-0.5 font-medium ${st.cls}`}>{st.label}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ปุ่มลัด */}
        {c && (
          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button onClick={() => router.push('/prapa/reading')} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 py-2.5 text-xs text-slate-600 hover:border-sky-300 hover:text-sky-600"><FileText className="h-4 w-4" /> จดมิเตอร์</button>
            <button onClick={printLatestBill} disabled={!c.bills?.length} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 py-2.5 text-xs text-slate-600 hover:border-sky-300 hover:text-sky-600 disabled:opacity-40"><Printer className="h-4 w-4" /> บิลล่าสุด</button>
            <button onClick={() => router.push('/prapa/notices')} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 py-2.5 text-xs text-slate-600 hover:border-rose-300 hover:text-rose-600"><ClipboardList className="h-4 w-4" /> หนังสือค้าง</button>
          </div>
        )}
      </div>
    </div>
  );
}
