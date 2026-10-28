'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertTriangle, FileText } from 'lucide-react';
import Link from 'next/link';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { StatusBadge, UrgencyBadge } from '@/components/shared/status-badge';

export default function TicketReportPage() {
  const canAccess = usePermissionGuard('correspondence:read:Ticket');
  const { data, isLoading } = useQuery({
    queryKey: ['ticket-report'],
    queryFn: async () => (await api.get('/correspondence/tickets/report')).data.data,
  });
  if (!canAccess) return null;

  const Bar = ({ items, render }: { items: any[]; render: (i: any) => React.ReactNode }) => {
    const max = Math.max(1, ...items.map((i) => i.count));
    return (
      <div className="space-y-2">
        {items.map((i, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className="w-40 shrink-0 text-sm text-gray-700">{render(i)}</div>
            <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(i.count / max) * 100}%` }} />
            </div>
            <span className="w-10 text-right text-sm font-semibold text-gray-700">{i.count}</span>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400">ไม่มีข้อมูล</p>}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="รายงานสารบรรณ" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/correspondence/tickets"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900">รายงานสรุปสารบรรณ</h1>
        </div>

        {isLoading || !data ? <p className="text-gray-400">กำลังโหลด...</p> : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm"><FileText className="h-4 w-4" />สารบรรณทั้งหมด</div>
                <p className="text-3xl font-bold text-gray-900 mt-1">{data.total}</p>
              </div>
              <div className="bg-white rounded-xl border border-red-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 text-red-500 text-sm"><AlertTriangle className="h-4 w-4" />เกินกำหนด</div>
                <p className="text-3xl font-bold text-red-600 mt-1">{data.overdue}</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 text-sm mb-4">ตามสถานะ</h3>
              <Bar items={data.byStatus} render={(i: any) => <StatusBadge status={i.status} size="sm" />} />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 text-sm mb-4">ตามกองเจ้าของเรื่อง</h3>
              <Bar items={data.byDept} render={(i: any) => <span>{i.name}</span>} />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-900 text-sm mb-4">ตามความเร่งด่วน</h3>
              <Bar items={data.byUrgency} render={(i: any) => <UrgencyBadge level={i.name} size="sm" />} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
