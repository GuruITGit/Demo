'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/water-api';
import { MONTH_TH } from '@/lib/baht-text';
import { AlertTriangle, MapPin } from 'lucide-react';
import { TableCard, Table, THead, Th, Td, Tr, TableMessage, CodeChip } from '@/components/shared/table';
import { PageHeader, controlBase, MobileList, EmptyState } from '../ui';

const ISSUE: Record<string, { label: string; cls: string }> = {
  broken: { label: 'มาตรชำรุด', cls: 'bg-rose-50 text-rose-600' },
  leak: { label: 'น้ำรั่วภายใน', cls: 'bg-amber-50 text-amber-600' },
  unreadable: { label: 'หน้าปัดมองไม่เห็น', cls: 'bg-orange-50 text-orange-600' },
  blocked: { label: 'มีสิ่งกีดขวาง', cls: 'bg-yellow-50 text-yellow-700' },
  other: { label: 'อื่นๆ', cls: 'bg-slate-100 text-slate-500' },
};

export default function PrapaIssuesPage() {
  const nowBE = new Date().getFullYear() + 543;
  const [year, setYear] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [villageNo, setVillageNo] = useState('');

  const { data: villages } = useQuery({
    queryKey: ['water-villages'],
    queryFn: async () => (await api.get('/water/customers/villages')).data.data as any[],
  });
  const { data, isLoading } = useQuery({
    queryKey: ['prapa-issues', year, month, villageNo],
    queryFn: async () => (await api.get('/water/billing/issues/list', {
      params: { year: year || undefined, month: month || undefined, villageNo: villageNo || undefined },
    })).data.data as any,
  });

  const sel = `${controlBase} min-w-0 px-3`;
  const issueOf = (t: string) => ISSUE[t] || { label: t, cls: 'bg-slate-100 text-slate-500' };
  const mapUrl = (gps: string) => `https://www.google.com/maps?q=${encodeURIComponent(gps)}`;

  return (
    <div className="space-y-4">
      <PageHeader icon={AlertTriangle} iconClass="text-amber-500" title="มาตรวัดน้ำที่มีปัญหา" desc="มาตรที่เจ้าหน้าที่แจ้งปัญหาตอนจด" />

      <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
        <select value={month} onChange={(e) => setMonth(e.target.value)} className={`${sel} sm:w-36`}>
          <option value="">ทุกเดือน</option>
          {Object.entries(MONTH_TH).map(([m, name]) => <option key={m} value={m}>{name}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(e.target.value)} className={`${sel} sm:w-28`}>
          <option value="">ทุกปี</option>
          {[nowBE + 1, nowBE, nowBE - 1, nowBE - 2].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={villageNo} onChange={(e) => setVillageNo(e.target.value)} className={`${sel} sm:w-28`}>
          <option value="">ทุกหมู่</option>
          {villages?.map((v) => <option key={v.villageNo} value={v.villageNo}>หมู่ {v.villageNo}</option>)}
        </select>
        <span className="col-span-3 text-sm text-slate-400 sm:ml-auto">พบ {data?.count ?? 0} รายการ</span>
      </div>

      {/* สรุปตามประเภท */}
      {data?.byType && Object.keys(data.byType).length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {Object.entries(data.byType).map(([t, n]) => {
            const m = issueOf(t);
            return <span key={t} className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${m.cls}`}>{m.label} <b className="tabular-nums">{n as number}</b></span>;
          })}
        </div>
      )}

      {/* มือถือ: รายการกระชับ */}
      <div className="sm:hidden">
        {isLoading ? <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
        : !data?.rows?.length ? <EmptyState title="ไม่พบมาตรที่มีปัญหา" />
        : (
          <MobileList>
            {data.rows.map((r: any) => {
              const m = issueOf(r.issueType);
              return (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{r.fullName}</p>
                    <p className="truncate text-xs text-slate-400"><span className="font-mono">{r.customerCode}</span> · หมู่ {r.villageNo ?? '-'} · {MONTH_TH[r.periodMonth]?.slice(0, 3)} {String(r.periodYear).slice(-2)} · {r.units} หน่วย</p>
                    <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
                      <span className={`shrink-0 rounded-full px-2 py-0.5 font-medium ${m.cls}`}>{m.label}</span>
                      {r.note && <span className="truncate text-slate-400">{r.note}</span>}
                    </p>
                  </div>
                  {r.gps && (
                    <a href={mapUrl(r.gps)} target="_blank" rel="noreferrer" aria-label="เปิดแผนที่"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-sky-600 active:bg-slate-50"><MapPin className="h-4 w-4" /></a>
                  )}
                </div>
              );
            })}
          </MobileList>
        )}
      </div>

      {/* จอใหญ่: ตารางกลาง */}
      <TableCard className="hidden sm:block">
        <Table>
          <THead>
            <Th>รหัส</Th><Th>ชื่อ-สกุล</Th><Th>หมู่</Th><Th>งวด</Th><Th align="right">หน่วย</Th><Th>ปัญหา</Th><Th>หมายเหตุ</Th><Th />
          </THead>
          <tbody>
            {isLoading ? <TableMessage colSpan={8}>กำลังโหลด...</TableMessage>
            : !data?.rows?.length ? <TableMessage colSpan={8}>ไม่พบมาตรที่มีปัญหา</TableMessage>
            : data.rows.map((r: any) => {
              const m = issueOf(r.issueType);
              return (
                <Tr key={r.id}>
                  <Td><CodeChip>{r.customerCode}</CodeChip></Td>
                  <Td className="text-slate-800">{r.fullName}</Td>
                  <Td className="text-slate-500">{r.villageNo ?? '-'}</Td>
                  <Td className="whitespace-nowrap text-slate-500">{MONTH_TH[r.periodMonth]?.slice(0, 3)} {String(r.periodYear).slice(-2)}</Td>
                  <Td align="right" className="text-slate-700">{r.units}</Td>
                  <Td><span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}>{m.label}</span></Td>
                  <Td className="text-slate-400">{r.note || '—'}</Td>
                  <Td align="right">
                    {r.gps && <a href={mapUrl(r.gps)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-sky-600 hover:underline"><MapPin className="h-3.5 w-3.5" /> แผนที่</a>}
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </Table>
      </TableCard>
    </div>
  );
}
