'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { PermissionGate } from '@/components/shared/permission-gate';

const CURRENT_YEAR = new Date().getFullYear() + 543;

export default function ProjectsPage() {
  const canAccess = usePermissionGuard('projects:read:Project');
  if (!canAccess) return null;
  const [page, setPage] = useState(1);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_YEAR);

  const { data, isLoading } = useQuery({
    queryKey: ['projects', page, fiscalYear],
    queryFn: async () => {
      const { data } = await api.get('/projects', { params: { page, limit: 15, fiscalYear } });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const columns = [
    { key: 'projectNumber', label: 'เลขที่', className: 'font-mono text-xs whitespace-nowrap' },
    {
      key: 'title',
      label: 'ชื่อโครงการ',
      render: (row: any) => (
        <Link href={`/projects/${row.id}`} className="text-blue-600 hover:underline font-medium line-clamp-2">{row.title}</Link>
      ),
    },
    { key: 'department', label: 'กอง/ฝ่าย', render: (row: any) => <span className="text-xs text-gray-600">{row.department?.nameTh || '-'}</span> },
    { key: 'fiscalYear', label: 'ปีงบประมาณ', render: (row: any) => <span className="text-sm text-gray-600">{row.fiscalYear}</span> },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header title="โครงการ / แผนพัฒนา" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader title="ระบบโครงการและแผนพัฒนา" subtitle="ติดตามโครงการตามแผนพัฒนาท้องถิ่น">
          <div className="flex gap-2">
            {[CURRENT_YEAR, CURRENT_YEAR - 1].map((y) => (
              <button key={y} onClick={() => { setFiscalYear(y); setPage(1); }}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${fiscalYear === y ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{y}</button>
            ))}
            <PermissionGate permission="projects:manage:Project">
              <Link href="/projects/new"><Button><Plus className="h-4 w-4 mr-1" />สร้างโครงการ</Button></Link>
            </PermissionGate>
          </div>
        </PageHeader>

        <DataTable
          columns={columns}
          data={data?.data ?? []}
          isLoading={isLoading}
          page={page}
          totalPages={data?.meta?.totalPages ?? 1}
          onPageChange={setPage}
          emptyText="ยังไม่มีโครงการ"
          rowHref={(row: any) => `/projects/${row.id}`}
        />
      </div>
    </div>
  );
}
