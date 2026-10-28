'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listFilesByRef, uploadFiles, deleteUploadedFile } from '@/lib/upload';
import { Lightbox } from '@/components/shared/lightbox';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { ImagePlus, Trash2, Camera } from 'lucide-react';

const PHASES = ['ก่อนดำเนินการ', 'ระหว่างดำเนินการ', 'หลังดำเนินการ', 'อื่นๆ'] as const;
const PHASE_TONE: Record<string, string> = {
  'ก่อนดำเนินการ': 'bg-amber-100 text-amber-700',
  'ระหว่างดำเนินการ': 'bg-blue-100 text-blue-700',
  'หลังดำเนินการ': 'bg-green-100 text-green-700',
  'อื่นๆ': 'bg-gray-100 text-gray-600',
};

/** แกลเลอรีรูปความคืบหน้าโครงการ — แยกช่วง (ก่อน/ระหว่าง/หลัง) + คำอธิบาย + ซูม */
export function ProjectPhotos({ projectId, canEdit = false }: { projectId: string; canEdit?: boolean }) {
  const qc = useQueryClient();
  const { user: me, isAdmin } = useAuthStore();
  const key = ['project-photos', projectId];
  const [tab, setTab] = useState<string>('ทั้งหมด');
  const [phase, setPhase] = useState<string>('ระหว่างดำเนินการ');
  const [caption, setCaption] = useState('');
  const [lbIndex, setLbIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: photos = [] } = useQuery({
    queryKey: key,
    queryFn: () => listFilesByRef('project_photo', projectId),
    enabled: !!projectId,
  });

  const shown = tab === 'ทั้งหมด' ? photos : (photos as any[]).filter((p) => (p.category || 'อื่นๆ') === tab);
  const lightboxImages = (shown as any[]).map((p) => ({ url: p.url, name: p.caption || p.originalName }));

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;
    setUploading(true);
    try {
      await uploadFiles(picked, { bucket: 'documents', refType: 'project_photo', refId: projectId, category: phase, caption: caption || undefined });
      toast.success('เพิ่มรูปสำเร็จ');
      setCaption('');
      qc.invalidateQueries({ queryKey: key });
    } catch {
      toast.error('อัปโหลดรูปไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  };

  const del = useMutation({
    mutationFn: (id: string) => deleteUploadedFile(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
          <Camera className="h-4 w-4 text-emerald-500" />รูปความคืบหน้าโครงการ
          {photos.length > 0 && <span className="text-gray-400 text-sm">({photos.length})</span>}
        </h3>
      </div>

      {/* แท็บกรองช่วง */}
      <div className="px-5 pt-3 flex flex-wrap gap-2">
        {['ทั้งหมด', ...PHASES].map((t) => {
          const count = t === 'ทั้งหมด' ? photos.length : (photos as any[]).filter((p) => (p.category || 'อื่นๆ') === t).length;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm rounded-full border px-3 py-1 transition-colors ${tab === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            >
              {t} {count > 0 && <span className="opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* แถบเพิ่มรูป */}
      {canEdit && (
        <div className="px-5 py-3 flex flex-wrap items-center gap-2">
          <select value={phase} onChange={(e) => setPhase(e.target.value)} className="h-9 border border-gray-300 rounded-lg px-3 text-sm">
            {PHASES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="คำอธิบายรูป (ถ้ามี)"
            className="flex-1 min-w-[160px] h-9 border border-gray-300 rounded-lg px-3 text-sm"
          />
          <label className={`inline-flex items-center gap-1.5 cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium text-white ${uploading ? 'bg-gray-400' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            <ImagePlus className="h-4 w-4" />{uploading ? 'กำลังอัปโหลด...' : 'เพิ่มรูป'}
            <input type="file" multiple accept="image/*" className="hidden" disabled={uploading} onChange={onPick} />
          </label>
        </div>
      )}

      {/* แกลเลอรี */}
      <div className="p-5 pt-2">
        {shown.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">ยังไม่มีรูปในช่วงนี้</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {(shown as any[]).map((p, i) => (
              <div key={p.id} className="group">
                <button onClick={() => setLbIndex(i)} className="relative block w-full aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumbnailUrl || p.url} alt={p.caption || p.originalName} loading="lazy" className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  {tab === 'ทั้งหมด' && p.category && (
                    <span className={`absolute left-1.5 top-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${PHASE_TONE[p.category] || PHASE_TONE['อื่นๆ']}`}>{p.category}</span>
                  )}
                  {canEdit && (isAdmin() || p.uploadedBy === me?.id) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); del.mutate(p.id); }}
                      className="absolute right-1.5 top-1.5 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="ลบรูป"
                    ><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </button>
                {p.caption && <p className="mt-1 text-xs text-gray-600 line-clamp-2">{p.caption}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      <Lightbox images={lightboxImages} index={lbIndex} onIndexChange={setLbIndex} onClose={() => setLbIndex(null)} />
    </section>
  );
}
