'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { CalendarRange, ChevronRight, FileBarChart } from 'lucide-react';
import Link from 'next/link';
import { usePermissionGuard } from '@/hooks/use-permission-guard';

interface YearRow { year: number; count: number }

export default function SummaryYearsPage() {
  const canAccess = usePermissionGuard('correspondence:summary:Ticket');

  const { data: years = [], isLoading } = useQuery({
    queryKey: ['ticket-summary-years'],
    queryFn: async () => (await api.get('/correspondence/tickets/summary/years')).data.data as YearRow[],
  });

  if (!canAccess) return null;

  return (
    <div className="flex flex-col h-full">
      <Header title="รายงานสรุปสารบรรณ" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader title="รายงานสรุปประจำเดือน" subtitle="เลือกปี พ.ศ. เพื่อดูสรุปสารบรรณรายเดือน (แสดงเฉพาะข้อมูลที่คุณมีสิทธิ์เห็น)" />

        {isLoading ? (
          <p className="text-gray-400">กำลังโหลด...</p>
        ) : years.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FileBarChart className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p>ยังไม่มีข้อมูลสารบรรณในระบบ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {years.map((y) => (
              <Link
                key={y.year}
                href={`/correspondence/reports/${y.year}`}
                className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 hover:border-blue-400 hover:shadow-md transition"
              >
                <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                  <CalendarRange className="h-7 w-7 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold text-gray-900">ปี {y.year}</p>
                  <p className="text-sm text-gray-500">{y.count.toLocaleString()} เรื่อง</p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
