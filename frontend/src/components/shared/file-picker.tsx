'use client';
import * as React from 'react';
import { Upload, FileText, X, Maximize2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/upload';
import { FilePreview, isPreviewable } from '@/components/shared/file-preview';

/**
 * เลือกไฟล์แนบ (ยังไม่อัปโหลด) — เก็บเป็น File[] แล้วส่งออกผ่าน onChange
 * หน้าฟอร์มจะอัปโหลดจริงหลังบันทึกรายการ (ผูกกับ refId)
 * มี preview ในตัวเหมือนหน้ารายละเอียด: เลือกไฟล์ในรายการ → เห็นรูป/PDF เรนเดอร์เลย (PDF เลื่อนดูทุกหน้า) + ดูเต็มจอได้
 * พอมีไฟล์แล้ว กล่องอัปโหลดจะย่อเป็นปุ่ม "แนบไฟล์เพิ่ม" เล็ก (ไม่กินพื้นที่)
 */
export function FilePicker({
  value,
  onChange,
  accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png',
  maxSizeMB = 10,
  multiple = true,
  label = 'แนบไฟล์เอกสาร',
  hint = 'รองรับ PDF, Word, Excel, รูปภาพ • ขนาดไม่เกิน 10 MB',
  previewHeight = 'h-[44rem]',
  size = 'md',
}: {
  value: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  maxSizeMB?: number;
  multiple?: boolean;
  label?: string;
  hint?: string;
  previewHeight?: string;
  /** lg = กล่องแนบไฟล์ใหญ่ (ใช้เป็นขั้นแรกของหน้า เช่น สร้างสารบรรณ) · ค่าเริ่มต้นขนาดเดิม */
  size?: 'md' | 'lg';
}) {
  const [error, setError] = React.useState('');
  const [dragOver, setDragOver] = React.useState(false);
  const [sel, setSel] = React.useState(0);          // ไฟล์ที่กำลังแสดง preview
  const [full, setFull] = React.useState<number | null>(null); // ดูเต็มจอ (index)

  // object URL ต่อไฟล์ (สำหรับ preview) — ผูกกับตัว File เอง (Map) เพื่อให้ URL คงที่ข้าม re-render
  // revoke เฉพาะไฟล์ที่ถูกเอาออก + ตอน unmount (กัน StrictMode dev revoke เร็วไปจน blob ว่าง)
  const urlMapRef = React.useRef<Map<File, string>>(new Map());
  const urls = value.map((f) => {
    let u = urlMapRef.current.get(f);
    if (!u) { u = URL.createObjectURL(f); urlMapRef.current.set(f, u); }
    return u;
  });
  React.useEffect(() => {
    const alive = new Set(value);
    for (const [f, u] of urlMapRef.current) {
      if (!alive.has(f)) { URL.revokeObjectURL(u); urlMapRef.current.delete(f); }
    }
  }, [value]);
  React.useEffect(() => {
    const map = urlMapRef.current;
    return () => { for (const u of map.values()) URL.revokeObjectURL(u); map.clear(); };
  }, []);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    setError('');
    const picked = Array.from(incoming);
    const tooBig = picked.find((f) => f.size > maxSizeMB * 1024 * 1024);
    if (tooBig) {
      setError(`ไฟล์ "${tooBig.name}" ใหญ่เกิน ${maxSizeMB} MB`);
      return;
    }
    const merged = multiple ? [...value, ...picked] : picked.slice(0, 1);
    onChange(merged);
    setSel(merged.length - 1); // เลือกไฟล์ที่เพิ่งแนบมาแสดงเลย
  };

  const removeAt = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
    setSel((s) => (s >= i && s > 0 ? s - 1 : s));
  };

  const idx = Math.min(sel, value.length - 1);
  const cur = value[idx];
  const curUrl = urls[idx];
  const curImg = !!cur && cur.type.startsWith('image/');
  const curPreviewable = !!cur && isPreviewable(cur.type, cur.name) && !!curUrl;
  const fileInput = (
    <input type="file" accept={accept} multiple={multiple} className="hidden"
      onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
  );

  return (
    <div
      className="space-y-2"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
    >
      <label className="block text-sm font-medium text-gray-700">{label}</label>

      {value.length === 0 ? (
        /* กล่องอัปโหลด — เฉพาะตอนยังไม่มีไฟล์ (ย่อขนาดลง ไม่กินที่เยอะ) */
        <label className={cn(
          'flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors',
          size === 'lg' && 'min-h-[20rem] gap-2 py-10 max-sm:min-h-[14rem]',
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100',
        )}>
          {size === 'lg' ? (
            <span className="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600"><Upload className="h-8 w-8" /></span>
          ) : <Upload className="h-6 w-6 text-blue-500" />}
          <span className={cn('font-medium text-gray-700', size === 'lg' ? 'text-base' : 'text-sm')}>คลิกเพื่อเลือกไฟล์ หรือ ลากไฟล์มาวางที่นี่</span>
          <span className={cn('text-gray-500', size === 'lg' ? 'text-sm' : 'text-xs')}>{hint}</span>
          {fileInput}
        </label>
      ) : (
        <div className={cn('rounded-xl border overflow-hidden', dragOver ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200')}>
          {/* หัวกล่อง: จำนวนไฟล์ + ปุ่มแนบเพิ่ม (แทนกล่องใหญ่) */}
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/60">
            <span className="text-xs text-gray-500">{dragOver ? 'วางไฟล์เพื่อเพิ่ม' : `${value.length} ไฟล์`}</span>
            <label className="inline-flex items-center gap-1 cursor-pointer rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">
              <Plus className="h-3.5 w-3.5" />แนบไฟล์เพิ่ม
              {fileInput}
            </label>
          </div>

          {/* รายการไฟล์ — คลิกเลือกเพื่อดู preview */}
          <ul className="divide-y divide-gray-100">
            {value.map((f, i) => {
              const active = i === idx;
              const isImg = f.type.startsWith('image/');
              const u = urls[i];
              return (
                <li
                  key={i}
                  onClick={() => setSel(i)}
                  className={cn('flex items-center gap-3 px-3 py-2 cursor-pointer', active ? 'bg-blue-50' : 'hover:bg-gray-50')}
                >
                  {isImg && u ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u} alt="" className="h-9 w-9 shrink-0 rounded object-cover border border-gray-200" />
                  ) : (
                    <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                  )}
                  <span className={cn('flex-1 truncate text-sm', active ? 'text-blue-700 font-medium' : 'text-gray-800')}>{f.name}</span>
                  <span className="text-xs text-gray-400 shrink-0">{formatFileSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeAt(i); }}
                    className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    title="เอาไฟล์ออก"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>

          {/* แผง preview ในตัว (เหมือนหน้ารายละเอียด) */}
          {cur && (
            <div className="border-t border-gray-200">
              <div className="px-3 py-2 bg-blue-50/40 text-sm text-gray-700 flex items-center gap-2">
                <span className="font-medium truncate flex-1">แสดง: {cur.name}</span>
                {curPreviewable && (
                  <button
                    type="button"
                    onClick={() => setFull(idx)}
                    className="inline-flex items-center gap-1 shrink-0 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />เต็มจอ
                  </button>
                )}
              </div>
              <div className="p-3 bg-gray-50">
                {curPreviewable ? (
                  curImg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={curUrl} alt="" onClick={() => setFull(idx)} className="max-h-[44rem] mx-auto rounded-lg border border-gray-200 bg-white cursor-zoom-in" />
                  ) : (
                    // #view=FitH = ให้ viewer ของเบราว์เซอร์ย่อ/ขยายหน้าให้พอดีความกว้าง (ไม่เล็กมีขอบดำ)
                    <iframe src={`${curUrl}#view=FitH&toolbar=1`} title={cur.name} className={cn('w-full rounded-lg border border-gray-200 bg-white', previewHeight)} />
                  )
                ) : (
                  <div className="py-10 text-center text-sm text-gray-400">ไฟล์ชนิดนี้ดูตัวอย่างไม่ได้ (เช่น Word/Excel) — จะแนบไปกับเอกสารได้ตามปกติ</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      {/* ดูเต็มจอ (reuse modal กลาง) */}
      {full !== null && value[full] && urls[full] && (
        <FilePreview
          file={{ url: urls[full], originalName: value[full].name, mimeType: value[full].type }}
          onClose={() => setFull(null)}
        />
      )}
    </div>
  );
}
