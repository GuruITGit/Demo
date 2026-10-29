'use client';
import { Header } from '@/components/layout/header';
import { MarketAdmin } from '@/components/market/market-admin';

/** ค่าแผงตลาด (เจ้าหน้าที่ SAO) — ผังแผง ผู้จอง/ผู้เช่า และบิลค่าแผง */
export default function MarketPage() {
  return (
    <>
      <Header title="ค่าแผงตลาด" />
      <div className="flex-1 overflow-y-auto p-6">
        <MarketAdmin />
      </div>
    </>
  );
}
