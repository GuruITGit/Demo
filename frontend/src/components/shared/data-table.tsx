'use client';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { TableCard, Table, THead, Th, Td, Tr, TableMessage } from './table';
import { Pagination } from './pagination';

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  emptyText?: string;
  keyField?: keyof T;
  /** ถ้ากำหนด → คลิกที่แถวไหนก็ได้เพื่อเปิดรายละเอียด (เว้นการคลิกปุ่ม/ลิงก์/ฟอร์มในแถว) */
  rowHref?: (row: T) => string;
}

export function DataTable<T extends Record<string, any>>({
  columns, data, isLoading, page = 1, totalPages = 1, onPageChange, emptyText = 'ไม่มีข้อมูล', keyField = 'id', rowHref,
}: DataTableProps<T>) {
  const router = useRouter();

  // ข้ามการนำทางถ้าคลิกองค์ประกอบที่โต้ตอบได้ในแถว (ปุ่มลบ/แก้ไข, ลิงก์ชื่อเรื่อง, checkbox ฯลฯ)
  const isInteractive = (el: EventTarget | null) =>
    el instanceof HTMLElement &&
    !!el.closest('a, button, input, select, textarea, label, [role="button"], [data-no-row-nav]');

  return (
    <TableCard>
      <Table>
        <THead>
          {columns.map((col) => <Th key={col.key} className={col.className}>{col.label}</Th>)}
        </THead>
        <tbody>
          {isLoading ? (
            <TableMessage colSpan={columns.length}><Loader2 className="mx-auto h-6 w-6 animate-spin text-sky-500" /></TableMessage>
          ) : data.length === 0 ? (
            <TableMessage colSpan={columns.length}>{emptyText}</TableMessage>
          ) : (
            data.map((row) => {
              const href = rowHref?.(row);
              return (
                <Tr
                  key={String(row[keyField])}
                  onClick={href ? (e) => { if (!isInteractive(e.target)) router.push(href); } : undefined}
                  onKeyDown={href ? (e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !isInteractive(e.target)) {
                      e.preventDefault();
                      router.push(href);
                    }
                  } : undefined}
                  tabIndex={href ? 0 : undefined}
                  aria-label={href ? 'เปิดดูรายละเอียด' : undefined}
                >
                  {columns.map((col) => (
                    <Td key={col.key} className={col.className}>
                      {col.render ? col.render(row) : String(row[col.key] ?? '-')}
                    </Td>
                  ))}
                </Tr>
              );
            })
          )}
        </tbody>
      </Table>
      {onPageChange && <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />}
    </TableCard>
  );
}
