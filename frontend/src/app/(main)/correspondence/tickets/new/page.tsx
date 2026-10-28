'use client';
import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save, ChevronDown, Check, Sparkles, Loader2, PencilLine, Stamp } from 'lucide-react';
import Link from 'next/link';
import { FilePicker } from '@/components/shared/file-picker';
import { uploadFiles } from '@/lib/upload';
import { URGENCY_OPTIONS, CONFIDENTIALITY_OPTIONS, OBJECTIVE_OPTIONS } from '@/components/shared/status-badge';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { RecipientPicker, type Recipient } from '@/components/shared/recipient-picker';
import { SignDocModal } from '@/components/doc-editor/SignDocModal';
import { useTicketDocContext } from '@/components/doc-editor/ticket-helpers';
import type { DocLayout } from '@/components/doc-editor/types';
import { useAuthStore } from '@/stores/auth.store';

/** dropdown ติ๊กเลือกได้หลายอัน (วัตถุประสงค์) */
function MultiSelectDropdown({ options, value, onChange, placeholder }: {
  options: readonly string[]; value: string[]; onChange: (v: string[]) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  return (
    <div className="relative mt-1">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500">
        <span className={value.length ? 'text-gray-800' : 'text-gray-400'}>{value.length ? value.join(', ') : placeholder}</span>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg py-1">
            {options.map((o) => {
              const on = value.includes(o);
              return (
                <button key={o} type="button" onClick={() => toggle(o)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-gray-50 ${on ? 'text-blue-700' : 'text-gray-700'}`}>
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`}>
                    {on && <Check className="h-3 w-3 text-white" />}
                  </span>
                  {o}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** ช่องที่ AI กรอกให้ได้ (ตรงกับ backend doc-extract.service.ts) */
type AiResult = {
  externalDocNumber: string | null; receiveRegNumber: string | null; docDate: string | null; sourceOrg: string | null;
  subject: string | null; recipient: string | null; body: string | null;
  urgencyLevel: string | null; confidentiality: string | null; purposes: string[];
};

/** เครื่องหมายช่องบังคับ */
const Req = () => <span className="text-red-500 ml-0.5">*</span>;

/** จุดเล็ก ๆ ข้างชื่อช่องที่ AI กรอกให้ — เตือนให้ตรวจทาน */
const AiDot = ({ on }: { on: boolean }) => (on
  ? <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-violet-500 align-middle" title="ระบบกรอกให้ — โปรดตรวจทาน" />
  : null);

/**
 * สร้างสารบรรณ v4 (rework/saraban-v4 — ตาม pptx + Q&A)
 * ผู้ลงรับเซ็นแล้วส่งถึง คน/กอง (RecipientPicker) หรือ ปลัด → กองเจ้าของ = กองของผู้รับคนแรก
 * ขั้นตอน: แนบไฟล์ต้นฉบับ → AI อ่าน (POST /correspondence/ai-extract) → ฟอร์มที่กรอกแล้ว แก้ได้ก่อนบันทึก
 * การบันทึก (POST /correspondence/tickets/v4 + uploadFiles) เหมือนเดิมทุกอย่าง
 */
export default function NewTicketPage() {
  const canAccess = usePermissionGuard('correspondence:create:Ticket');
  const router = useRouter();
  const [form, setForm] = useState({
    receiveRegNumber: '', externalDocNumber: '', docDate: '', sourceOrg: '',
    subject: '', recipient: '', body: '',
    urgencyLevel: 'ปกติ', confidentiality: 'ปกติ', purposeOther: '',
  });
  const [purposes, setPurposes] = useState<string[]>([]);
  const [recipient, setRecipient] = useState<Recipient>(null);
  // เซ็นเอกสาร = ลาก "ลายเซ็นของฉัน" ไปวางบนไฟล์ที่แนบ (ส่งไปกับคำขอสร้างเรื่อง)
  const [signLayout, setSignLayout] = useState<DocLayout | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const meId = useAuthStore((s) => s.user?.id);
  const orgId = useAuthStore((s) => s.user?.organizationId);
  // ลายเซ็นของฉันที่วางบนเอกสารแล้ว (ใช้เป็นรูปลายเซ็นในไทม์ไลน์ด้วย)
  const mySig: string | undefined = signLayout?.items.find((it) => it.type === 'signature' && it.props?.ownerId === meId)?.props?.sig;
  // ข้อมูลสำหรับตรา/ช่องอัตโนมัติในตัวแต่งเอกสาร (เรื่องยังไม่ถูกบันทึก — ใช้ค่าจากฟอร์ม)
  const { data: org } = useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => (await api.get(`/organizations/${orgId}`)).data.data,
    enabled: !!orgId,
  });
  const draftTicket = useMemo(() => ({
    organizationId: orgId, organization: org, subject: form.subject, recipient: form.recipient,
    externalDocNumber: form.externalDocNumber, receiveRegNumber: form.receiveRegNumber, sourceOrg: form.sourceOrg,
    receivedRecordAt: new Date().toISOString(),
  }), [orgId, org, form]);
  const docCtx = useTicketDocContext(draftTicket);
  const [files, setFiles] = useState<File[]>([]);
  // พื้นหลังที่เซ็น = ไฟล์แนบแรกที่เป็น PDF (ไม่มีใช้รูป) — ตรงกับที่หน้าดูเอกสารใช้หลังบันทึก
  const bgFile = files.find((x) => x.type === 'application/pdf' || /\.pdf$/i.test(x.name)) ?? files.find((x) => x.type.startsWith('image/')) ?? null;
  // เปลี่ยนไฟล์พื้นหลัง → ต้องเซ็นใหม่ (ตำแหน่ง/จำนวนหน้าเปลี่ยน)
  const [signedFor, setSignedFor] = useState<File | null>(null);
  if (signLayout && signedFor !== bgFile) { setSignLayout(null); setSignedFor(null); }
  // upload = แนบไฟล์ก่อน · reading = AI กำลังอ่าน · form = ฟอร์มเดิม (กรอกจาก AI แล้ว)
  const [step, setStep] = useState<'upload' | 'reading' | 'form'>('upload');
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const aiAbort = useRef<AbortController | null>(null);

  /** ส่งไฟล์ให้ AI อ่าน แล้วเติมเฉพาะช่องที่ยังว่าง — อ่านไม่ได้ก็ไปฟอร์มเปล่าพร้อมไฟล์ */
  const readWithAi = async (picked: File[]) => {
    setStep('reading');
    const ctrl = new AbortController();
    aiAbort.current = ctrl;
    try {
      const fd = new FormData();
      picked.slice(0, 5).forEach((f) => fd.append('files', f));
      const res = await api.post('/correspondence/ai-extract', fd, { signal: ctrl.signal, timeout: 180_000 });
      if (ctrl.signal.aborted) return;
      const { data: ai, filled } = (res.data.data ?? res.data) as { data: AiResult; filled: boolean };
      const got = new Set<string>();
      setForm((p) => {
        const next = { ...p };
        (['externalDocNumber', 'receiveRegNumber', 'docDate', 'sourceOrg', 'subject', 'recipient', 'body'] as const).forEach((k) => {
          if (ai[k] && !String(p[k]).trim()) { next[k] = ai[k] as string; got.add(k); }
        });
        if (ai.urgencyLevel && p.urgencyLevel === 'ปกติ' && ai.urgencyLevel !== 'ปกติ') { next.urgencyLevel = ai.urgencyLevel; got.add('urgencyLevel'); }
        if (ai.confidentiality && p.confidentiality === 'ปกติ' && ai.confidentiality !== 'ปกติ') { next.confidentiality = ai.confidentiality; got.add('confidentiality'); }
        return next;
      });
      if (ai.purposes?.length) { setPurposes((p) => (p.length ? p : ai.purposes)); got.add('purposes'); }
      setAiFields(got);
      if (!filled) toast.error('ระบบอ่านข้อมูลจากเอกสารนี้ไม่ได้ — กรุณากรอกเอง');
    } catch (err) {
      if (ctrl.signal.aborted) return;
      toast.error(getErrorMessage(err, 'ระบบอ่านเอกสารไม่สำเร็จ — กรุณากรอกเอง'));
    } finally {
      if (!ctrl.signal.aborted) setStep('form');
    }
  };

  const skipAi = () => { aiAbort.current?.abort(); setStep('form'); };

  const create = useMutation({
    mutationFn: async () => {
      const payload: any = {
        registerBook: 'R_MAIN',
        receiveRegNumber: form.receiveRegNumber.trim(),
        externalDocNumber: form.externalDocNumber.trim(),
        docDate: form.docDate,
        sourceOrg: form.sourceOrg.trim(),
        subject: form.subject.trim(),
        recipient: form.recipient || undefined,
        body: form.body || undefined,
        urgencyLevel: form.urgencyLevel,
        confidentiality: form.confidentiality || undefined,
        purposes: purposes.length ? purposes : undefined,
        purposeOther: purposes.includes('อื่นๆ') ? (form.purposeOther || undefined) : undefined,
        signatureImage: mySig,
        overlayLayout: signLayout,
        ...(recipient?.kind === 'clerk' ? { toClerk: true } : { toUserId: recipient?.kind === 'person' ? recipient.userId : undefined }),
      };
      const res = await api.post('/correspondence/tickets/v4', payload);
      const ticket = res.data.data ?? res.data;
      if (files.length) await uploadFiles(files, { bucket: 'documents', refType: 'ticket', refId: ticket.id });
      return ticket;
    },
    onSuccess: (ticket) => {
      toast.success(`สร้างสารบรรณสำเร็จ เลขที่ ${ticket.ticketNumber}`);
      router.push(`/correspondence/tickets/${ticket.id}`);
    },
    onError: (err: any) => toast.error(getErrorMessage(err, 'ไม่สามารถบันทึกได้')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.externalDocNumber.trim()) return toast.error('กรุณากรอกเอกสารเลขที่');
    if (!form.receiveRegNumber.trim()) return toast.error('กรุณากรอกเลขทะเบียนรับ');
    if (!form.docDate) return toast.error('กรุณาระบุลงวันที่');
    if (!form.sourceOrg.trim()) return toast.error('กรุณากรอกช่อง "จาก"');
    if (!form.subject.trim()) return toast.error('กรุณาระบุเรื่อง');
    if (!recipient) return toast.error('กรุณาเลือกผู้รับ (กอง/บุคคล) หรือส่งปลัด');
    if (!files.length) return toast.error('กรุณาแนบไฟล์ต้นฉบับ');
    if (!mySig) return toast.error('กรุณากด "เซ็นเอกสาร" แล้ววางลายเซ็นของคุณก่อนบันทึก');
    create.mutate();
  };

  const f = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [name]: e.target.value })),
  });

  if (!canAccess) return null;
  const selectCls = 'mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="flex flex-col h-full">
      <Header title="สร้างสารบรรณ" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/correspondence/tickets"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900">สร้างสารบรรณ</h1>
        </div>

        {step === 'upload' && (
          <div className="mx-auto max-w-4xl space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 text-sm border-b pb-2 mb-1">แนบไฟล์หนังสือต้นฉบับ<Req /></h2>
              <p className="mb-4 flex items-center gap-1.5 text-xs text-gray-500">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" /> แนบแล้วระบบจะอ่านหนังสือและกรอกข้อมูลให้อัตโนมัติ (PDF/รูปภาพ) — ตรวจแก้ได้ก่อนบันทึก
              </p>
              <FilePicker value={files} previewHeight="h-[28rem]" size="lg"
                onChange={(picked) => { setFiles(picked); if (picked.length) void readWithAi(picked); }} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs text-gray-400">ไม่มีไฟล์ หรือไม่ต้องการให้ระบบอ่าน?</span>
              <Button type="button" variant="outline" size="lg" className="px-6" onClick={() => setStep('form')}>
                <PencilLine className="h-4 w-4" /> ข้าม — กรอกข้อมูลเอง
              </Button>
            </div>
          </div>
        )}

        {step === 'reading' && (
          <div className="mx-auto flex max-w-md flex-col items-center rounded-xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
            <Loader2 className="h-9 w-9 animate-spin text-violet-500" />
            <p className="mt-4 font-semibold text-gray-900">ระบบกำลังประมวลผล…</p>
            <p className="mt-1 text-sm text-gray-500">ใช้เวลาประมาณ 10–30 วินาที · {files.length} ไฟล์</p>
            <Button type="button" variant="outline" className="mt-6" onClick={skipAi}>
              <PencilLine className="h-4 w-4" /> ข้าม — กรอกเอง
            </Button>
          </div>
        )}

        {step === 'form' && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {aiFields.size > 0 && (
            <div className="lg:col-span-5 flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-800">
              <Sparkles className="h-4 w-4 shrink-0" />
              ระบบกรอกข้อมูลจากเอกสารให้แล้ว {aiFields.size} ช่อง (มีจุดสีม่วงกำกับ) — โปรดตรวจทานให้ถูกต้องก่อนบันทึก
            </div>
          )}
          {/* ซ้าย: ฟอร์มข้อมูลหนังสือ + ผู้ปฏิบัติ */}
          <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">ข้อมูลหนังสือ</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>เอกสารเลขที่<Req /><AiDot on={aiFields.has('externalDocNumber')} /></Label>
                <Input className="mt-1" placeholder="บร 0023.1/1234" {...f('externalDocNumber')} />
              </div>
              <div>
                <Label>เลขทะเบียนรับ<Req /><AiDot on={aiFields.has('receiveRegNumber')} /></Label>
                <Input className="mt-1 font-mono" {...f('receiveRegNumber')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ลงวันที่<Req /><AiDot on={aiFields.has('docDate')} /></Label>
                <Input type="date" className="mt-1" {...f('docDate')} />
              </div>
              <div>
                <Label>จาก<Req /><AiDot on={aiFields.has('sourceOrg')} /></Label>
                <Input className="mt-1" {...f('sourceOrg')} />
              </div>
            </div>

            <div>
              <Label>เรื่อง<Req /><AiDot on={aiFields.has('subject')} /></Label>
              <Input className="mt-1" {...f('subject')} />
            </div>

            <div>
              <Label>เรียน<AiDot on={aiFields.has('recipient')} /></Label>
              <Input className="mt-1" {...f('recipient')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ความเร่งด่วน<AiDot on={aiFields.has('urgencyLevel')} /></Label>
                <select className={selectCls} {...f('urgencyLevel')}>
                  {URGENCY_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <Label>ชั้นความลับ<AiDot on={aiFields.has('confidentiality')} /></Label>
                <select className={selectCls} {...f('confidentiality')}>
                  {CONFIDENTIALITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label>วัตถุประสงค์<AiDot on={aiFields.has('purposes')} /></Label>
              <MultiSelectDropdown options={OBJECTIVE_OPTIONS} value={purposes} onChange={setPurposes} placeholder="เลือกวัตถุประสงค์" />
              {purposes.includes('อื่นๆ') && <Input className="mt-2" placeholder="ระบุวัตถุประสงค์อื่นๆ" {...f('purposeOther')} />}
            </div>

            <div>
              <Label>รายละเอียด<AiDot on={aiFields.has('body')} /></Label>
              {/* ขยายตามเนื้อหาอัตโนมัติ (field-sizing) — อ่านตรวจทานได้ทั้งหมดไม่ต้องเลื่อนในกล่อง · เบราว์เซอร์ที่ไม่รองรับใช้ความสูงขั้นต่ำ + ลากขยายเองได้ */}
              <textarea className="mt-1 w-full min-h-56 border border-gray-300 rounded-lg px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y field-sizing-content" rows={10} {...f('body')} />
            </div>
          </div>

            {/* ส่งถึง + ลายเซ็นผู้ลงรับ (ทุกการส่งต้องเซ็น) */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
              <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">ส่งถึง<Req /></h2>
              <RecipientPicker value={recipient} onChange={setRecipient} excludeUserId={meId} />
              <div className="border-t pt-4">
                <Label>เซ็นเอกสาร (ผู้ลงรับ)<Req /></Label>
                {mySig ? (
                  <div className="mt-2 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mySig} alt="ลายเซ็น" className="h-14 rounded border border-gray-200 bg-white" />
                    <span className="flex-1 text-sm text-green-700">วางลายเซ็นบนเอกสารแล้ว</span>
                    <Button type="button" variant="outline" size="sm" onClick={() => setSignOpen(true)}>เปิดดู / แก้</Button>
                  </div>
                ) : (
                  <>
                    <Button type="button" variant="outline" className="mt-2 w-full" disabled={!files.length} onClick={() => setSignOpen(true)}>
                      <Stamp className="h-4 w-4" />เซ็นเอกสาร
                    </Button>
                    <p className="mt-1.5 text-xs text-gray-500">{files.length ? 'เปิดเอกสารที่แนบ แล้วลาก "ลายเซ็นของฉัน" ไปวาง' : 'แนบไฟล์ต้นฉบับก่อน แล้วจึงเซ็นเอกสารได้'}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ขวา: แนบไฟล์ + preview เอกสาร (รูป/PDF เห็นเลยเหมือนหน้ารายละเอียด) — ติดขอบบนเวลาเลื่อน */}
          <div className="lg:col-span-3 lg:sticky lg:top-4 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2 mb-3">แนบไฟล์ต้นฉบับ<Req /></h2>
            <FilePicker value={files} onChange={setFiles} />
          </div>

          <div className="lg:col-span-5 flex gap-3">
            <Button type="submit" loading={create.isPending}><Save className="h-4 w-4" />บันทึกสารบรรณ</Button>
            <Link href="/correspondence/tickets"><Button variant="outline" type="button">ยกเลิก</Button></Link>
          </div>
        </form>
        )}
      </div>

      {signOpen && (
        <SignDocModal file={bgFile} ctx={docCtx} initial={signLayout}
          onDone={(l) => { setSignLayout(l); setSignedFor(bgFile); setSignOpen(false); }} onClose={() => setSignOpen(false)} />
      )}
    </div>
  );
}
