'use client';
import { SERVICE_GROUPS, ALL_SERVICES, ServiceTiles } from '../service-grid';
import { BOX, SectionHead, BackLink } from '../cz-ui';

/** หน้ารวมบริการทั้งหมด — แยกตามหมวด การ์ดแบบเดียวกับหน้าแรก */
export default function CitizenAllServices() {
  return (
    <div className="mx-auto max-w-6xl">
      <BackLink href="/citizen">หน้าแรก</BackLink>
      <div className="flex flex-col gap-6 max-[720px]:gap-4">
        <div className="px-1">
          <h1 className="text-[30px] font-bold leading-tight text-[#0F2A44] max-[720px]:text-[24px]">บริการทั้งหมด</h1>
          <p className="mt-1 text-[#64748B] max-[720px]:text-[14px]">{ALL_SERVICES.length} บริการ · ใช้ได้ตลอด 24 ชม. ไม่ต้องเดินทาง</p>
        </div>
        {SERVICE_GROUPS.map((g) => (
          <section key={g.title} className={BOX}>
            <SectionHead title={g.title} sub={`${g.items.length} บริการ`} />
            <ServiceTiles items={g.items} />
          </section>
        ))}
      </div>
    </div>
  );
}
