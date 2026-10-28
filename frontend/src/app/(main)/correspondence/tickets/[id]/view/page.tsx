'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Save, Paperclip } from 'lucide-react';
import { listFilesByRef, uploadFile } from '@/lib/upload';
import { useAuthStore } from '@/stores/auth.store';
import { DocEditor, useDocHistory } from '@/components/doc-editor/DocEditor';
import { makeItem, normalizeLayout, type DocItem, type DocPage } from '@/components/doc-editor/types';
import {
  useTicketDocContext, useTimelineSignatures, slimItems, hydrateItems, exportTicketPdf, renderFileToImages, isPdfFile, isImageFile,
} from '@/components/doc-editor/ticket-helpers';

/** แต่งเอกสารทับหนังสือ (ไฟล์แนบ หรือไฟล์ที่อัปโหลดเอง) — บันทึกลง overlay_layout · โหลดเป็น PDF ฝั่งเซิร์ฟเวอร์ */
export default function TicketViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: ticket } = useQuery({ queryKey: ['ticket', id], queryFn: async () => (await api.get(`/correspondence/tickets/${id}`)).data.data });
  const { data: attachFiles } = useQuery({ queryKey: ['attachments', 'ticket', id], queryFn: () => listFilesByRef('ticket', id), enabled: !!id });
  const ctx = useTicketDocContext(ticket);
  const roles = useAuthStore((s) => s.user?.roles || []);
  // แก้เอกสารได้เฉพาะผู้ถือเรื่องขั้นปัจจุบัน (เซิร์ฟเวอร์คำนวณ canEditDoc) · นายกย้ายลายเซ็นคนอื่นได้เพื่อจัดวาง
  const readOnly = !!ticket && !ticket.canEditDoc;
  const canMoveOthers = !readOnly && ticket?.currentStep === 'PENDING_MAYOR' && roles.some((r) => r === 'MAYOR' || r === 'DEPUTY_MAYOR');
  const oldSignatures = useTimelineSignatures(ticket); // ต่อรูปลายเซ็นของ layout เก่าเท่านั้น

  const history = useDocHistory();
  const [pages, setPages] = useState<DocPage[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [sourceFileId, setSourceFileId] = useState<string | null | undefined>(undefined); // undefined = ยังไม่ได้อ่าน layout
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'' | 'save' | 'pdf' | 'attach' | 'upload'>('');
  const canvasRef = useRef<HTMLDivElement>(null);
  const inited = useRef(false);

  // พื้นหลัง: ไฟล์ที่อัปโหลดเอง (sourceFileId) > ไฟล์แนบแรก (PDF ก่อน) · ไม่นับไฟล์ที่ export จากหน้านี้
  const sources = (attachFiles || []).filter((f: any) => f.category !== 'doc-export');
  const bgFile = (sourceFileId && sources.find((f: any) => f.id === sourceFileId)) || sources.find(isPdfFile) || sources.find(isImageFile);

  // อ่าน layout ที่บันทึกไว้ครั้งเดียว (รู้ sourceFileId ก่อนเรนเดอร์พื้นหลัง)
  useEffect(() => {
    if (!ticket || sourceFileId !== undefined) return;
    setSourceFileId(ticket.overlayLayout?.sourceFileId ?? null);
  }, [ticket, sourceFileId]);

  // เรนเดอร์พื้นหลังเป็นภาพทีละหน้า
  useEffect(() => {
    if (!ticket || !attachFiles || sourceFileId === undefined) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      let imgs: string[] = [];
      try { if (bgFile) imgs = await renderFileToImages(bgFile.url, isPdfFile(bgFile)); } catch { imgs = []; }
      if (cancelled) return;
      setImages(imgs);
      const next: DocPage[] = imgs.length ? imgs.map((_, i) => ({ src: 'attachment' as const, srcPage: i })) : [{ src: 'blank' }];
      if (!inited.current) {
        inited.current = true;
        const saved = normalizeLayout(ticket.overlayLayout, imgs.length);
        if (saved) {
          setPages(saved.sourceFileId ? next : saved.pages);
          history.reset(hydrateItems(saved.items, oldSignatures));
        } else {
          setPages(next);
          history.reset([
            { ...makeItem('checklist', 0, 2, 2), id: 'checklist' },
            { ...makeItem('stampDept', 0, 26, 2), id: 'stampDept' },
            { ...makeItem('stampMain', 0, 70, 2), id: 'stampMain' },
          ] as DocItem[]);
        }
      } else {
        // เปลี่ยนพื้นหลัง — ชิ้นที่อยู่เกินจำนวนหน้าใหม่ย้ายไปหน้าสุดท้าย
        setPages(next);
        history.set((arr) => arr.map((it) => (it.page >= next.length ? { ...it, page: next.length - 1 } : it)));
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket?.id, attachFiles, bgFile?.id, sourceFileId]);

  const onUpload = async (file: File) => {
    setBusy('upload');
    try {
      const up = await uploadFile(file, { refType: 'ticket', refId: id });
      await qc.invalidateQueries({ queryKey: ['attachments', 'ticket', id] });
      setSourceFileId(up.id);
      toast.success('อัปโหลดเอกสารแล้ว (เก็บไว้ในไฟล์แนบของเรื่องด้วย)');
    } catch (e) { toast.error(getErrorMessage(e, 'อัปโหลดไม่สำเร็จ')); }
    finally { setBusy(''); }
  };

  const save = async () => {
    setBusy('save');
    try {
      await api.patch(`/correspondence/tickets/${id}/v4/overlay`, { layout: { version: 2, pages, items: slimItems(history.items), sourceFileId: sourceFileId || null } });
      await qc.invalidateQueries({ queryKey: ['ticket', id] });
      toast.success('บันทึกเอกสารแล้ว');
    } catch (e) { toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ (รูปในเอกสารอาจใหญ่เกิน)')); }
    finally { setBusy(''); }
  };

  const makePdf = async (attach: boolean) => {
    if (!canvasRef.current) return;
    setBusy(attach ? 'attach' : 'pdf');
    try {
      const base = String(ticket?.receiveRegNumber || ticket?.ticketNumber || 'สารบรรณ').replace(/[\\/:*?"<>|]+/g, '_');
      await exportTicketPdf({ ticketId: id, canvas: canvasRef.current, pages, fileId: bgFile?.id ?? null, attach, filename: attach ? `${base}-แต่งแล้ว` : base });
      if (attach) {
        await qc.invalidateQueries({ queryKey: ['attachments', 'ticket', id] });
        toast.success('บันทึก PDF เข้าไฟล์แนบของเรื่องแล้ว');
      }
    } catch (e) { toast.error(getErrorMessage(e, 'สร้าง PDF ไม่สำเร็จ')); }
    finally { setBusy(''); }
  };

  if (!ticket) return <div className="p-6 text-gray-400">กำลังโหลด...</div>;

  const btn = 'inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50';
  return (
    <div className="flex h-full flex-col">
      <DocEditor
        pages={pages} attachmentImages={images} history={history} ctx={ctx} ticketTools canvasRef={canvasRef}
        onUploadDocument={onUpload} uploading={busy === 'upload'} readOnly={readOnly} canMoveOthers={canMoveOthers}
        header={(
          <>
            <button onClick={async () => { if (!readOnly && history.canUndo) await save(); router.push(`/correspondence/tickets/${id}`); }} className={btn}><ArrowLeft className="h-4 w-4" />ย้อนกลับ</button>
            <div className="min-w-0 max-w-md">
              <p className="truncate text-sm font-semibold text-gray-900">{readOnly ? 'ดูเอกสาร' : 'เซ็นเอกสาร'} · {ticket.subject}</p>
              <p className="truncate text-xs text-gray-500">
                <span className="font-mono">{ticket.receiveRegNumber || ticket.ticketNumber}</span>
                {bgFile ? ` · ${bgFile.originalName}` : ' · ยังไม่มีเอกสาร — กด "อัปโหลดเอกสาร"'}{loading ? ' · กำลังโหลด...' : ''}
              </p>
            </div>
          </>
        )}
        actions={(
          <>
            {readOnly ? (
              <span className="text-xs text-gray-500">ดูอย่างเดียว — เซ็นได้เมื่อเรื่องอยู่ที่คุณ</span>
            ) : (
              <>
                <button onClick={save} disabled={!!busy} className={btn}><Save className="h-4 w-4" />{busy === 'save' ? 'กำลังบันทึก...' : 'บันทึก'}</button>
                <button onClick={() => makePdf(true)} disabled={!!busy || loading} className={btn}><Paperclip className="h-4 w-4" />{busy === 'attach' ? 'กำลังสร้าง...' : 'เก็บเป็นไฟล์แนบ'}</button>
              </>
            )}
            <button onClick={() => makePdf(false)} disabled={!!busy || loading}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              <Download className="h-4 w-4" />{busy === 'pdf' ? 'กำลังสร้าง PDF...' : 'โหลด PDF'}
            </button>
          </>
        )}
      />
    </div>
  );
}
