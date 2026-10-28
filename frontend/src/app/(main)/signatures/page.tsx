'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { formatThaiDateTime } from '@/lib/utils';
import { Search, PenLine, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { SignatureDrawer } from '@/components/shared/signature-drawer';

interface SignRecord {
  id: string;
  action: string;
  signedAt: string;
  signatureImage: string;
  ticketId: string;
  ticketNumber: string;
  subject: string;
  actorName: string;
  actorPosition: string;
}

export default function SignaturesPage() {
  const canAccess = usePermissionGuard('signatures:read:Signature');
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['signing-history'],
    queryFn: async () => (await api.get('/correspondence/tickets/signatures/history')).data.data as SignRecord[],
  });

  // ลายเซ็นที่บันทึกไว้ (เลือกใช้ตอนเซ็นเอกสาร)
  const { data: me } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => (await api.get('/auth/me')).data.data,
  });
  const [showSigPad, setShowSigPad] = useState(false);
  const savedSig = me?.metadata?.signatureImage as string | undefined;
  const saveSig = useMutation({
    mutationFn: (img: string | null) => api.patch('/auth/me', { signatureImage: img }),
    onSuccess: () => { toast.success('บันทึกลายเซ็นแล้ว'); setShowSigPad(false); qc.invalidateQueries({ queryKey: ['auth', 'me'] }); },
    onError: () => toast.error('บันทึกลายเซ็นไม่สำเร็จ'),
  });

  if (!canAccess) return null;

  const q = search.trim().toLowerCase();
  const rows = q
    ? data.filter((r) => `${r.actorName} ${r.subject} ${r.ticketNumber} ${r.action}`.toLowerCase().includes(q))
    : data;

  return (
    <div className="flex flex-col h-full">
      <Header title="จัดการลายเซ็น" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader title="จัดการลายเซ็น" subtitle="ลายเซ็นที่บันทึกไว้ และประวัติการลงนามทั้งหมด" />

        {/* ลายเซ็นของฉัน */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <PenLine className="h-4 w-4 text-gray-500" />
            <h3 className="font-semibold text-gray-900 text-sm">ลายเซ็นของฉัน</h3>
          </div>
          <p className="text-xs text-gray-500 mb-4">บันทึกลายเซ็นไว้ เพื่อเลือกใช้ตอนเซ็นรับรอง/อนุมัติเอกสารสารบรรณ (ยังเซ็นสดได้เหมือนเดิม)</p>
          {savedSig ? (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={savedSig} alt="ลายเซ็น" className="h-20 rounded-lg border border-gray-200 sig-surface px-2" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowSigPad(true)}><PenLine className="h-4 w-4" />เปลี่ยน</Button>
                <Button variant="outline" size="sm" onClick={() => saveSig.mutate(null)} loading={saveSig.isPending}><Trash2 className="h-4 w-4" />ลบ</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowSigPad(true)}><PenLine className="h-4 w-4" />เพิ่มลายเซ็น</Button>
          )}
        </div>

        {/* ประวัติการลงนาม */}
        <div>
          <h3 className="font-semibold text-gray-900 text-sm mb-1">ประวัติการลงนาม</h3>
          <p className="text-xs text-gray-500">บันทึกการลงนามทั้งหมด (ลายเซ็นวาดสดขณะอนุมัติ)</p>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="ค้นหาผู้ลงนาม / เรื่อง / เลขสารบรรณ" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {isLoading ? (
          <p className="text-gray-400">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <PenLine className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p>ยังไม่มีประวัติการลงนาม</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.signatureImage} alt="ลายเซ็น" className="h-16 w-32 object-contain rounded border border-gray-200 sig-surface shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-800">{r.actorName} <span className="font-normal text-gray-400">— {r.actorPosition}</span></p>
                  <p className="text-sm text-gray-600">{r.action} • <Link href={`/correspondence/tickets/${r.ticketId}`} className="text-blue-600 hover:underline font-mono">{r.ticketNumber}</Link></p>
                  <p className="text-xs text-gray-400 truncate">{r.subject}</p>
                </div>
                <div className="text-xs text-gray-400 shrink-0 text-right">{formatThaiDateTime(r.signedAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSigPad && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowSigPad(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-gray-900 mb-1">บันทึกลายเซ็น</h3>
            <p className="text-xs text-gray-500 mb-3">วาดหรืออัปโหลดรูปลายเซ็น เพื่อใช้เลือกตอนเซ็นเอกสาร</p>
            <SignatureDrawer onSave={(dataUrl) => saveSig.mutate(dataUrl)} onCancel={() => setShowSigPad(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
