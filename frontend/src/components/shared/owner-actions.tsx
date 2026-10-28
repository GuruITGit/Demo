'use client';
import * as React from 'react';
import Link from 'next/link';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from './confirm-dialog';
import { useAuthStore } from '@/stores/auth.store';

/**
 * ปุ่มแก้ไข/ลบ ที่เคารพสิทธิ์ความเป็นเจ้าของ
 * แสดงเฉพาะเมื่อผู้ใช้เป็น admin, เป็นผู้สร้างรายการ หรือมี permission ที่กำหนด
 * (ตรงกับกฎฝั่ง backend assertCanModify)
 */
export function OwnerActions({
  record,
  permission,
  editHref,
  onEdit,
  onDelete,
  deleting = false,
  deleteTitle,
  deleteDescription,
  size = 'sm',
  showLabels = false,
}: {
  record?: { createdBy?: string | null } | null;
  permission?: string;
  editHref?: string;
  onEdit?: () => void;
  onDelete?: () => void | Promise<void>;
  deleting?: boolean;
  deleteTitle?: string;
  deleteDescription?: string;
  size?: 'sm' | 'default' | 'lg';
  showLabels?: boolean;
}) {
  const canModify = useAuthStore((s) => s.canModify);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const allowed = canModify(record ?? undefined, permission);
  if (!allowed) return null;

  const hasEdit = !!(editHref || onEdit);

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {hasEdit &&
        (editHref ? (
          <Link href={editHref}>
            <Button variant="outline" size={size} title="แก้ไข">
              <Pencil className="h-4 w-4" />
              {showLabels && 'แก้ไข'}
            </Button>
          </Link>
        ) : (
          <Button variant="outline" size={size} onClick={onEdit} title="แก้ไข">
            <Pencil className="h-4 w-4" />
            {showLabels && 'แก้ไข'}
          </Button>
        ))}

      {onDelete && (
        <>
          <Button
            variant="outline"
            size={size}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            onClick={() => setConfirmOpen(true)}
            title="ลบ"
          >
            <Trash2 className="h-4 w-4" />
            {showLabels && 'ลบ'}
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            onConfirm={async () => {
              await onDelete();
              setConfirmOpen(false);
            }}
            loading={deleting}
            title={deleteTitle}
            description={deleteDescription}
          />
        </>
      )}
    </div>
  );
}
