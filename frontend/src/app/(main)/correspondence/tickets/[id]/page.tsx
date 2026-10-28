'use client';
import { useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatThaiDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import {
  ArrowLeft, Paperclip, Clock, Eye,
  FileText, FileSpreadsheet, FileArchive, Image as ImageIcon, Download, Trash2,
  Maximize2, X, PenLine, Send, Undo2, Pencil, CheckCircle,
} from 'lucide-react';
import { UrgencyBadge, ConfidentialityBadge, URGENCY_OPTIONS, CONFIDENTIALITY_OPTIONS, OBJECTIVE_OPTIONS } from '@/components/shared/status-badge';
import { RecipientPicker, type Recipient } from '@/components/shared/recipient-picker';
import { isPreviewable } from '@/components/shared/file-preview';
import { uploadFiles, listFilesByRef, deleteUploadedFile, formatFileSize } from '@/lib/upload';

function fixThaiName(name?: string): string {
  const s = name || '';
  const inRange = (x: string, lo: number, hi: number) => {
    for (let i = 0; i < x.length; i++) { const c = x.charCodeAt(i); if (c >= lo && c <= hi) return true; }
    return false;
  };
  const hasThai = (x: string) => inRange(x, 0x0e00, 0x0e7f);
  if (hasThai(s)) return s;
  if (!inRange(s, 0x0080, 0x00ff)) return s;
  try {
    const bytes = Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    if (hasThai(decoded)) return decoded;
  } catch (e) { /* keep */ }
  return s;
}

/** ปุ่มลงมือหลัก (เซ็น/ส่ง/ดูเอกสาร) — solid เด่นชัด */
const SOLID: Record<string, string> = {
  purple: 'bg-violet-600 hover:bg-violet-700 text-white shadow-sm',  // ประทับเซ็น / ดูเอกสาร
  green: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm', // ส่งดำเนินการ (ปุ่มหลัก)
};
function ActBtn({ color, onClick, disabled, children }: { color: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none ${SOLID[color] || SOLID.green}`}>
      {children}
    </button>
  );
}

/** แถว "ตั้งค่าก่อนส่ง" (เลือกกอง/คน/เลขทะเบียน) — เงียบเหมือน field · เลือกแล้วโชว์ชิปเขียว */
/** ปุ่มรอง (ตีกลับ/ขอแก้ไข) — ghost เล็ก มุมล่าง */
function GhostBtn({ tone, icon: Icon, onClick, children }: { tone: 'orange' | 'gray'; icon: any; onClick: () => void; children: React.ReactNode }) {
  const c = tone === 'orange' ? 'text-orange-600 hover:bg-orange-50' : 'text-gray-500 hover:bg-gray-100';
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${c}`}>
      <Icon className="h-4 w-4" />{children}
    </button>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user: me, hasPermission, isAdmin } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  // ส่งต่อแบบไดนามิก: ผู้รับ (คน/ปลัด) + เลขทะเบียนรับกอง (ไม่บังคับ) · ลายเซ็น = ที่ลากไปวางบนเอกสาร
  const [recipient, setRecipient] = useState<Recipient>(null);
  const [deptRegNumber, setDeptRegNumber] = useState('');

  // modal flags
  const [sendModal, setSendModal] = useState(false);
  const [sendNote, setSendNote] = useState('');
  const [returnModal, setReturnModal] = useState(false);
  const [returnNote, setReturnNote] = useState('');
  const [returnTarget, setReturnTarget] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [fullscreenFileId, setFullscreenFileId] = useState<string | null>(null);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => (await api.get(`/correspondence/tickets/${id}`)).data.data,
  });
  const { data: attachFiles = [] } = useQuery({
    queryKey: ['attachments', 'ticket', id],
    queryFn: () => listFilesByRef('ticket', id), enabled: !!id,
  });
  const delFile = useMutation({
    mutationFn: (fid: string) => deleteUploadedFile(fid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attachments', 'ticket', id] }),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['ticket', id] });
    qc.invalidateQueries({ queryKey: ['tickets'] });
  };
  const resetStepInputs = () => {
    setRecipient(null); setDeptRegNumber(''); setSendNote('');
  };

  const actV4 = useMutation({
    mutationFn: async (body: any) => (await api.post(`/correspondence/tickets/${id}/v4/action`, body)).data,
    onSuccess: () => { toast.success('ดำเนินการเรียบร้อย'); setSendModal(false); resetStepInputs(); refresh(); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'ไม่สำเร็จ')),
  });
  const returnV4 = useMutation({
    mutationFn: async () => {
      const body: any = { note: returnNote };
      if (returnTarget === 'CREATOR') body.toCreator = true;
      return (await api.post(`/correspondence/tickets/${id}/v4/return`, body)).data;
    },
    onSuccess: () => { toast.success('ตีกลับเรื่องแล้ว'); setReturnModal(false); setReturnNote(''); setReturnTarget(''); refresh(); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'ตีกลับไม่สำเร็จ')),
  });
  const editV4 = useMutation({
    mutationFn: async () => (await api.patch(`/correspondence/tickets/${id}/v4`, {
      subject: edit.subject, externalDocNumber: edit.externalDocNumber, docDate: edit.docDate || undefined,
      sourceOrg: edit.sourceOrg, recipient: edit.recipient || undefined, body: edit.body || undefined,
      urgencyLevel: edit.urgencyLevel, confidentiality: edit.confidentiality,
      purposes: edit.purposes?.length ? edit.purposes : undefined,
      purposeOther: edit.purposes?.includes('อื่นๆ') ? (edit.purposeOther || undefined) : undefined,
    })).data,
    onSuccess: () => { toast.success('แก้ไขเอกสารแล้ว'); setShowEdit(false); refresh(); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'แก้ไขไม่สำเร็จ')),
  });
  const removeTicket = useMutation({
    mutationFn: async () => (await api.delete(`/correspondence/tickets/${id}`)).data,
    onSuccess: () => { toast.success('ลบสารบรรณแล้ว'); qc.invalidateQueries({ queryKey: ['tickets'] }); router.push('/correspondence/tickets'); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'ลบไม่สำเร็จ')),
  });

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); e.target.value = '';
    if (!files.length) return;
    try { await uploadFiles(files, { bucket: 'documents', refType: 'ticket', refId: id }); toast.success('แนบไฟล์สำเร็จ'); qc.invalidateQueries({ queryKey: ['attachments', 'ticket', id] }); }
    catch { toast.error('อัปโหลดไฟล์ไม่สำเร็จ'); }
  };

  if (isLoading) return <div className="flex flex-col h-full"><Header title="สารบรรณ" /><div className="p-6 text-gray-400">กำลังโหลด...</div></div>;
  if (!ticket) return <div className="flex flex-col h-full"><Header title="สารบรรณ" /><div className="p-6 text-gray-400">ไม่พบสารบรรณ</div></div>;

  const step: string = ticket.currentStep;
  const meId = me?.id;
  const admin = isAdmin();
  const roleClerk = hasPermission('correspondence:approve_clerk:Ticket');
  const roleMayor = hasPermission('correspondence:approve_mayor:Ticket');
  const mine = (uid?: string) => !!uid && (meId === uid || admin);

  // ผู้ถือเรื่องส่งต่อได้อิสระ · ปลัดส่งนายกเท่านั้น · นายกปิดงาน
  const canForward = step === 'PENDING_PERSON' && mine(ticket.currentHolderUserId);
  const canClerk = step === 'PENDING_CLERK' && (roleClerk || admin);
  const canMayor = step === 'PENDING_MAYOR' && (roleMayor || admin);
  const canAnyStep = canForward || canClerk || canMayor;

  const isDone = step === 'COMPLETED' || step === 'CANCELLED';
  // ตีกลับได้เฉพาะคนที่ถือเรื่องอยู่ในขั้นนี้ (backend บังคับซ้ำ)
  const canReturn = !!step && !isDone && canAnyStep;
  const canEditV4 = !!step && step !== 'COMPLETED' && (ticket.createdBy === meId || admin);
  const canDelete = admin;

  const selectedFile = attachFiles.find((x: any) => x.id === selectedFileId)
    ?? attachFiles.find((x: any) => isPreviewable(x.mimeType, x.originalName)) ?? attachFiles[0];
  const fullscreenFile = attachFiles.find((x: any) => x.id === fullscreenFileId);
  const fsIsImg = fullscreenFile && ((fullscreenFile.mimeType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(fullscreenFile.originalName || ''));

  const purposeText = (ticket.purpose === 'อื่นๆ' ? (ticket.purposeOther || 'อื่นๆ') : ticket.purpose) || null;
  const creatorName = ticket.creator ? `${ticket.creator.titleTh || ''}${ticket.creator.fullNameTh}` : null;
  const receiveDateText = ticket.receivedRecordAt || ticket.receivedDate ? `${formatThaiDateTime(ticket.receivedRecordAt || ticket.receivedDate)} น.` : null;
  const deptRegText = ticket.deptRegNumber ? `${ticket.relatedDept?.nameTh || 'กองที่เกี่ยวข้อง'} : ${ticket.deptRegNumber}${ticket.deptRegAt ? ` · ${formatThaiDateTime(ticket.deptRegAt)} น.` : ''}` : null;

  const openEdit = () => {
    setEdit({
      subject: ticket.subject || '', externalDocNumber: ticket.externalDocNumber || '',
      docDate: ticket.docDate ? String(ticket.docDate).slice(0, 10) : '', sourceOrg: ticket.sourceOrg || '',
      recipient: ticket.recipient || '', body: ticket.body || '',
      urgencyLevel: ticket.urgencyLevel || 'ปกติ', confidentiality: ticket.confidentiality || 'ปกติ',
      purposes: ticket.purpose ? String(ticket.purpose).split(', ').filter(Boolean) : [], purposeOther: ticket.purposeOther || '',
    });
    setShowEdit(true);
  };
  // ลายเซ็นของฉันที่ลากไปวางบนเอกสารแล้ว (ต้องมีก่อนส่งทุกขั้น — เซิร์ฟเวอร์ตรวจซ้ำ)
  const mySigItem = (ticket.overlayLayout?.items || []).find((it: any) => it?.type === 'signature' && it.props?.ownerId === meId);
  const mySig: string | undefined = mySigItem?.props?.sig;
  // ยืนยันส่งดำเนินการ — แนบรูปลายเซ็นที่วางบนเอกสารไปกับไทม์ไลน์ด้วย
  const doSend = () => {
    if (canForward) {
      actV4.mutate({
        type: 'forward', signatureImage: mySig, note: sendNote, deptRegNumber: deptRegNumber.trim() || undefined,
        ...(recipient?.kind === 'clerk' ? { toClerk: true } : { toUserId: recipient?.kind === 'person' ? recipient.userId : undefined }),
      });
    } else if (canClerk || canMayor) actV4.mutate({ type: 'sign_send', signatureImage: mySig, note: sendNote });
  };
  // ปุ่มส่งพร้อมไหม — ทุกการส่งต้องเซ็น · ผู้ถือเรื่องต้องเลือกผู้รับด้วย
  const sendReady = canForward ? (!!mySig && !!recipient) : (canClerk || canMayor) ? !!mySig : false;
  const sendLabel = canMayor ? 'ลงนามปิดงาน' : canClerk ? 'ส่งนายก' : 'ส่งดำเนินการ';

  return (
    <div className="flex flex-col h-full">
      <Header title="สารบรรณ" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <Button variant="outline" onClick={() => router.push('/correspondence/tickets')}><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button>
          <h1 className="text-lg font-semibold text-gray-900 font-mono">{ticket.ticketNumber}</h1>
          <UrgencyBadge level={ticket.urgencyLevel} />
          <ConfidentialityBadge level={ticket.confidentiality} />
          {canDelete && (
            <Button variant="outline" size="sm" className="ml-auto text-red-600 hover:bg-red-50 border-red-200" loading={removeTicket.isPending}
              onClick={() => { if (confirm('ลบสารบรรณรายการนี้? (กู้คืนไม่ได้)')) removeTicket.mutate(); }}>
              <Trash2 className="h-4 w-4" />ลบเอกสาร
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ซ้าย */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-200 bg-blue-50">
                <p className="text-xs font-semibold text-blue-700 font-mono">{ticket.ticketNumber}</p>
                <h2 className="text-lg font-bold text-gray-900 mt-0.5">{ticket.subject}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 sm:[&>div:nth-child(odd)]:border-r sm:[&>div:nth-child(odd)]:border-gray-100">
                <Field label="เลขทะเบียนรับ" value={ticket.receiveRegNumber} />
                <Field label="รับวันที่" value={receiveDateText} />
                <Field label="เอกสารเลขที่" value={ticket.externalDocNumber} />
                <Field label="ลงวันที่" value={ticket.docDate ? formatThaiDateTime(ticket.docDate) : null} />
                <Field label="จาก" value={ticket.sourceOrg} />
                <Field label="เรียน" value={ticket.recipient} />
                <Field label="ความเร่งด่วน" value={ticket.urgencyLevel} danger={ticket.urgencyLevel && ticket.urgencyLevel !== 'ปกติ'} />
                <Field label="ชั้นความลับ" value={ticket.confidentiality} />
                <Field label="วัตถุประสงค์" value={purposeText} />
                <Field label="ผู้ลงรับ" value={creatorName} />
                <Field label="กองที่เกี่ยวข้อง" value={ticket.relatedDept?.nameTh} />
              </div>
              <div>
                {deptRegText && <Field label="เลขทะเบียนรับกอง" value={deptRegText} full />}
                {ticket.body && <Field label="รายละเอียด" value={ticket.body} full pre />}
              </div>
            </section>

            {/* ไฟล์แนบต้นฉบับ */}
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800">
                  <Paperclip className="h-4 w-4 text-gray-500" />แนบไฟล์ต้นฉบับ{attachFiles.length > 0 && <span className="text-gray-400 text-sm">({attachFiles.length})</span>}
                </h3>
                {(admin || ticket.createdBy === meId) && (
                  <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-full border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shrink-0">
                    <Paperclip className="h-4 w-4" />แนบไฟล์เพิ่ม
                    <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip" onChange={onPickFiles} />
                  </label>
                )}
              </div>
              {attachFiles.length === 0 ? (
                <p className="px-5 py-8 text-sm text-gray-400 text-center">ยังไม่มีไฟล์แนบ</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/60 text-gray-500"><tr>
                    <th className="w-10 px-3 py-2 text-left font-medium">#</th>
                    <th className="px-3 py-2 text-left font-medium">ไฟล์แนบ</th>
                    <th className="px-3 py-2 text-left font-medium w-44">วันที่-เวลา</th>
                    <th className="px-3 py-2 w-20"></th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {attachFiles.map((fl: any, i: number) => {
                      const active = selectedFile?.id === fl.id;
                      return (
                        <tr key={fl.id} onClick={() => setSelectedFileId(fl.id)} className={`cursor-pointer ${active ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2"><div className="flex items-center gap-2 min-w-0">
                            <FileTypeIcon file={fl} />
                            <span className={`truncate ${active ? 'text-blue-700 font-medium' : 'text-gray-800'}`}>{fixThaiName(fl.originalName)}</span>
                            <span className="text-xs text-gray-400 shrink-0">{formatFileSize(fl.fileSize)}</span>
                          </div></td>
                          <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{fl.uploadedAt ? formatThaiDateTime(fl.uploadedAt) : '-'}</td>
                          <td className="px-3 py-2"><div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                            <a href={fl.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-md text-gray-500 hover:bg-blue-50 hover:text-blue-600"><Download className="h-4 w-4" /></a>
                            {(admin || fl.uploadedBy === meId) && <button onClick={() => delFile.mutate(fl.id)} className="p-1.5 rounded-md text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {selectedFile && (
                <div className="border-t border-gray-200">
                  <div className="px-5 py-2 bg-blue-50/40 text-sm text-gray-700 flex items-center gap-2">
                    <FileTypeIcon file={selectedFile} />
                    <span className="font-medium truncate flex-1">แสดง: {fixThaiName(selectedFile.originalName)}</span>
                    {isPreviewable(selectedFile.mimeType, selectedFile.originalName) && (
                      <button onClick={() => setFullscreenFileId(selectedFile.id)} className="inline-flex items-center gap-1 shrink-0 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"><Maximize2 className="h-3.5 w-3.5" />เต็มจอ</button>
                    )}
                  </div>
                  <div className="p-3">
                    {isPreviewable(selectedFile.mimeType, selectedFile.originalName) ? (
                      (selectedFile.mimeType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(selectedFile.originalName)
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={selectedFile.url} alt="" onClick={() => setFullscreenFileId(selectedFile.id)} className="max-h-150 mx-auto rounded-lg border border-gray-200 cursor-zoom-in" />
                        : <iframe src={selectedFile.url} title="" className="w-full h-150 rounded-lg border border-gray-200" />
                    ) : (
                      <div className="py-10 text-center text-sm text-gray-400">ไฟล์ชนิดนี้ดูตัวอย่างไม่ได้<div className="mt-2"><a href={selectedFile.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">ดาวน์โหลด</a></div></div>
                    )}
                  </div>
                </div>
              )}
            </section>

          </div>

          {/* ขวา */}
          <div className="space-y-6">
            {/* สถานะ + ปุ่ม action */}
            <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3">
              <div className="rounded-lg bg-white border border-gray-200 px-3 py-2.5 text-sm">
                <span className="text-gray-400 font-medium">สถานะ</span>
                <span className="mx-1.5 text-gray-300">:</span>
                <span className="font-semibold text-emerald-600">{ticket.statusLabel || ticket.status}</span>
              </div>

              {/* ดูเอกสาร / เซ็น — ทุกขั้น · ผู้ถือเรื่องลากลายเซ็นของตัวเองไปวางที่นี่ คนอื่นดูอย่างเดียว */}
              <ActBtn color="purple" onClick={() => router.push(`/correspondence/tickets/${id}/view`)}>
                {ticket.canEditDoc ? <><PenLine className="h-4 w-4" />ดูเอกสาร / เซ็น</> : <><Eye className="h-4 w-4" />ดูเอกสาร</>}
              </ActBtn>
              {canAnyStep && (mySig ? (
                <p className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700"><CheckCircle className="h-4 w-4" />วางลายเซ็นในเอกสารแล้ว — เลือกผู้รับแล้วกดส่งได้เลย</p>
              ) : (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">ยังไม่ได้เซ็น — กด &quot;ดูเอกสาร / เซ็น&quot; แล้วลากลายเซ็นของคุณไปวางบนเอกสารก่อนส่ง</p>
              ))}

              {/* ── ส่งต่อ: เลือกผู้รับ (คน/กอง หรือ ปลัด) ── */}
              {canForward && (
                <div className="rounded-xl border border-gray-200 p-3 space-y-3">
                  <p className="text-xs font-medium text-gray-500">ส่งต่อให้</p>
                  <RecipientPicker value={recipient} onChange={setRecipient} excludeUserId={meId} />
                  <div>
                    <Label className="text-xs">เลขทะเบียนรับกอง (ถ้ามี)</Label>
                    <Input className="mt-1 font-mono" value={deptRegNumber} onChange={(e) => setDeptRegNumber(e.target.value)} placeholder="ไม่บังคับ" />
                  </div>
                </div>
              )}
              {canClerk && <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">ปลัดเซ็นแล้วส่งนายกเป็นขั้นสุดท้าย (หรือตีกลับให้ผู้ส่งก่อนหน้า)</p>}

              {/* ── ปุ่มหลัก (เซ็น/ส่ง) — เด่น ── */}
              {canAnyStep && (
                <ActBtn color="green" disabled={!sendReady} onClick={() => { setSendNote(''); setSendModal(true); }}><Send className="h-4 w-4" />{sendLabel}</ActBtn>
              )}

              {/* ── ปุ่มรอง (ตีกลับ/ขอแก้ไข) — ghost เล็ก ── */}
              {(canReturn || (canEditV4 && ((ticket.createdBy === meId && !admin) || admin))) && (
                <div className="flex items-center gap-1 pt-1">
                  {canReturn && <GhostBtn tone="orange" icon={Undo2} onClick={() => setReturnModal(true)}>ตีกลับ</GhostBtn>}
                  {canEditV4 && ((ticket.createdBy === meId && !admin) || admin) && <GhostBtn tone="gray" icon={Pencil} onClick={openEdit}>ขอแก้ไข</GhostBtn>}
                </div>
              )}
            </section>

            {/* ประวัติการทำงาน */}
            <section className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-base font-semibold text-gray-800 mb-3"><Clock className="h-4 w-4 text-gray-500" />ประวัติการทำงาน</h3>
              <ol>
                {(ticket.timeline ?? []).map((t: any, i: number) => (
                  <li key={t.id} className="flex gap-3 pb-5 last:pb-0">
                    <div className="flex flex-col items-center">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[11px] font-semibold text-white">{i + 1}</span>
                      {i < (ticket.timeline?.length ?? 0) - 1 && <span className="w-px flex-1 bg-gray-200" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{t.action}{t.stepName ? <span className="text-gray-400 font-normal"> · {t.stepName}</span> : null}</p>
                      <p className="text-xs text-gray-500">{t.actor?.fullNameTh} • {formatThaiDateTime(t.actedAt)}</p>
                      {t.note && <p className="mt-0.5 text-sm text-gray-600">{t.note}</p>}
                      {t.signatureImage && /* eslint-disable-next-line @next/next/no-img-element */ <img src={t.signatureImage} alt="ลายเซ็น" className="mt-1 h-14 rounded border border-gray-200 bg-white" />}
                    </div>
                  </li>
                ))}
                {(!ticket.timeline || ticket.timeline.length === 0) && <li className="text-sm text-gray-400">ยังไม่มีประวัติ</li>}
              </ol>
            </section>
          </div>
        </div>
      </div>

      {/* เต็มจอไฟล์ */}
      {fullscreenFile && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-black/85" onClick={() => setFullscreenFileId(null)}>
          <div className="flex items-center gap-2 px-4 py-2 text-sm text-white">
            <FileTypeIcon file={fullscreenFile} /><span className="truncate flex-1">{fixThaiName(fullscreenFile.originalName)}</span>
            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <a href={fullscreenFile.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 hover:bg-white/25"><Download className="h-4 w-4" />ดาวน์โหลด</a>
              <button onClick={() => setFullscreenFileId(null)} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 hover:bg-white/25"><X className="h-4 w-4" />ปิด</button>
            </div>
          </div>
          <div className="flex-1 min-h-0 p-3" onClick={(e) => e.stopPropagation()}>
            {fsIsImg /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={fullscreenFile.url} alt="" className="mx-auto max-h-full max-w-full object-contain" />
              : <iframe src={fullscreenFile.url} title="" className="h-full w-full rounded-lg bg-white" />}
          </div>
        </div>
      )}

      {/* popup ส่งดำเนินการ (หมายเหตุ) */}
      {sendModal && (
        <Modal title={sendLabel} onClose={() => setSendModal(false)}>
          {canForward && recipient && (
            <p className="mb-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
              ส่งถึง <b>{recipient.kind === 'clerk' ? 'ปลัด' : recipient.name}</b>
              {recipient.kind === 'person' && recipient.deptName ? ` · ${recipient.deptName}` : ''}
            </p>
          )}
          <Label>หมายเหตุ / ข้อมูลเพิ่มเติม (ถ้ามี)</Label>
          <textarea className="mt-1 mb-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2} value={sendNote} onChange={(e) => setSendNote(e.target.value)} />
          <div className="flex gap-2 justify-end"><Button variant="outline" size="sm" onClick={() => setSendModal(false)}>ยกเลิก</Button><Button size="sm" loading={actV4.isPending} onClick={doSend}><Send className="h-4 w-4" />ยืนยันส่ง</Button></div>
        </Modal>
      )}

      {/* modal ตีกลับ */}
      {returnModal && (
        <Modal title="ตีกลับ" onClose={() => setReturnModal(false)}>
          <Label>เหตุผลการตีกลับ<span className="text-red-500 ml-0.5">*</span></Label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {['แก้ไขเอกสาร', 'ไม่เกี่ยวข้องกับตน'].map((r) => (
              <button key={r} type="button" onClick={() => setReturnNote(r)} className={`rounded-full border px-3 py-1 text-sm ${returnNote === r ? 'border-amber-500 bg-amber-100 text-amber-800 font-medium' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{r}</button>
            ))}
          </div>
          <textarea className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2} placeholder="หรือพิมพ์เหตุผลเอง" value={returnNote} onChange={(e) => setReturnNote(e.target.value)} />
          <Label className="mt-3 block">ตีกลับไปหา</Label>
          <div className="mt-1 space-y-1">
            <button type="button" onClick={() => setReturnTarget('PREV')} className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${returnTarget === 'PREV' ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200'}`}>
              ผู้ส่งก่อนหน้า{ticket.returnTo?.name ? ` — ${ticket.returnTo.name}` : ''}
            </button>
            {canForward && !ticket.returnTo?.isCreator && (
              <button type="button" onClick={() => setReturnTarget('CREATOR')} className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${returnTarget === 'CREATOR' ? 'border-amber-400 bg-amber-50 text-amber-800' : 'border-gray-200'}`}>ผู้ลงรับสารบรรณ (คนสร้าง)</button>
            )}
          </div>
          <div className="flex gap-2 justify-end mt-3"><Button variant="outline" size="sm" onClick={() => setReturnModal(false)}>ยกเลิก</Button><Button size="sm" loading={returnV4.isPending} disabled={!returnNote.trim() || !returnTarget} onClick={() => returnV4.mutate()}>ยืนยันตีกลับ</Button></div>
        </Modal>
      )}

      {/* modal ขอแก้ไข */}
      {showEdit && edit && (
        <Modal title="ขอแก้ไขเอกสาร" onClose={() => setShowEdit(false)} wide>
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            <div><Label>เรื่อง</Label><Input className="mt-1" value={edit.subject} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>เอกสารเลขที่</Label><Input className="mt-1" value={edit.externalDocNumber} onChange={(e) => setEdit({ ...edit, externalDocNumber: e.target.value })} /></div>
              <div><Label>ลงวันที่</Label><Input type="date" className="mt-1" value={edit.docDate} onChange={(e) => setEdit({ ...edit, docDate: e.target.value })} /></div>
            </div>
            <div><Label>จาก</Label><Input className="mt-1" value={edit.sourceOrg} onChange={(e) => setEdit({ ...edit, sourceOrg: e.target.value })} /></div>
            <div><Label>เรียน</Label><Input className="mt-1" value={edit.recipient} onChange={(e) => setEdit({ ...edit, recipient: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>ความเร่งด่วน</Label><select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={edit.urgencyLevel} onChange={(e) => setEdit({ ...edit, urgencyLevel: e.target.value })}>{URGENCY_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
              <div><Label>ชั้นความลับ</Label><select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={edit.confidentiality} onChange={(e) => setEdit({ ...edit, confidentiality: e.target.value })}>{CONFIDENTIALITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <div><Label>วัตถุประสงค์</Label><div className="mt-1 flex flex-wrap gap-1.5">{OBJECTIVE_OPTIONS.map((o) => { const on = edit.purposes?.includes(o); return <button key={o} type="button" onClick={() => setEdit({ ...edit, purposes: on ? edit.purposes.filter((x: string) => x !== o) : [...(edit.purposes || []), o] })} className={`rounded-full border px-2.5 py-1 text-xs ${on ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{on ? '✓ ' : ''}{o}</button>; })}</div>{edit.purposes?.includes('อื่นๆ') && <Input className="mt-2" placeholder="ระบุอื่นๆ" value={edit.purposeOther} onChange={(e) => setEdit({ ...edit, purposeOther: e.target.value })} />}</div>
            <div><Label>รายละเอียด</Label><textarea className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={3} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 justify-end mt-4"><Button variant="outline" size="sm" onClick={() => setShowEdit(false)}>ยกเลิก</Button><Button size="sm" loading={editV4.isPending} disabled={!edit.subject?.trim()} onClick={() => editV4.mutate()}>บันทึกการแก้ไข</Button></div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 overflow-y-auto" onClick={onClose}>
      <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'} rounded-2xl bg-white p-5 shadow-xl my-8`} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function FileTypeIcon({ file }: { file: any }) {
  const n = (file?.originalName || '').toLowerCase();
  const m = (file?.mimeType || '').toLowerCase();
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/.test(n)) return <ImageIcon className="h-5 w-5 text-purple-500 shrink-0" />;
  if (m === 'application/pdf' || /\.pdf$/.test(n)) return <FileText className="h-5 w-5 text-red-500 shrink-0" />;
  if (/\.(xlsx?|csv)$/.test(n)) return <FileSpreadsheet className="h-5 w-5 text-green-600 shrink-0" />;
  if (/\.(zip|rar|7z)$/.test(n)) return <FileArchive className="h-5 w-5 text-amber-600 shrink-0" />;
  return <FileText className="h-5 w-5 text-blue-500 shrink-0" />;
}

function Field({ label, value, full = false, pre = false, danger = false }: { label: string; value?: any; full?: boolean; pre?: boolean; danger?: boolean }) {
  return (
    <div className={`flex border-b border-gray-100 ${full ? 'sm:col-span-2' : ''}`}>
      <div className="w-32 sm:w-40 shrink-0 px-4 py-2.5 bg-gray-50/70 text-xs font-semibold text-gray-500 border-r border-gray-100">{label}</div>
      <div className={`flex-1 px-4 py-2.5 text-sm ${danger ? 'text-red-600 font-semibold' : 'text-gray-800'} ${pre ? 'whitespace-pre-wrap' : ''}`}>{value || '-'}</div>
    </div>
  );
}
