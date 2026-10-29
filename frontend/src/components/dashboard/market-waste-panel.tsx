'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Store, Trash2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { money } from '@/lib/payment-labels';

type Stall = { status: 'available' | 'reserved' | 'occupied' };
type Bill = { amount: string };
type WasteSummary = { unpaidCount: number; unpaidTotal: number };

/**
 * หน้าหลัก: ส่วนจัดการค่าแผงตลาดและค่าเก็บขยะบ้าน — แสดงเฉพาะคนที่มีสิทธิ์ ลิงก์ไปหน้าจัดการจริง
 */
export function MarketWastePanel() {
  const canMarket = useAuthStore((s) => s.hasPermission('market:read:MarketStall'));
  const canWaste = useAuthStore((s) => s.hasPermission('waste:read:WasteBill'));

  const stalls = useQuery<Stall[]>({
    queryKey: ['dash-market-stalls'],
    enabled: canMarket,
    queryFn: async () => (await api.get('/market/stalls')).data.data,
  });
  const unpaidRent = useQuery<Bill[]>({
    queryKey: ['dash-market-unpaid'],
    enabled: canMarket,
    queryFn: async () => (await api.get('/market/bills', { params: { status: 'unpaid' } })).data.data,
  });
  const waste = useQuery<WasteSummary>({
    queryKey: ['dash-waste-summary'],
    enabled: canWaste,
    queryFn: async () => (await api.get('/waste/summary')).data.data,
  });

  if (!canMarket && !canWaste) return null;

  const count = (status: Stall['status']) => (stalls.data ?? []).filter((s) => s.status === status).length;
  const unpaidTotal = (unpaidRent.data ?? []).reduce((sum, b) => sum + Number(b.amount), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {canMarket && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Store className="h-5 w-5 text-sky-600" /> ค่าแผงตลาด</h3>
            <Link href="/market" className="text-sm text-blue-600 hover:underline flex items-center gap-1">จัดการแผง <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white border border-slate-200 p-3"><p className="text-xs text-gray-500">ว่าง</p><p className="text-2xl font-bold tabular-nums">{count('available')}</p></div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3"><p className="text-xs text-gray-500">จอง</p><p className="text-2xl font-bold tabular-nums">{count('reserved')}</p></div>
            <div className="rounded-xl bg-sky-100 border border-sky-200 p-3"><p className="text-xs text-gray-500">มีผู้เช่า</p><p className="text-2xl font-bold tabular-nums">{count('occupied')}</p></div>
          </div>
          <p className="mt-4 text-sm text-gray-600">บิลค้างชำระ {(unpaidRent.data ?? []).length} ใบ · รวม {money(unpaidTotal)} บาท</p>
        </div>
      )}
      {canWaste && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><Trash2 className="h-5 w-5 text-emerald-600" /> ค่าเก็บขยะบ้าน</h3>
            <Link href="/waste" className="text-sm text-blue-600 hover:underline flex items-center gap-1">ค้นบิล / รับชำระ <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <p className="text-3xl font-bold tabular-nums">{(waste.data?.unpaidCount ?? 0).toLocaleString()} <span className="text-base font-normal text-gray-500">บิลค้างชำระ</span></p>
          <p className="mt-2 text-sm text-gray-600">รวม {money(waste.data?.unpaidTotal ?? 0)} บาท</p>
        </div>
      )}
    </div>
  );
}
