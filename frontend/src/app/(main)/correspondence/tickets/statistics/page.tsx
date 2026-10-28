'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PieChart, Inbox, Send, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { toast } from '@/hooks/use-toast';

export default function StatisticsPage() {
  const canAccess = usePermissionGuard('correspondence:read:Ticket');
  const [fiscalYear, setFiscalYear] = useState('');

  const { data: summary } = useQuery({
    queryKey: ['ticket-books-summary-stat'],
    queryFn: async () => {
      const { data } = await api.get('/correspondence/tickets/books/summary');
      return (data.data ?? data) as { books: any[]; years: number[] };
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['ticket-statistics', fiscalYear],
    queryFn: async () => {
      const { data } = await api.get('/correspondence/tickets/statistics', { params: { fiscalYear: fiscalYear || undefined } });
      return (data.data ?? data) as any;
    },
  });

  const exportExcel = async () => {
    try {
      const res = await api.get('/correspondence/tickets/statistics/export', {
        params: { fiscalYear: fiscalYear || undefined }, responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `saraban-statistics-${fiscalYear || 'all'}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('ส่งออกไม่สำเร็จ'); }
  };

  if (!canAccess) return null;

  const maxMonth = Math.max(1, ...(data?.byMonth?.map((m: any) => m.count) || [1]));
  const Card = ({ icon, label, value, tone }: any) => (
    <div className="rounded-xl border border-gray-200 bg-white p-5 flex items-center gap-4">
      <div className={`rounded-full p-3 ${tone}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value ?? 0}</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="สถิติทะเบียน" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/correspondence/tickets"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <PieChart className="h-5 w-5 text-blue-600" />รายงานสถิติทะเบียนสารบรรณ
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-gray-600">ปีงบ พ.ศ.</span>
            <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm" value={fiscalYear} onChange={(e) => setFiscalYear(e.target.value)}>
              <option value="">ทุกปี</option>
              {summary?.years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" />ส่งออก Excel</Button>
          </div>
        </div>

        {isLoading ? <p className="text-gray-400 text-center py-10">กำลังโหลด...</p> : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card icon={<PieChart className="h-6 w-6 text-blue-600" />} tone="bg-blue-50" label="ทั้งหมด" value={data?.totals?.all} />
              <Card icon={<Inbox className="h-6 w-6 text-emerald-600" />} tone="bg-emerald-50" label="ทะเบียนรับ" value={data?.totals?.receive} />
              <Card icon={<Send className="h-6 w-6 text-violet-600" />} tone="bg-violet-50" label="ทะเบียนส่ง" value={data?.totals?.send} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* ตามเล่ม */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="font-semibold text-gray-900 text-sm mb-3">จำนวนตามสมุดทะเบียน</h2>
                <div className="space-y-1.5">
                  {data?.byBook?.filter((b: any) => b.count > 0).length === 0 && <p className="text-sm text-gray-400">ไม่มีข้อมูล</p>}
                  {data?.byBook?.filter((b: any) => b.count > 0).map((b: any) => (
                    <div key={b.key} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                      <span className="text-gray-700">{b.label}</span>
                      <span className="font-semibold text-gray-900">{b.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ตามกอง */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="font-semibold text-gray-900 text-sm mb-3">จำนวนตามกองเจ้าของเรื่อง</h2>
                <div className="space-y-1.5">
                  {(!data?.byDept || data.byDept.length === 0) && <p className="text-sm text-gray-400">ไม่มีข้อมูล</p>}
                  {data?.byDept?.map((d: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                      <span className="text-gray-700">{d.dept}</span>
                      <span className="font-semibold text-gray-900">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ตามเดือน */}
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="font-semibold text-gray-900 text-sm mb-4">จำนวนตามเดือน (ปีปฏิทินที่สร้าง)</h2>
              {(!data?.byMonth || data.byMonth.length === 0) ? <p className="text-sm text-gray-400">ไม่มีข้อมูล</p> : (
                <div className="flex items-end gap-2 h-44">
                  {data.byMonth.map((m: any) => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">{m.count}</span>
                      <div className="w-full bg-blue-500 rounded-t" style={{ height: `${(m.count / maxMonth) * 100}%`, minHeight: '4px' }} />
                      <span className="text-[10px] text-gray-400 rotate-0">{m.month.slice(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
