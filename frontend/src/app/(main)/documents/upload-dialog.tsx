'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { PeoplePicker } from '@/components/shared/people-picker';
import { Upload, FileText, X, Lock } from 'lucide-react';

/** ระดับการเข้าถึงเอกสาร (ตามที่ลูกค้ากำหนด) */
export const ACCESS_LEVELS = [
  { value: 'department', label: 'แค่กอง', hint: 'เฉพาะเจ้าหน้าที่ในกองเดียวกัน + ผู้ดูแลระบบ' },
  { value: 'private', label: 'แค่เฉพาะบุคคล', hint: 'เฉพาะคุณ + ผู้ดูแลระบบ' },
  { value: 'public', label: 'สาธารณะ', hint: 'ทุกคนในระบบเปิดดูได้' },
] as const;

const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1)} MB`);

/** Popup อัปโหลดเอกสาร — เด้งในหน้าแรกคลังเอกสาร (ไม่ต้องไปหน้าใหม่) */
export function UploadDialog({
  open, onClose, initialFile, onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  initialFile?: File | null;
  onUploaded?: () => void;
}) {
  const { user } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: '', categoryId: '', accessLevel: 'department', ownerOrg: '', description: '' });
  const [departmentId, setDepartmentId] = useState('');
  const [allowedUsers, setAllowedUsers] = useState<{ id: string; name: string }[]>([]);

  // เปิด dialog → reset + ใส่ไฟล์ที่ลากมา (ถ้ามี) + เดาชื่อจากชื่อไฟล์
  useEffect(() => {
    if (open) {
      const f = initialFile ?? null;
      setFile(f);
      setForm({ title: f ? f.name.replace(/\.[^.]+$/, '') : '', categoryId: '', accessLevel: 'department', ownerOrg: '', description: '' });
      setDepartmentId('');
      setAllowedUsers([]);
    }
  }, [open, initialFile]);

  const { data: categories } = useQuery({
    queryKey: ['doc-categories'],
    queryFn: async () => (await api.get('/documents/categories')).data.data as any[],
    enabled: open,
  });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get(`/organizations/${user?.organizationId}/departments`)).data.data as any[],
    enabled: open && !!user?.organizationId,
  });

  const upload = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('file', file as File);
      fd.append('title', form.title.trim());
      fd.append('accessLevel', form.accessLevel);
      if (form.categoryId) fd.append('categoryId', form.categoryId);
      if (form.ownerOrg) fd.append('ownerOrg', form.ownerOrg);
      if (form.description) fd.append('description', form.description);
      if (form.accessLevel === 'department' && departmentId) fd.append('departmentId', departmentId);
      if (form.accessLevel === 'private') fd.append('allowedUserIds', JSON.stringify(allowedUsers.map((u) => u.id)));
      return (await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
    },
    onSuccess: (res) => {
      toast.success(`อัปโหลดสำเร็จ เลขที่ ${res.data?.docNumber || ''}`);
      onUploaded?.();
      onClose();
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'อัปโหลดไม่สำเร็จ')),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { toast.error('กรุณาเลือกไฟล์เอกสาร'); return; }
    if (!form.title.trim()) { toast.error('กรุณาระบุชื่อเอกสาร'); return; }
    if (form.accessLevel === 'department' && !departmentId) { toast.error('กรุณาเลือกกองที่เข้าถึงได้'); return; }
    upload.mutate();
  };

  if (!open) return null;
  const hint = ACCESS_LEVELS.find((a) => a.value === form.accessLevel)?.hint;
  const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
        className="w-full max-w-lg rounded-xl bg-white shadow-xl my-auto">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-bold text-gray-900">อัปโหลดเอกสารใหม่</h3>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 px-5 py-4 max-h-[75vh] overflow-y-auto">
          {/* ไฟล์ */}
          <div>
            <Label>ไฟล์เอกสาร<span className="text-red-500 ml-0.5">*</span></Label>
            {file ? (
              <div className="mt-1 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <FileText className="h-5 w-5 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-900">{file.name}</p><p className="text-xs text-gray-500">{fmtSize(file.size)}</p></div>
                <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <label className="mt-1 block w-full cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-5 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
                <Upload className="mx-auto mb-1.5 h-7 w-7 text-gray-400" />
                <p className="text-sm text-gray-600">คลิกเพื่อเลือกไฟล์</p>
                <p className="mt-0.5 text-xs text-gray-400">PDF, Word, Excel, รูปภาพ, zip (≤25 MB)</p>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>

          <div>
            <Label>ชื่อเอกสาร<span className="text-red-500 ml-0.5">*</span></Label>
            <Input className="mt-1" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>หมวดหมู่</Label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}>
                <option value="">เลือกหมวดหมู่...</option>
                {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.nameTh}</option>)}
              </select>
            </div>
            <div>
              <Label>ระดับการเข้าถึง</Label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.accessLevel} onChange={(e) => setForm((p) => ({ ...p, accessLevel: e.target.value }))}>
                {ACCESS_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>
          {hint && (
            <div className="flex items-start gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" /><span>{hint}</span>
            </div>
          )}

          {/* แค่กอง → เลือกกอง */}
          {form.accessLevel === 'department' && (
            <div>
              <Label>เลือกกองที่เข้าถึงได้<span className="text-red-500 ml-0.5">*</span></Label>
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                <option value="">เลือกกอง...</option>
                {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
              </select>
            </div>
          )}

          {/* แค่เฉพาะบุคคล → เลือกบุคคล (tree picker) ได้หลายคน */}
          {form.accessLevel === 'private' && (
            <div>
              <PeoplePicker
                label="เลือกบุคคลที่เข้าถึงได้ (เพิ่มได้หลายคน)"
                value=""
                placeholder="เพิ่มบุคคล..."
                allowClear={false}
                onChange={(id, u: any) => {
                  if (id && !allowedUsers.some((x) => x.id === id)) {
                    setAllowedUsers((p) => [...p, { id, name: u ? `${u.titleTh || ''}${u.fullNameTh}`.trim() : id }]);
                  }
                }}
              />
              {allowedUsers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {allowedUsers.map((u) => (
                    <span key={u.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs text-blue-700">
                      {u.name}
                      <button type="button" onClick={() => setAllowedUsers((p) => p.filter((x) => x.id !== u.id))} className="hover:text-red-600"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-1 text-xs text-gray-400">คุณ (ผู้อัปโหลด) เข้าถึงได้เสมอ</p>
            </div>
          )}

          <div>
            <Label>ผู้สร้าง / หน่วยงานเจ้าของเอกสาร</Label>
            <Input className="mt-1" placeholder="เช่น กองช่าง อบต.ลำนางรอง" value={form.ownerOrg} onChange={(e) => setForm((p) => ({ ...p, ownerOrg: e.target.value }))} />
          </div>

          <div>
            <Label>คำอธิบาย / รายละเอียดเอกสาร</Label>
            <textarea className="mt-1 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2}
              value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>

          {/* ฟิลด์อัตโนมัติ */}
          <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3 text-xs">
            <div><p className="text-gray-400">ผู้อัปโหลด</p><p className="font-medium text-gray-700 truncate">{user?.fullNameTh || '-'}</p></div>
            <div><p className="text-gray-400">วันที่อัปโหลด</p><p className="font-medium text-gray-700">{today}</p></div>
            <div><p className="text-gray-400">เลขที่เอกสาร</p><p className="font-medium text-gray-700">ออกอัตโนมัติ</p></div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button type="submit" loading={upload.isPending}><Upload className="h-4 w-4" />อัปโหลด</Button>
        </div>
      </form>
    </div>
  );
}
