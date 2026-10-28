'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Header } from '@/components/layout/header';
import { useAuthStore } from '@/stores/auth.store';
import {
  Newspaper, Plus, Pencil, Trash2, X, Eye, EyeOff, Pin, ImageIcon, Calendar,
} from 'lucide-react';

type NewsItem = {
  id: string; title: string; category: string; excerpt: string | null; content: string | null;
  coverUrl: string | null; status: string; pinned: boolean; publishedAt: string | null; createdAt: string;
};
const CATEGORIES = ['ข่าวประชาสัมพันธ์', 'ประกาศจัดซื้อจัดจ้าง', 'กิจกรรม', 'ประกาศทั่วไป'];

const apiOrigin = (() => {
  const b = api.defaults.baseURL || '';
  if (b.startsWith('http')) { try { return new URL(b).origin; } catch { /* noop */ } }
  return typeof window !== 'undefined' ? window.location.origin : '';
})();
const normUrl = (u?: string | null) => {
  if (!u || !u.includes('/v1/storage/files/')) return u || undefined;
  try { const p = new URL(u, apiOrigin || 'http://x'); return `${apiOrigin || p.origin}${p.pathname}${p.search}`; } catch { return u; }
};
const thaiDate = (iso?: string | null) => { try { return iso ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : ''; } catch { return ''; } };

export default function NewsAdminPage() {
  const canManage = useAuthStore((s) => s.hasPermission('news:manage:News'));
  const qc = useQueryClient();
  const [editing, setEditing] = useState<NewsItem | null | 'new'>(null);

  const { data, isLoading } = useQuery<NewsItem[]>({
    queryKey: ['news-admin'],
    queryFn: async () => (await api.get('/news')).data.data,
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/news/${id}`),
    onSuccess: () => { toast.success('ลบข่าวแล้ว'); qc.invalidateQueries({ queryKey: ['news-admin'] }); },
    onError: (e) => toast.error(getErrorMessage(e, 'ลบไม่สำเร็จ')),
  });
  const toggle = useMutation({
    mutationFn: (n: NewsItem) => { const fd = new FormData(); fd.append('status', n.status === 'published' ? 'draft' : 'published'); return api.patch(`/news/${n.id}`, fd); },
    onSuccess: () => { toast.success('อัปเดตสถานะแล้ว'); qc.invalidateQueries({ queryKey: ['news-admin'] }); },
    onError: (e) => toast.error(getErrorMessage(e, 'อัปเดตไม่สำเร็จ')),
  });

  return (
    <>
      <Header title="ข่าว / ประกาศ" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm text-slate-500">จัดการข่าว/ประกาศที่แสดงบนพอร์ทัลประชาชน</p>
            {canManage && (
              <button onClick={() => setEditing('new')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700">
                <Plus className="h-4 w-4" /> สร้างข่าว
              </button>
            )}
          </div>

          {isLoading ? (
            <p className="py-16 text-center text-sm text-slate-400">กำลังโหลด…</p>
          ) : !data?.length ? (
            <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center shadow-sm">
              <Newspaper className="mx-auto mb-2 h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-400">ยังไม่มีข่าว — กด “สร้างข่าว” เพื่อเริ่มต้น</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((n) => (
                <div key={n.id} className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {n.coverUrl
                      ? <img src={normUrl(n.coverUrl)} alt="" className="h-full w-full object-cover" />
                      : <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-6 w-6 text-gray-400" /></div>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{n.category}</span>
                      {n.status === 'published'
                        ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">เผยแพร่แล้ว</span>
                        : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">ฉบับร่าง</span>}
                      {n.pinned && <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-600"><Pin className="h-3 w-3" /> ปักหมุด</span>}
                    </div>
                    <p className="mt-1 line-clamp-1 font-semibold text-slate-800">{n.title}</p>
                    <p className="flex items-center gap-1 text-xs text-slate-400"><Calendar className="h-3 w-3" /> {thaiDate(n.publishedAt || n.createdAt)}</p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button onClick={() => toggle.mutate(n)} title={n.status === 'published' ? 'ซ่อน (ฉบับร่าง)' : 'เผยแพร่'}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-cyan-600">
                        {n.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button onClick={() => setEditing(n)} title="แก้ไข" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-cyan-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`ลบข่าว “${n.title}”?`)) del.mutate(n.id); }} title="ลบ" className="rounded-lg p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && <Editor item={editing === 'new' ? null : editing} onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['news-admin'] }); }} />}
    </>
  );
}

function Editor({ item, onClose, onSaved }: { item: NewsItem | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(item?.title || '');
  const [category, setCategory] = useState(item?.category || CATEGORIES[0]);
  const [excerpt, setExcerpt] = useState(item?.excerpt || '');
  const [content, setContent] = useState(item?.content || '');
  const [status, setStatus] = useState(item?.status || 'published');
  const [pinned, setPinned] = useState(item?.pinned || false);
  // วันที่เผยแพร่ (ปฏิทินไทย) — ค่าเริ่มต้น = วันที่เดิมของข่าว หรือวันนี้ · ใช้ลงข่าวย้อนหลังให้วันที่ตรงกับวันจัดกิจกรรม
  const bkkDay = (d: Date) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);
  const [pubDate, setPubDate] = useState(bkkDay(item?.publishedAt ? new Date(item.publishedAt) : new Date()));
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(item?.coverUrl ? (normUrl(item.coverUrl) ?? null) : null);

  const save = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('title', title); fd.append('category', category);
      fd.append('excerpt', excerpt); fd.append('content', content);
      fd.append('status', status); fd.append('pinned', String(pinned));
      if (status === 'published') fd.append('publishedAt', pubDate);
      if (cover) fd.append('cover', cover);
      return item ? api.patch(`/news/${item.id}`, fd) : api.post('/news', fd);
    },
    onSuccess: () => { toast.success(item ? 'บันทึกการแก้ไขแล้ว' : 'สร้างข่าวแล้ว'); onSaved(); },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });

  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-800">{item ? 'แก้ไขข่าว' : 'สร้างข่าว/ประกาศ'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-4 p-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">หัวข้อ *</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder="หัวข้อข่าว/ประกาศ" />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600">หมวด</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600">รูปปก</span>
              <input type="file" accept="image/*"
                onChange={(e) => { const file = e.target.files?.[0] || null; setCover(file); setCoverPreview(file ? URL.createObjectURL(file) : (item?.coverUrl ? (normUrl(item.coverUrl) ?? null) : null)); }}
                className="w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-cyan-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-cyan-700" />
            </label>
          </div>
          {coverPreview && (
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <img src={coverPreview} alt="ตัวอย่างรูปปก" className="max-h-48 w-full object-cover" />
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">สรุปย่อ</span>
            <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} className={`${field} resize-none`} placeholder="สรุปสั้นๆ แสดงในการ์ดข่าว" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600">เนื้อหา</span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} className={`${field} resize-none`} placeholder="รายละเอียดข่าว/ประกาศ" />
          </label>
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              วันที่เผยแพร่
              <input type="date" value={pubDate} max={bkkDay(new Date())} disabled={status !== 'published'}
                onChange={(e) => e.target.value && setPubDate(e.target.value)}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-cyan-400 disabled:opacity-50" />
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={status === 'published'} onChange={(e) => setStatus(e.target.checked ? 'published' : 'draft')} className="h-4 w-4 accent-cyan-600" />
              เผยแพร่ทันที
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="h-4 w-4 accent-cyan-600" />
              ปักหมุด (แสดงบนสุด)
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">ยกเลิก</button>
          <button onClick={() => { if (!title.trim()) { toast.error('กรุณาระบุหัวข้อ'); return; } save.mutate(); }} disabled={save.isPending}
            className="rounded-xl bg-cyan-600 px-5 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-60">
            {save.isPending ? 'กำลังบันทึก…' : item ? 'บันทึก' : 'สร้างข่าว'}
          </button>
        </div>
      </div>
    </div>
  );
}
