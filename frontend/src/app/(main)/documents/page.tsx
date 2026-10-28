'use client';
import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatThaiDate } from '@/lib/utils';
import { Plus, Search, FileText, Download, Lock, Upload, SlidersHorizontal, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { PermissionGate } from '@/components/shared/permission-gate';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { UploadDialog } from './upload-dialog';

const ACCESS: Record<string, { label: string; cls: string }> = {
  public: { label: 'สาธารณะ', cls: 'bg-green-100 text-green-700 border-green-300' },
  department: { label: 'แค่กอง', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
  private: { label: 'แค่เฉพาะบุคคล', cls: 'bg-red-100 text-red-700 border-red-300' },
  internal: { label: 'สาธารณะ', cls: 'bg-green-100 text-green-700 border-green-300' },
  confidential: { label: 'แค่กอง', cls: 'bg-blue-100 text-blue-700 border-blue-300' },
};

export default function DocumentsPage() {
  const canAccess = usePermissionGuard('dms:read:Document');
  const router = useRouter();
  const qc = useQueryClient();
  const { user, isAdmin } = useAuthStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showAdv, setShowAdv] = useState(false);
  const [adv, setAdv] = useState({ categoryId: '', accessLevel: '', departmentId: '', dateFrom: '', dateTo: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [toDelete, setToDelete] = useState<any>(null);
  const dragCounter = useRef(0);

  const params = () => {
    const p: any = { page, limit: 15, search: search || undefined };
    if (adv.categoryId) p.categoryId = adv.categoryId;
    if (adv.accessLevel) p.accessLevel = adv.accessLevel;
    if (adv.departmentId) p.departmentId = adv.departmentId;
    if (adv.dateFrom) p.dateFrom = adv.dateFrom;
    if (adv.dateTo) p.dateTo = adv.dateTo;
    return p;
  };

  const { data, isLoading } = useQuery({
    queryKey: ['documents', page, search, adv],
    queryFn: async () => (await api.get('/documents', { params: params() })).data,
    placeholderData: (prev) => prev,
  });

  const { data: categories } = useQuery({
    queryKey: ['doc-categories'],
    queryFn: async () => (await api.get('/documents/categories')).data.data as any[],
  });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get(`/organizations/${user?.organizationId}/departments`)).data.data as any[],
    enabled: !!user?.organizationId,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/documents/${id}`),
    onSuccess: () => { toast.success('ลบเอกสารสำเร็จ'); qc.invalidateQueries({ queryKey: ['documents'] }); setToDelete(null); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const rows: any[] = data?.data ?? [];
  const meta = data?.meta;
  const refresh = () => { qc.invalidateQueries({ queryKey: ['documents'] }); setSelected(new Set()); };
  const setAdvField = (k: keyof typeof adv, v: string) => { setAdv((p) => ({ ...p, [k]: v })); setPage(1); };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected((s) => (s.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))));

  // ดาวน์โหลดหลายไฟล์ที่เลือก (เปิดทีละไฟล์ มี delay กัน browser บล็อก)
  const downloadSelected = () => {
    const files = rows.filter((r) => selected.has(r.id) && r.fileUrl && r.fileUrl !== 'text://');
    if (!files.length) { toast.error('ไม่มีไฟล์ให้ดาวน์โหลด'); return; }
    files.forEach((r, i) => setTimeout(() => {
      const a = document.createElement('a');
      a.href = r.fileUrl; a.target = '_blank'; a.rel = 'noopener'; a.download = r.fileName || r.title;
      document.body.appendChild(a); a.click(); a.remove();
    }, i * 400));
    toast.success(`กำลังดาวน์โหลด ${files.length} ไฟล์`);
  };

  // ── ลากไฟล์มาวางในหน้า → เปิด popup อัปโหลด ──
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false); dragCounter.current = 0;
    const f = e.dataTransfer.files?.[0];
    if (f) { setDroppedFile(f); setDialogOpen(true); }
  };

  if (!canAccess) return null;

  return (
    <div className="flex flex-col h-full"
      onDragEnter={(e) => { e.preventDefault(); dragCounter.current++; setDragOver(true); }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { dragCounter.current--; if (dragCounter.current <= 0) setDragOver(false); }}
      onDrop={onDrop}
    >
      <Header title="เอกสาร" />
      <div className="relative flex-1 overflow-y-auto p-6 space-y-5">
        {/* overlay ตอนลากไฟล์ */}
        {dragOver && (
          <div className="pointer-events-none absolute inset-3 z-40 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/90 text-blue-700">
            <Upload className="h-10 w-10 mb-2" />
            <p className="font-semibold">วางไฟล์ที่นี่เพื่ออัปโหลด</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">คลังเอกสาร</h1>
            <p className="text-sm text-gray-500">เอกสารทั้งหมด {meta?.total ?? 0} รายการ · ลากไฟล์มาวางในหน้านี้เพื่ออัปโหลดได้</p>
          </div>
          <PermissionGate permission="dms:create:Document">
            <Button onClick={() => { setDroppedFile(null); setDialogOpen(true); }}><Plus className="h-4 w-4" />อัปโหลดเอกสาร</Button>
          </PermissionGate>
        </div>

        {/* ค้นหา + ฟิลเตอร์ */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input placeholder="ค้นหา ชื่อ / เลขที่ / คำอธิบาย / เจ้าของ" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Button variant={showAdv ? 'default' : 'outline'} onClick={() => setShowAdv((v) => !v)}><SlidersHorizontal className="h-4 w-4" />ฟิลเตอร์</Button>
        </div>

        {showAdv && (
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-gray-600">หมวดหมู่</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" value={adv.categoryId} onChange={(e) => setAdvField('categoryId', e.target.value)}>
                <option value="">ทุกหมวดหมู่</option>
                {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.nameTh}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">ระดับการเข้าถึง</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" value={adv.accessLevel} onChange={(e) => setAdvField('accessLevel', e.target.value)}>
                <option value="">ทุกระดับ</option>
                <option value="public">สาธารณะ</option>
                <option value="department">แค่กอง</option>
                <option value="private">แค่เฉพาะบุคคล</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">หน่วยงาน</label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" value={adv.departmentId} onChange={(e) => setAdvField('departmentId', e.target.value)}>
                <option value="">ทุกหน่วยงาน</option>
                {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">วันที่อัปโหลด (เริ่ม)</label>
              <Input type="date" className="mt-1 bg-white" value={adv.dateFrom} onChange={(e) => setAdvField('dateFrom', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">วันที่อัปโหลด (สิ้นสุด)</label>
              <Input type="date" className="mt-1 bg-white" value={adv.dateTo} onChange={(e) => setAdvField('dateTo', e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={() => { setAdv({ categoryId: '', accessLevel: '', departmentId: '', dateFrom: '', dateTo: '' }); setPage(1); }}>ล้างฟิลเตอร์</Button>
            </div>
          </div>
        )}

        {/* แถบเมื่อเลือกหลายรายการ */}
        {selected.size > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
            <span className="text-sm font-medium text-blue-800">เลือก {selected.size} รายการ</span>
            <Button size="sm" onClick={downloadSelected}><Download className="h-4 w-4" />ดาวน์โหลดที่เลือก</Button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-gray-500 hover:text-gray-700"><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* ตาราง */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="w-10 px-3 py-3"><input type="checkbox" className="h-4 w-4" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} /></th>
                <th className="px-3 py-3 text-left font-semibold">เลขที่</th>
                <th className="px-3 py-3 text-left font-semibold">ชื่อเอกสาร</th>
                <th className="px-3 py-3 text-left font-semibold">หมวดหมู่</th>
                <th className="px-3 py-3 text-left font-semibold">ระดับ</th>
                <th className="px-3 py-3 text-left font-semibold">ผู้อัปโหลด</th>
                <th className="px-3 py-3 text-left font-semibold">วันที่</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">กำลังโหลด...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">ยังไม่มีเอกสาร — ลากไฟล์มาวาง หรือกด "อัปโหลดเอกสาร"</td></tr>
              ) : rows.map((row) => {
                const ac = ACCESS[row.accessLevel] || { label: row.accessLevel, cls: 'bg-gray-100 text-gray-600 border-gray-300' };
                return (
                  <tr key={row.id} className="hover:bg-blue-50/40">
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="h-4 w-4" checked={selected.has(row.id)} onChange={() => toggle(row.id)} /></td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs text-gray-500">{row.docNumber || '-'}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/documents/${row.id}`} className="font-medium text-blue-700 hover:underline line-clamp-1">
                        <FileText className="mr-1 inline h-3.5 w-3.5 text-gray-400" />{row.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{row.category?.nameTh || '-'}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${ac.cls}`}>
                        {row.accessLevel === 'private' && <Lock className="h-3 w-3" />}{ac.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{row.creator?.fullNameTh || '-'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-gray-500">{formatThaiDate(row.createdAt)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {row.fileUrl && row.fileUrl !== 'text://' && (
                          <a href={row.fileUrl} target="_blank" rel="noopener noreferrer" className="rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="ดาวน์โหลด"><Download className="h-4 w-4" /></a>
                        )}
                        {(isAdmin() || row.createdBy === user?.id) && (
                          <PermissionGate permission="dms:delete:Document">
                            <button onClick={() => setToDelete(row)} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="ลบ"><Trash2 className="h-4 w-4" /></button>
                          </PermissionGate>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">ทั้งหมด {meta.total} รายการ</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</Button>
              <span className="px-3 py-2 text-sm">หน้า {meta.page} / {meta.totalPages}</span>
              <Button variant="outline" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}>ถัดไป</Button>
            </div>
          </div>
        )}
      </div>

      <UploadDialog open={dialogOpen} onClose={() => setDialogOpen(false)} initialFile={droppedFile} onUploaded={refresh} />
      <ConfirmDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)} onConfirm={() => toDelete && del.mutate(toDelete.id)} loading={del.isPending}
        title="ลบเอกสาร" description={`ต้องการลบ "${toDelete?.title}" ใช่หรือไม่?`} confirmText="ลบเอกสาร" />
    </div>
  );
}
