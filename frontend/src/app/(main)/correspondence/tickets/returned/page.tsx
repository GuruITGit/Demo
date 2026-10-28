'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { formatThaiDate } from '@/lib/utils';
import { ArrowLeft, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { UrgencyBadge } from '@/components/shared/status-badge';

export default function ReturnedInboxPage() {
  const canAccess = usePermissionGuard('correspondence:read:Ticket');
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['tickets-returned'],
    queryFn: async () => {
      const { data } = await api.get('/correspondence/tickets/returned');
      return (data.data ?? data) as { total: number; receive: any[]; send: any[] };
    },
  });

  if (!canAccess) return null;

  const Section = ({ title, rows }: { title: string; rows: any[] }) => (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 border-b border-amber-100">
        {title} ({rows?.length || 0})
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">เลขสารบรรณ</th>
            <th className="px-4 py-3 text-left font-semibold">เรื่อง</th>
            <th className="px-4 py-3 text-left font-semibold">กองเจ้าของเรื่อง</th>
            <th className="px-4 py-3 text-left font-semibold">ความเร่งด่วน</th>
            <th className="px-4 py-3 text-left font-semibold">ส่งกลับเมื่อ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {(!rows || rows.length === 0) ? (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">ไม่มีหนังสือตีกลับ</td></tr>
          ) : rows.map((t) => (
            <tr key={t.id} onClick={() => router.push(`/correspondence/tickets/${t.id}`)} className="cursor-pointer hover:bg-amber-50/40">
              <td className="px-4 py-3 font-mono font-semibold text-blue-700">{t.ticketNumber}</td>
              <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{t.subject}</td>
              <td className="px-4 py-3 text-gray-600">{t.ownerDept?.nameTh || '-'}</td>
              <td className="px-4 py-3"><UrgencyBadge level={t.urgencyLevel} size="sm" /></td>
              <td className="px-4 py-3 text-gray-500">{formatThaiDate(t.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="หนังสือตีกลับ" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/correspondence/tickets"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-amber-600" />หนังสือตีกลับ
          </h1>
          {typeof data?.total === 'number' && (
            <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-0.5 text-sm font-bold">{data.total}</span>
          )}
        </div>

        {isLoading ? (
          <p className="text-gray-400 text-center py-10">กำลังโหลด...</p>
        ) : (
          <div className="space-y-5">
            <Section title="ทะเบียนรับ — ตีกลับ" rows={data?.receive || []} />
            <Section title="ทะเบียนส่ง — ตีกลับ" rows={data?.send || []} />
          </div>
        )}
      </div>
    </div>
  );
}
