/** โครงร่างเทาวิบ (shimmer) ระหว่างโหลดข้อมูล — ใช้ .cz-skeleton จาก globals.css */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`cz-skeleton ${className}`} aria-hidden="true" />;
}

/** แถวโครงร่างสำหรับตาราง/รายการ */
export function SkeletonRows({ rows = 5, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="cz-skeleton h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}
