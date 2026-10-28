'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { collectExportPages, type TimelineSignature } from './DocEditor';
import { A4W, type DocContext, type DocItem, type DocPage } from './types';

/** ข้อมูลสำหรับวาด/ช่องอัตโนมัติของเอกสารที่ผูกกับเรื่องสารบรรณ (ไม่ hardcode ชื่อ อบต.) */
export function useTicketDocContext(ticket: any): DocContext {
  const me = useAuthStore((s) => s.user);
  const { data: allDepts } = useQuery({
    queryKey: ['departments', ticket?.organizationId],
    queryFn: async () => (await api.get(`/organizations/${ticket?.organizationId}/departments`)).data.data as any[],
    enabled: !!ticket?.organizationId,
  });
  return useMemo(() => {
    const org = ticket?.organization || {};
    const related = [...new Set([ticket?.ownerDeptId, ticket?.relatedDeptId].filter(Boolean))]
      .map((did) => (allDepts || []).find((x) => x.id === did)).filter(Boolean) as any[];
    return {
      orgName: org.nameTh || 'องค์การบริหารส่วนตำบล',
      ticket,
      relatedDepts: related,
      allDepts: allDepts || [],
      fields: {
        'org.name': org.nameTh || '',
        'org.address': [org.address, org.subDistrict && `ต.${org.subDistrict}`, org.district && `อ.${org.district}`, org.province && `จ.${org.province}`].filter(Boolean).join(' '),
        today: new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }),
        'ticket.subject': ticket?.subject || '',
        'ticket.recipient': ticket?.recipient || '',
        'ticket.externalDocNumber': ticket?.externalDocNumber || '',
        'ticket.receiveRegNumber': ticket?.receiveRegNumber || '',
        'ticket.sourceOrg': ticket?.sourceOrg || '',
        'me.name': me ? `${me.titleTh || ''}${me.fullNameTh}` : '',
        'me.position': me?.positionName || '',
      },
    };
  }, [ticket, allDepts, me]);
}

/** แปลงไฟล์เป็นภาพพื้นหลังทีละหน้า — PDF วาดด้วย pdfjs (คมพอพิมพ์) · รูปใช้ url ตรง */
export async function renderFileToImages(url: string, isPdfFile: boolean): Promise<string[]> {
  if (!isPdfFile) return [url];
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const pdf = await pdfjsLib.getDocument({ data: await (await fetch(url)).arrayBuffer() }).promise;
  const out: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: (A4W * 2) / page.getViewport({ scale: 1 }).width });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport: vp } as any).promise;
    out.push(canvas.toDataURL('image/jpeg', 0.9));
  }
  return out;
}

export const isPdfFile = (f: any) => (f?.mimeType || '') === 'application/pdf' || /\.pdf$/i.test(f?.originalName || '');
export const isImageFile = (f: any) => (f?.mimeType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(f?.originalName || '');

/** ลายเซ็นทุกคนที่เซ็นในเรื่องนี้ (จากไทม์ไลน์) — ใช้ต่อรูปลายเซ็นของ layout เก่าเท่านั้น */
export function useTimelineSignatures(ticket: any): TimelineSignature[] {
  return useMemo(() => (ticket?.timeline ?? [])
    .filter((t: any) => t.signatureImage)
    .map((t: any) => ({ id: t.id, sig: t.signatureImage, name: `(${t.actor?.titleTh || ''}${t.actor?.fullNameTh || ''})`, pos: t.actor?.positionName || '' })), [ticket]);
}

/** ก่อนบันทึก: ลายเซ็นจากไทม์ไลน์ไม่ต้องเก็บรูปซ้ำ (ต่อกลับตอนโหลดด้วย timelineId) */
export const slimItems = (items: DocItem[]) =>
  items.map((it) => (it.type === 'signature' && it.props.timelineId ? { ...it, props: { ...it.props, sig: undefined } } : it));

/** ตอนโหลด: ต่อรูปลายเซ็นจากไทม์ไลน์กลับ */
export const hydrateItems = (items: DocItem[], sigs: TimelineSignature[]) => {
  const byId = new Map(sigs.map((s) => [s.id, s.sig]));
  return items.map((it) => (it.type === 'signature' && it.props.timelineId
    ? { ...it, props: { ...it.props, sig: byId.get(it.props.timelineId) || it.props.sig } } : it));
};

/** สร้าง PDF ฝั่งเซิร์ฟเวอร์ (attach = เก็บเป็นไฟล์แนบของเรื่อง แทนการดาวน์โหลด) */
export async function exportTicketPdf(opts: { ticketId: string; canvas: HTMLElement; pages: DocPage[]; fileId?: string | null; attach: boolean; filename: string }) {
  const out = await collectExportPages(opts.canvas, opts.pages);
  const fd = new FormData();
  fd.append('payload', new Blob([JSON.stringify({ pages: out, fileId: opts.fileId ?? null, attach: opts.attach, filename: opts.filename })], { type: 'application/json' }), 'payload.json');
  const res = await api.post(`/correspondence/tickets/${opts.ticketId}/doc-pdf`, fd, { responseType: 'blob' });
  if (!opts.attach) {
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a'); a.href = url; a.download = `${opts.filename}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
