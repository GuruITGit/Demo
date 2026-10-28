'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, FileText, X, Lock } from 'lucide-react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';

export default function NewDocumentPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: '',
    categoryId: '',
    docNumber: '',
    accessLevel: 'internal',
    departmentId: user?.departmentId || '',
    docDate: '',
    docYear: '',
    description: '',
    tags: '',
  });

  const { data: categories } = useQuery({
    queryKey: ['doc-categories'],
    queryFn: async () => {
      const { data } = await api.get('/documents/categories');
      return (data.data ?? data) as any[];
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data } = await api.get(`/organizations/${user?.organizationId}/departments`);
      return (data.data ?? data) as any[];
    },
    enabled: !!user?.organizationId,
  });

  const upload = useMutation({
    mutationFn: async (body: typeof form & { file: File }) => {
      const fd = new FormData();
      fd.append('file', body.file);
      fd.append('title', body.title);
      if (body.categoryId) fd.append('categoryId', body.categoryId);
      if (body.docNumber) fd.append('docNumber', body.docNumber);
      fd.append('accessLevel', body.accessLevel);
      if (body.departmentId) fd.append('departmentId', body.departmentId);
      if (body.docDate) fd.append('docDate', body.docDate);
      if (body.docYear) fd.append('docYear', body.docYear);
      if (body.description) fd.append('description', body.description);
      if (body.tags) fd.append('tags', JSON.stringify(body.tags.split(',').map((t) => t.trim()).filter(Boolean)));
      const { data } = await api.post('/documents', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (res) => {
      toast.success('อัปโหลดเอกสารสำเร็จ');
      router.push(`/documents/${res.data?.id || res.data?.data?.id}`);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'ไม่สามารถอัปโหลดได้')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('กรุณาระบุชื่อเอกสาร'); return; }
    if (!file) { toast.error('กรุณาเลือกไฟล์'); return; }
    upload.mutate({ ...form, file });
  };

  const ACCESS_LEVELS = [
    { value: 'public', label: 'สาธารณะ', hint: 'ผู้ใช้ทุกคนในระบบเปิดดูได้' },
    { value: 'internal', label: 'ภายในองค์กร', hint: 'ผู้ใช้ในระบบเปิดดูได้' },
    { value: 'confidential', label: 'ลับ', hint: 'เฉพาะผู้สร้าง คนในหน่วยงานเดียวกัน และผู้ดูแลระบบ' },
  ];
  const accessHint = ACCESS_LEVELS.find((a) => a.value === form.accessLevel)?.hint;

  const formatSize = (bytes: number) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="flex flex-col h-full">
      <Header title="อัปโหลดเอกสาร" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/documents"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900">อัปโหลดเอกสารใหม่</h1>
        </div>

        <form onSubmit={handleSubmit} className="max-w-xl space-y-4 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div>
            <Label>ไฟล์เอกสาร<span className="text-red-500 ml-0.5">*</span></Label>
            {file ? (
              <div className="mt-1 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                </div>
                <button type="button" onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <label className="mt-1 block w-full cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">คลิกเพื่อเลือกไฟล์</p>
                <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, รูปภาพ (สูงสุด 50 MB)</p>
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
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
              <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}>
                <option value="">เลือกหมวดหมู่...</option>
                {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.nameTh}</option>)}
              </select>
            </div>
            <div>
              <Label>ระดับการเข้าถึง</Label>
              <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.accessLevel} onChange={(e) => setForm((p) => ({ ...p, accessLevel: e.target.value }))}>
                {ACCESS_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
          </div>

          {accessHint && (
            <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-600">
              <Lock className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
              <span>{accessHint}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>หน่วยงานเจ้าของเอกสาร</Label>
              <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.departmentId} onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}>
                <option value="">เลือกหน่วยงาน...</option>
                {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
              </select>
            </div>
            <div>
              <Label>เลขที่เอกสาร</Label>
              <Input className="mt-1 font-mono" value={form.docNumber} onChange={(e) => setForm((p) => ({ ...p, docNumber: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>วันที่เอกสาร</Label>
              <Input type="date" className="mt-1" value={form.docDate} onChange={(e) => setForm((p) => ({ ...p, docDate: e.target.value, docYear: e.target.value ? String(new Date(e.target.value).getFullYear() + 543) : p.docYear }))} />
            </div>
            <div>
              <Label>ปีเอกสาร (พ.ศ.)</Label>
              <Input type="number" className="mt-1" placeholder="เช่น 2569" value={form.docYear} onChange={(e) => setForm((p) => ({ ...p, docYear: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label>คำอธิบาย</Label>
            <textarea className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>

          <div>
            <Label>แท็ก</Label>
            <Input className="mt-1" placeholder="แยกด้วยเครื่องหมายจุลภาค เช่น งบประมาณ, 2567, รายงาน" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} />
          </div>

          <div className="pt-2">
            <Button type="submit" loading={upload.isPending}><Upload className="h-4 w-4" />อัปโหลดเอกสาร</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
