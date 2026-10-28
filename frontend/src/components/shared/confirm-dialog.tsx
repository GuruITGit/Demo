'use client';
import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

/**
 * กล่องยืนยันการทำรายการ (โดยเฉพาะการลบ) — ใช้ซ้ำทั้งระบบ
 * ตัวอักษรใหญ่ ปุ่มชัดเจน เพื่อให้ผู้ใช้สูงอายุกดถูก
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'ยืนยันการลบ',
  description = 'คุณต้องการลบรายการนี้ใช่หรือไม่? การลบไม่สามารถย้อนกลับได้',
  confirmText = 'ลบรายการ',
  cancelText = 'ยกเลิก',
  variant = 'destructive',
  loading = false,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'destructive' | 'default';
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {variant === 'destructive' && (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </span>
            )}
            <DialogTitle className="text-xl">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-base text-gray-600 pt-2">{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" size="lg" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant={variant} size="lg" onClick={onConfirm} loading={loading}>
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
