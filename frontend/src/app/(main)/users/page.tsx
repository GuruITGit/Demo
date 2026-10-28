'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { Search, Plus, Shield, ShieldOff, UserX, Key } from 'lucide-react';
import { formatThaiDateTime } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PermissionGate } from '@/components/shared/permission-gate';

export default function UsersPage() {
  const { hasRole, user: me } = useAuthStore();
  const router = useRouter();

  if (!hasRole(['SUPER_ADMIN', 'ADMIN'])) {
    router.replace('/dashboard');
    return null;
  }

  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [deptId, setDeptId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [status, setStatus] = useState('');

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await api.get(`/organizations/${me?.organizationId}/departments`);
      return (data.data ?? data) as any[];
    },
    enabled: !!me?.organizationId,
  });
  const { data: roles } = useQuery({
    queryKey: ['roles-list'],
    queryFn: async () => (await api.get('/users/roles/list')).data.data as any[],
  });

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, deptId, roleId, status],
    queryFn: async () => {
      const { data } = await api.get('/users', {
        params: {
          page, limit: 15,
          search: search || undefined,
          deptId: deptId || undefined,
          roleId: roleId || undefined,
          status: status || undefined,
        },
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const resetPw = useMutation({
    mutationFn: (id: string) => api.post(`/users/${id}/reset-password`),
    onSuccess: (res) => toast.success(`รหัสผ่านชั่วคราว: ${res.data.data?.tempPassword || res.data.tempPassword}`),
    onError: () => toast.error('ไม่สามารถรีเซ็ตรหัสผ่านได้'),
  });

  const columns = [
    { key: 'fullNameTh', label: 'ชื่อ',
      render: (row: any) => (
        <div>
          <p className="font-medium text-gray-900 text-sm">{row.titleTh}{row.fullNameTh}</p>
          <p className="text-xs text-gray-500">{row.username} • {row.email}</p>
        </div>
      )
    },
    { key: 'department', label: 'กอง', render: (row: any) => <span className="text-sm text-gray-600">{row.department?.nameTh || '-'}</span> },
    { key: 'positionName', label: 'ตำแหน่ง', render: (row: any) => <span className="text-sm text-gray-600">{row.positionName || '-'}</span> },
    { key: 'isActive', label: 'สถานะ',
      render: (row: any) => {
        const locked = row.lockedUntil && new Date(row.lockedUntil) > new Date();
        if (locked) return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">ล็อก</span>;
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${row.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {row.isActive ? 'ใช้งาน' : 'ระงับ'}
          </span>
        );
      }
    },
    { key: 'lastLoginAt', label: 'เข้าสู่ระบบล่าสุด', render: (row: any) => <span className="text-xs text-gray-400">{row.lastLoginAt ? formatThaiDateTime(row.lastLoginAt) : 'ยังไม่เคย'}</span> },
    { key: 'actions', label: '',
      render: (row: any) => (
        <div className="flex gap-1 justify-end">
          <Link href={`/users/${row.id}`}>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">แก้ไข</Button>
          </Link>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700"
            onClick={() => { if (confirm('รีเซ็ตรหัสผ่านผู้ใช้นี้?')) resetPw.mutate(row.id); }}
          >
            <Key className="h-3 w-3" />
          </Button>
        </div>
      )
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="จัดการผู้ใช้" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader title="จัดการผู้ใช้" subtitle="ผู้ใช้งานในระบบทั้งหมด">
          <PermissionGate permission="users:create:User">
            <Link href="/users/new">
              <Button><Plus className="h-4 w-4" />เพิ่มผู้ใช้</Button>
            </Link>
          </PermissionGate>
        </PageHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-55 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="ค้นหา ชื่อ / ชื่อผู้ใช้ / ตำแหน่ง..." className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select value={deptId} onChange={(e) => { setDeptId(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">ทุกกอง</option>
            {departments?.map((d) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
          </select>
          <select value={roleId} onChange={(e) => { setRoleId(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">ทุกบทบาท</option>
            {roles?.filter((r) => r.name !== 'SUPER_ADMIN').map((r) => <option key={r.id} value={r.id}>{r.nameTh || r.name}</option>)}
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">ทุกสถานะ</option>
            <option value="active">ใช้งาน</option>
            <option value="suspended">ระงับ</option>
            <option value="locked">ล็อก</option>
          </select>
          {(deptId || roleId || status || search) && (
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setDeptId(''); setRoleId(''); setStatus(''); setPage(1); }}>ล้างตัวกรอง</Button>
          )}
        </div>

        <DataTable columns={columns} data={data?.data ?? []} isLoading={isLoading} page={page} totalPages={data?.meta?.totalPages ?? 1} onPageChange={setPage} emptyText="ไม่พบผู้ใช้" rowHref={(row: any) => `/users/${row.id}`} />
      </div>
    </div>
  );
}
