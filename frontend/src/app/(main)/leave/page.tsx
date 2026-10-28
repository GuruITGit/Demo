'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatThaiDate } from '@/lib/utils';
import { Plus, Search, CalendarDays } from 'lucide-react';
import { ExportButton } from '@/components/shared/export-button';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { PermissionGate } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { OwnerActions } from '@/components/shared/owner-actions';
import { toast } from '@/hooks/use-toast';

export default function LeavePage() {
  const canAccess = usePermissionGuard('leave:read:LeaveRequest');
  if (!canAccess) return null;
  const { user } = useAuthStore();
  const isManager = user?.roles?.some(r => ['MAYOR', 'CLERK', 'ADMIN', 'SECTION_HEAD', 'DIRECTOR', 'SUPER_ADMIN'].includes(r));
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'my'>(isManager ? 'all' : 'my');
  const [status, setStatus] = useState('');

  const LEAVE_STATUSES = ['', 'รอการอนุมัติ', 'อนุมัติแล้ว', 'ไม่อนุมัติ', 'ยกเลิก'];

  const { data, isLoading } = useQuery({
    queryKey: ['leave', tab, page, search, status],
    queryFn: async () => {
      const endpoint = tab === 'my' ? '/leave/requests/my' : '/leave/requests';
      const { data } = await api.get(endpoint, { params: { page, limit: 15, search, status: status || undefined } });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/leave/requests/${id}`),
    onSuccess: () => { toast.success('ลบคำขอลาสำเร็จ'); qc.invalidateQueries({ queryKey: ['leave'] }); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const columns = [
    { key: 'requestNumber', label: 'เลขที่', className: 'whitespace-nowrap',
      render: (row: any) => (
        <Link href={`/leave/${row.id}`} className="text-blue-600 hover:underline font-mono text-sm">{row.requestNumber}</Link>
      )
    },
    { key: 'leaveType', label: 'ประเภท', render: (row: any) => <span>{row.leaveType?.nameTh || '-'}</span> },
    { key: 'employee', label: 'ผู้ลา', render: (row: any) => <span className="text-sm">{row.employee?.firstNameTh} {row.employee?.lastNameTh}</span> },
    { key: 'startDate', label: 'วันที่เริ่มลา', render: (row: any) => <span className="text-sm text-gray-600">{formatThaiDate(row.startDate)}</span> },
    { key: 'endDate', label: 'ถึงวันที่', render: (row: any) => <span className="text-sm text-gray-600">{formatThaiDate(row.endDate)}</span> },
    { key: 'totalDays', label: 'จำนวนวัน', render: (row: any) => <span className="font-medium">{row.totalDays} วัน</span> },
    { key: 'status', label: 'สถานะ',
      render: (row: any) => <StatusBadge status={row.status} />
    },
    { key: 'actions', label: '', className: 'text-right',
      render: (row: any) => (
        <OwnerActions
          record={{ createdBy: row.employee?.userId }}
          permission="leave:delete:LeaveRequest"
          onDelete={() => del.mutate(row.id)}
          deleting={del.isPending}
          deleteDescription={`ต้องการลบคำขอลา "${row.requestNumber}" ใช่หรือไม่?`}
        />
      )
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="การลา" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader title="การลา" subtitle="บันทึกการลาของบุคลากร (บันทึกแล้วมีผลทันที)">
          <div className="flex gap-2">
            <ExportButton size="sm" options={[{ label: 'Excel การลา', url: '/reports/leave/excel', type: 'excel', filename: 'leave_requests.xlsx' }]} />
            <PermissionGate permission="leave:create:LeaveRequest">
              <Link href="/leave/new">
                <Button><Plus className="h-4 w-4" />ยื่นใบลา</Button>
              </Link>
            </PermissionGate>
          </div>
        </PageHeader>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button onClick={() => { setTab('my'); setPage(1); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'my' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>ใบลาของฉัน</button>
          <button onClick={() => { setTab('all'); setPage(1); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>ทั้งหมด</button>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="ค้นหา..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-10 border border-input bg-background px-3 rounded-md text-sm"
          >
            {LEAVE_STATUSES.map((s) => <option key={s} value={s}>{s || 'ทุกสถานะ'}</option>)}
          </select>
        </div>

        <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} page={page} totalPages={data?.meta?.totalPages ?? 1} onPageChange={setPage} emptyText="ไม่พบใบลา" rowHref={(row: any) => `/leave/${row.id}`} />
      </div>
    </div>
  );
}
