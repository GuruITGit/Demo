'use client';
import { Header } from '@/components/layout/header';
import { WasteAdmin } from '@/components/waste/waste-admin';

/** ค่าเก็บขยะบ้าน (เจ้าหน้าที่ SAO) — ค้นบิลด้วยบ้านเลขที่ ชื่อ หรือเบอร์ แล้วรับชำระ */
export default function WastePage() {
  return (
    <>
      <Header title="ค่าเก็บขยะบ้าน" />
      <div className="flex-1 overflow-y-auto p-6">
        <WasteAdmin />
      </div>
    </>
  );
}
