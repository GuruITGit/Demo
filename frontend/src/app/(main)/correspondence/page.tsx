'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatCard } from '@/components/shared/stat-card';
import { formatThaiDateTime } from '@/lib/utils';
import { Plus, Search, Mail, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { ExportButton } from '@/components/shared/export-button';
import Link from 'next/link';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { PermissionGate } from '@/components/shared/permission-gate';
import { StatusBadge, UrgencyBadge, URGENCY_OPTIONS } from '@/components/shared/status-badge';
import { OwnerActions } from '@/components/shared/owner-actions';
import { toast } from '@/hooks/use-toast';

export default function CorrespondencePage() {
  const canAccess = usePermissionGuard('correspondence:read:IncomingDocument');
  if (!canAccess) return null;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [status, setStatus] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState('');

  const INCOMING_STATUSES = ['', 'รอรับ', 'รับแล้ว', 'ดำเนินการ', 'เสร็จสิ้น'];
  const OUTGOING_STATUSES = ['', 'ร่าง', 'ส่งแล้ว', 'รอลงนาม'];
  const URGENCY_LEVELS = ['', ...URGENCY_OPTIONS];

  const { data, isLoading } = useQuery({
    queryKey: ['correspondence', tab, page, search, status, urgencyLevel],
    queryFn: async () => {
      const params: any = { page, limit: 15, search, status: status || undefined };
      if (tab === 'incoming' && urgencyLevel) params.urgencyLevel = urgencyLevel;
      const { data } = await api.get(`/correspondence/${tab}`, { params });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const { data: stats } = useQuery({
    queryKey: ['correspondence', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/correspondence/incoming/stats');
      return data.data;
    },
  });

  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: ({ t, id }: { t: 'incoming' | 'outgoing'; id: string }) =>
      api.delete(`/correspondence/${t}/${id}`),
    onSuccess: () => {
      toast.success('ลบหนังสือสำเร็จ');
      qc.invalidateQueries({ queryKey: ['correspondence'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const incomingColumns = [
    { key: 'receiveNumber', label: 'เลขรับ', className: 'whitespace-nowrap' },
    { key: 'subject', label: 'เรื่อง', className: 'max-w-xs',
      render: (row: any) => (
        <Link href={`/correspondence/${row.id}`} className="text-blue-600 hover:underline font-medium line-clamp-1">{row.subject}</Link>
      )
    },
    { key: 'senderOrg', label: 'จาก', render: (row: any) => <span className="text-sm text-gray-600">{row.senderOrg || '-'}</span> },
    { key: 'urgencyLevel', label: 'ความเร่งด่วน',
      render: (row: any) => <UrgencyBadge level={row.urgencyLevel} />
    },
    { key: 'status', label: 'สถานะ',
      render: (row: any) => <StatusBadge status={row.status} />
    },
    { key: 'receivedAt', label: 'วันที่รับ', render: (row: any) => <span className="text-xs text-gray-500">{formatThaiDateTime(row.receivedAt)}</span> },
    { key: 'actions', label: '', className: 'text-right',
      render: (row: any) => (
        <OwnerActions
          record={row}
          permission="correspondence:delete:IncomingDocument"
          onDelete={() => del.mutate({ t: 'incoming', id: row.id })}
          deleting={del.isPending}
          deleteDescription={`ต้องการลบหนังสือเข้า "${row.subject}" ใช่หรือไม่?`}
        />
      )
    },
  ];

  const outgoingColumns = [
    { key: 'docNumber', label: 'เลขหนังสือ' },
    { key: 'subject', label: 'เรื่อง', render: (row: any) => (
      <Link href={`/correspondence/outgoing/${row.id}`} className="text-blue-600 hover:underline font-medium line-clamp-1">{row.subject}</Link>
    )},
    { key: 'recipientName', label: 'ถึง', render: (row: any) => <span className="text-sm text-gray-600">{row.recipientName}</span> },
    { key: 'status', label: 'สถานะ', render: (row: any) => <StatusBadge status={row.status} /> },
    { key: 'docDate', label: 'วันที่', render: (row: any) => <span className="text-xs text-gray-500">{formatThaiDateTime(row.docDate)}</span> },
    { key: 'actions', label: '', className: 'text-right',
      render: (row: any) => (
        <OwnerActions
          record={row}
          permission="correspondence:delete:OutgoingDocument"
          onDelete={() => del.mutate({ t: 'outgoing', id: row.id })}
          deleting={del.isPending}
          deleteDescription={`ต้องการลบหนังสือส่ง "${row.subject}" ใช่หรือไม่?`}
        />
      )
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="งานสารบรรณ" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader title="งานสารบรรณ" subtitle="จัดการหนังสือราชการเข้า-ออก">
          <div className="flex gap-2">
            <ExportButton size="sm" options={[{ label: 'Excel สารบรรณ', url: '/reports/correspondence/excel', type: 'excel', filename: 'correspondence.xlsx' }]} />
            <PermissionGate permission="correspondence:create:IncomingDocument">
              <Link href="/correspondence/new">
                <Button variant="outline"><Plus className="h-4 w-4" />รับหนังสือใหม่</Button>
              </Link>
            </PermissionGate>
            <PermissionGate permission="correspondence:create:OutgoingDocument">
              <Link href="/correspondence/outgoing/new">
                <Button><Plus className="h-4 w-4" />ส่งหนังสือใหม่</Button>
              </Link>
            </PermissionGate>
          </div>
        </PageHeader>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="รอดำเนินการ" value={stats.pending ?? 0} icon={Clock} iconColor="text-yellow-600" />
            <StatCard title="ทั้งหมด" value={stats.total ?? 0} icon={Mail} iconColor="text-blue-600" />
            <StatCard title="กำลังดำเนินการ" value={stats.inProgress ?? 0} icon={AlertTriangle} iconColor="text-orange-500" />
            <StatCard title="เสร็จสิ้น" value={stats.completed ?? 0} icon={CheckCircle} iconColor="text-green-600" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          <button onClick={() => { setTab('incoming'); setPage(1); setStatus(''); setUrgencyLevel(''); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'incoming' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            หนังสือรับ
          </button>
          <button onClick={() => { setTab('outgoing'); setPage(1); setStatus(''); setUrgencyLevel(''); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'outgoing' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            หนังสือส่ง
          </button>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="ค้นหาเรื่อง, เลขที่..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-10 border border-input bg-background px-3 rounded-md text-sm"
          >
            {(tab === 'incoming' ? INCOMING_STATUSES : OUTGOING_STATUSES).map((s) => (
              <option key={s} value={s}>{s || 'ทุกสถานะ'}</option>
            ))}
          </select>
          {tab === 'incoming' && (
            <select
              value={urgencyLevel}
              onChange={(e) => { setUrgencyLevel(e.target.value); setPage(1); }}
              className="h-10 border border-input bg-background px-3 rounded-md text-sm"
            >
              {URGENCY_LEVELS.map((u) => <option key={u} value={u}>{u || 'ทุกระดับความเร่งด่วน'}</option>)}
            </select>
          )}
        </div>

        {/* Table */}
        <DataTable
          columns={tab === 'incoming' ? incomingColumns : outgoingColumns}
          data={data?.data ?? []}
          isLoading={isLoading}
          page={page}
          totalPages={data?.meta?.totalPages ?? 1}
          onPageChange={setPage}
          emptyText="ไม่พบหนังสือ"
          rowHref={(row: any) => tab === 'incoming' ? `/correspondence/${row.id}` : `/correspondence/outgoing/${row.id}`}
        />
      </div>
    </div>
  );
}
