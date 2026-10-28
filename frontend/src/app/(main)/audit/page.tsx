'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth.store';
import { formatThaiDateTime } from '@/lib/utils';
import { Search, Activity } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePermissionGuard } from '@/hooks/use-permission-guard';

const ACTION_COLOR: Record<string, string> = {
  LOGIN: 'bg-green-100 text-green-700',
  LOGOUT: 'bg-gray-100 text-gray-600',
  CREATE: 'bg-blue-100 text-blue-700',
  UPDATE: 'bg-yellow-100 text-yellow-700',
  DELETE: 'bg-red-100 text-red-700',
  APPROVE: 'bg-purple-100 text-purple-700',
  REJECT: 'bg-orange-100 text-orange-700',
};

export default function AuditPage() {
  const canAccess = usePermissionGuard('audit:read:AuditLog');
  if (!canAccess) return null;
  const { hasRole } = useAuthStore();
  const router = useRouter();

  if (!hasRole(['SUPER_ADMIN', 'ADMIN', 'CLERK'])) {
    router.replace('/dashboard');
    return null;
  }

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [module, setModule] = useState('');

  const ACTIONS = ['', 'LOGIN', 'LOGOUT', 'CREATE', 'UPDATE', 'DELETE', 'READ', 'APPROVE', 'REJECT', 'DOWNLOAD'];
  const MODULES = ['', 'auth', 'document', 'hr', 'leave', 'complaint', 'meeting', 'asset', 'approval', 'correspondence', 'procurement'];

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, search, action, module],
    queryFn: async () => {
      const { data } = await api.get('/audit/logs', { params: { page, limit: 20, search, action: action || undefined, module: module || undefined } });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const columns = [
    { key: 'action', label: 'กิจกรรม',
      render: (row: any) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_COLOR[row.action] ?? 'bg-gray-100 text-gray-600'}`}>
          {row.action}
        </span>
      )
    },
    { key: 'module', label: 'โมดูล', render: (row: any) => <span className="text-sm text-gray-600">{row.module || '-'}</span> },
    { key: 'resourceTitle', label: 'รายละเอียด',
      render: (row: any) => <span className="text-sm text-gray-900 line-clamp-1">{row.resourceTitle || row.resourceId || '-'}</span>
    },
    { key: 'userName', label: 'ผู้ดำเนินการ',
      render: (row: any) => (
        <div>
          <p className="text-sm font-medium text-gray-900">{row.userName || row.userId || '-'}</p>
          <p className="text-xs text-gray-400 font-mono">{row.ipAddress}</p>
        </div>
      )
    },
    { key: 'actedAt', label: 'เวลา', render: (row: any) => <span className="text-xs text-gray-500 whitespace-nowrap">{formatThaiDateTime(row.actedAt)}</span> },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="ประวัติกิจกรรม" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader title="ประวัติกิจกรรม" subtitle="บันทึกกิจกรรมทั้งหมดในระบบ">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Activity className="h-4 w-4" />
            {data?.meta?.total ?? 0} รายการ
          </div>
        </PageHeader>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="ค้นหากิจกรรม..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="h-10 border border-input bg-background px-3 rounded-md text-sm">
            {ACTIONS.map((a) => <option key={a} value={a}>{a || 'ทุกกิจกรรม'}</option>)}
          </select>
          <select value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }} className="h-10 border border-input bg-background px-3 rounded-md text-sm">
            {MODULES.map((m) => <option key={m} value={m}>{m || 'ทุกโมดูล'}</option>)}
          </select>
        </div>

        <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} page={page} totalPages={data?.meta?.totalPages ?? 1} onPageChange={setPage} emptyText="ไม่มีประวัติกิจกรรม" />
      </div>
    </div>
  );
}
