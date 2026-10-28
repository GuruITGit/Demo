'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatThaiDateTime } from '@/lib/utils';
import { Plus, Search, Video } from 'lucide-react';
import { ExportButton } from '@/components/shared/export-button';
import Link from 'next/link';
import { PermissionGate } from '@/components/shared/permission-gate';
import { StatusBadge } from '@/components/shared/status-badge';
import { OwnerActions } from '@/components/shared/owner-actions';
import { toast } from '@/hooks/use-toast';

const MEETING_STATUSES = ['', 'กำหนดการ', 'กำลังประชุม', 'เสร็จสิ้น', 'ยกเลิก'];

export default function MeetingsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['meetings', page, search, status],
    queryFn: async () => {
      const { data } = await api.get('/meetings', { params: { page, limit: 15, search, status: status || undefined } });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/meetings/${id}`),
    onSuccess: () => { toast.success('ลบการประชุมสำเร็จ'); qc.invalidateQueries({ queryKey: ['meetings'] }); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const columns = [
    { key: 'meetingNumber', label: 'เลขที่' },
    { key: 'title', label: 'หัวข้อ',
      render: (row: any) => (
        <Link href={`/meetings/${row.id}`} className="text-blue-600 hover:underline font-medium line-clamp-1">
          {row.isOnline && <Video className="inline h-3.5 w-3.5 mr-1 text-blue-500" />}
          {row.title}
        </Link>
      )
    },
    { key: 'startDatetime', label: 'วันที่/เวลา', render: (row: any) => <span className="text-sm">{formatThaiDateTime(row.startDatetime)}</span> },
    { key: 'location', label: 'สถานที่', render: (row: any) => <span className="text-sm text-gray-600">{row.location || (row.isOnline ? 'ออนไลน์' : '-')}</span> },
    { key: 'chair', label: 'ประธาน', render: (row: any) => <span className="text-sm">{row.chair?.fullNameTh || '-'}</span> },
    { key: 'status', label: 'สถานะ', render: (row: any) => <StatusBadge status={row.status} /> },
    { key: 'actions', label: '', className: 'text-right',
      render: (row: any) => (
        <OwnerActions
          record={row}
          permission="meetings:delete:Meeting"
          onDelete={() => del.mutate(row.id)}
          deleting={del.isPending}
          deleteDescription={`ต้องการลบการประชุม "${row.title}" ใช่หรือไม่?`}
        />
      )
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="การประชุม" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader title="การประชุม" subtitle={`รายการประชุมทั้งหมด ${data?.meta?.total ?? 0} รายการ`}>
          <div className="flex gap-2">
            <ExportButton size="sm" options={[{ label: 'Excel ประชุม', url: '/reports/meetings/excel', type: 'excel', filename: 'meetings.xlsx' }]} />
            <PermissionGate permission="meetings:create:Meeting">
              <Link href="/meetings/new">
                <Button><Plus className="h-4 w-4" />นัดประชุม</Button>
              </Link>
            </PermissionGate>
          </div>
        </PageHeader>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="ค้นหาหัวข้อ..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-10 border border-input bg-background px-3 rounded-md text-sm"
          >
            {MEETING_STATUSES.map((s) => <option key={s} value={s}>{s || 'ทุกสถานะ'}</option>)}
          </select>
        </div>

        <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} page={page} totalPages={data?.meta?.totalPages ?? 1} onPageChange={setPage} emptyText="ไม่พบรายการประชุม" rowHref={(row: any) => `/meetings/${row.id}`} />
      </div>
    </div>
  );
}
