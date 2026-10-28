'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth.store';
import { listFilesByRef } from '@/lib/upload';
import { ArrowLeft, Download, Save } from 'lucide-react';
import { DocEditor, useDocHistory, collectExportPages } from '@/components/doc-editor/DocEditor';
import { normalizeLayout, type DocContext, type DocPage } from '@/components/doc-editor/types';
import { renderFileToImages, isPdfFile } from '@/components/doc-editor/ticket-helpers';

/** รูปพื้นหลังเป็น JPEG data URL (เซิร์ฟเวอร์ฝังได้แค่ JPG/PNG) */
function toJpeg(src: string): Promise<string> {
  if (src.startsWith('data:image/jpeg') || src.startsWith('data:image/png')) return Promise.resolve(src);
  return new Promise((res) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const g = c.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0);
      res(c.toDataURL('image/jpeg', 0.9));
    };
    im.onerror = () => res('');
    im.src = src;
  });
}

export default function CitizenReportEditorPage() {
  return <Suspense fallback={null}><EditorInner /></Suspense>;
}

/** เซ็นเอกสารของเรื่องแจ้ง/ร้องเรียน — เปิดเอกสารที่อัปโหลด (?file=) แล้วลาก "ลายเซ็นของฉัน" ไปวาง */
function EditorInner() {
  const { id } = useParams<{ id: string }>();
  const fileId = useSearchParams().get('file') || '';
  const router = useRouter();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const { data: r } = useQuery({ queryKey: ['citizen-report', id], queryFn: async () => (await api.get(`/citizen-reports/${id}`)).data.data });
  const { data: files } = useQuery({ queryKey: ['attachments', 'citizen-report', id], queryFn: () => listFilesByRef('citizen-report', id), enabled: !!id });
  const { data: saved, isFetched: savedLoaded } = useQuery({
    queryKey: ['citizen-report-doc', id, fileId],
    queryFn: async () => (await api.get(`/citizen-reports/${id}/doc-layout`, { params: { fileId } })).data.data?.layout ?? null,
    enabled: !!fileId, refetchOnWindowFocus: false,
  });
  const { data: org } = useQuery({
    queryKey: ['organization', me?.organizationId],
    queryFn: async () => (await api.get(`/organizations/${me?.organizationId}`)).data.data,
    enabled: !!me?.organizationId,
  });
  const file = (files || []).find((f: any) => f.id === fileId);

  const history = useDocHistory();
  const [pages, setPages] = useState<DocPage[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'' | 'save' | 'pdf'>('');
  const canvasRef = useRef<HTMLDivElement>(null);
  const inited = useRef(false);

  const ctx: DocContext = useMemo(() => ({
    orgName: org?.nameTh || 'องค์การบริหารส่วนตำบล',
    relatedDepts: r?.targetDept ? [{ id: r.targetDept.id, nameTh: r.targetDept.nameTh }] : [],
    fields: {
      'org.name': org?.nameTh || '',
      'org.address': [org?.address, org?.subDistrict && `ต.${org.subDistrict}`, org?.district && `อ.${org.district}`, org?.province && `จ.${org.province}`].filter(Boolean).join(' '),
      today: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
      'ticket.subject': r?.subject || r?.category || '',
      'ticket.recipient': '',
      'ticket.externalDocNumber': '',
      'ticket.receiveRegNumber': r?.refNo || '',
      'ticket.sourceOrg': r?.reporterName || '',
      'me.name': me ? `${me.titleTh || ''}${me.fullNameTh}` : '',
      'me.position': me?.positionName || '',
    },
  }), [org, r, me]);

  // เรนเดอร์เอกสารเป็นภาพทีละหน้า + โหลดลายเซ็นที่วางไว้แล้ว
  useEffect(() => {
    if (!file || !savedLoaded || inited.current) return;
    inited.current = true;
    (async () => {
      let imgs: string[] = [];
      try { imgs = await renderFileToImages(file.url, isPdfFile(file)); } catch (e) { toast.error(getErrorMessage(e, 'เปิดเอกสารไม่สำเร็จ')); }
      setImages(imgs);
      setPages(imgs.length ? imgs.map((_, i) => ({ src: 'attachment' as const, srcPage: i })) : [{ src: 'blank' }]);
      const l = normalizeLayout(saved, imgs.length);
      history.reset(l ? l.items.map((it) => (it.page >= Math.max(imgs.length, 1) ? { ...it, page: Math.max(imgs.length, 1) - 1 } : it)) : []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id, savedLoaded]);

  const save = async (silent = false) => {
    setBusy('save');
    try {
      await api.patch(`/citizen-reports/${id}/doc-layout`, { fileId, layout: { version: 2, pages, items: history.items } });
      await qc.invalidateQueries({ queryKey: ['citizen-report-doc-summary', id] });
      if (!silent) toast.success('บันทึกแล้ว');
      return true;
    } catch (e) { toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')); return false; }
    finally { setBusy(''); }
  };

  const makePdf = async () => {
    if (!canvasRef.current) return;
    setBusy('pdf');
    try {
      const out = await collectExportPages(canvasRef.current, pages);
      const withBg = await Promise.all(out.map(async (p) => (p.src === 'attachment' && images[p.srcPage ?? 0]
        ? { ...p, bg: await toJpeg(images[p.srcPage ?? 0]) } : p)));
      const filename = `${r?.refNo || 'เอกสาร'}-${(file?.originalName || '').replace(/\.[^.]+$/, '')}-ลงนาม`.replace(/[\\/:*?"<>|]+/g, '_');
      const fd = new FormData();
      fd.append('payload', new Blob([JSON.stringify({ pages: withBg, filename })], { type: 'application/json' }), 'payload.json');
      const res = await api.post(`/citizen-reports/${id}/doc-pdf`, fd, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a'); a.href = url; a.download = `${filename}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { toast.error(getErrorMessage(e, 'สร้าง PDF ไม่สำเร็จ')); }
    finally { setBusy(''); }
  };

  const back = async () => {
    // กลับหน้ารายละเอียด — บันทึกให้อัตโนมัติ กันลืมกดบันทึกก่อนไปกด "อนุมัติ / ส่งต่อ"
    if (!loading && history.canUndo) await save(true);
    router.push(`/citizen-reports?open=${id}`);
  };

  if (files && !file) return <div className="p-6 text-sm text-gray-500">ไม่พบเอกสารนี้ (อาจถูกลบไปแล้ว)</div>;
  if (!r || !file) return <div className="p-6 text-gray-400">กำลังโหลด...</div>;

  const btn = 'inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
  return (
    <div className="flex h-full flex-col">
      <DocEditor
        pages={pages} attachmentImages={images} history={history} ctx={ctx} canvasRef={canvasRef}
        header={(
          <>
            <button onClick={back} className={btn}><ArrowLeft className="h-4 w-4" />ย้อนกลับ</button>
            <div className="min-w-0 max-w-sm">
              <p className="truncate text-sm font-semibold text-gray-900">เซ็นเอกสาร · {file.originalName}</p>
              <p className="truncate text-xs text-gray-500"><span className="font-mono">{r.refNo}</span> · {r.subject || r.category}{loading ? ' · กำลังเปิดเอกสาร...' : ''}</p>
            </div>
          </>
        )}
        actions={(
          <>
            <button onClick={() => save()} disabled={!!busy || loading} className={btn}><Save className="h-4 w-4" />{busy === 'save' ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            <button onClick={makePdf} disabled={!!busy || loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              <Download className="h-4 w-4" />{busy === 'pdf' ? 'กำลังสร้าง PDF...' : 'โหลด PDF'}
            </button>
          </>
        )}
      />
    </div>
  );
}
