'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { URGENCY_OPTIONS, CONFIDENTIALITY_OPTIONS, OBJECTIVE_OPTIONS } from '@/components/shared/status-badge';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { AssignmentPicker } from '@/components/shared/assignment-picker';
import { useAuthStore } from '@/stores/auth.store';

type Enclosure = { name: string; qty: string; unit: string };
const toDateInput = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function EditTicketPage() {
  const canAccess = usePermissionGuard('correspondence:update:Ticket');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuthStore();

  const [form, setForm] = useState({
    subject: '', body: '', externalDocNumber: '', docDate: '', sentDate: '', sentTime: '', dueDate: '',
    urgencyLevel: 'ปกติ', confidentiality: 'ปกติ', purpose: '', purposeOther: '',
    recipient: '', sourceOrg: '', refDocNumber: '', refDocDetail: '', responsibleUserId: '', note: '',
  });
  const [enclosures, setEnclosures] = useState<Enclosure[]>([]);
  const [circularRecipients, setCircularRecipients] = useState<string[]>([]);
  const [isCircular, setIsCircular] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [assignMap, setAssignMap] = useState<Record<string, string[]>>({});

  const { data: ticket } = useQuery({
    queryKey: ['ticket', id],
    queryFn: async () => (await api.get(`/correspondence/tickets/${id}`)).data.data,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get(`/organizations/${me?.organizationId}/departments`)).data.data as any[],
    enabled: !!me?.organizationId,
  });

  const EDITABLE_STATUSES = ['รอดำเนินการ', 'กำลังดำเนินการ', 'ตีกลับ'];
  const assignEditable = !!ticket && EDITABLE_STATUSES.includes(ticket.status);

  const { data: suggestions } = useQuery({
    queryKey: ['ticket-suggestions'],
    queryFn: async () => (await api.get('/correspondence/tickets/suggestions')).data.data as { sources: string[]; recipients: string[] },
  });

  useEffect(() => {
    if (!ticket || loaded) return;
    setForm({
      subject: ticket.subject || '', body: ticket.body || '', externalDocNumber: ticket.externalDocNumber || '',
      docDate: toDateInput(ticket.docDate), sentDate: toDateInput(ticket.sentDate), sentTime: ticket.sentTime || '',
      dueDate: toDateInput(ticket.dueDate), urgencyLevel: ticket.urgencyLevel || 'ปกติ',
      confidentiality: ticket.confidentiality || 'ปกติ', purpose: ticket.purpose || '', purposeOther: ticket.purposeOther || '',
      recipient: ticket.recipient || '', sourceOrg: ticket.sourceOrg || '', refDocNumber: ticket.refDocNumber || '',
      refDocDetail: ticket.refDocDetail || '', responsibleUserId: ticket.responsibleUserId || '', note: ticket.note || '',
    });
    setEnclosures(Array.isArray(ticket.enclosures) ? ticket.enclosures.map((e: any) => ({ name: e.name || '', qty: e.qty || '', unit: e.unit || '' })) : []);
    setIsCircular(!!ticket.isCircular);
    setCircularRecipients(Array.isArray(ticket.circularRecipients) && ticket.circularRecipients.length ? ticket.circularRecipients : (ticket.isCircular ? [''] : []));
    const map: Record<string, string[]> = {};
    for (const td of ticket.ticketDepartments || []) {
      if (td.isActive === false) continue;
      map[td.departmentId] = Array.isArray(td.assignedUserIds) && td.assignedUserIds.length ? td.assignedUserIds : (td.assignedUserId ? [td.assignedUserId] : []);
    }
    setAssignMap(map);
    setLoaded(true);
  }, [ticket, loaded]);

  const f = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [name]: e.target.value })),
  });

  const save = useMutation({
    mutationFn: async () => {
      const cleanEnclosures = enclosures.filter((e) => e.name.trim())
        .map((e) => ({ name: e.name.trim(), qty: e.qty || undefined, unit: e.unit || undefined }));
      const payload: any = {
        subject: form.subject,
        body: form.body || undefined,
        externalDocNumber: form.externalDocNumber || undefined,
        docDate: form.docDate || undefined,
        sentDate: form.sentDate || undefined,
        sentTime: form.sentTime || undefined,
        dueDate: form.dueDate || undefined,
        urgencyLevel: form.urgencyLevel,
        confidentiality: form.confidentiality || undefined,
        purpose: form.purpose || undefined,
        purposeOther: form.purpose === 'อื่นๆ' ? (form.purposeOther || undefined) : undefined,
        recipient: form.recipient || undefined,
        sourceOrg: form.sourceOrg || undefined,
        refDocNumber: form.refDocNumber || undefined,
        refDocDetail: form.refDocDetail || undefined,
        enclosures: cleanEnclosures,
        note: form.note || undefined,
        circularRecipients: isCircular ? circularRecipients.map((r) => r.trim()).filter(Boolean) : undefined,
        ...(assignEditable ? {
          departmentIds: Object.keys(assignMap),
          assignees: Object.entries(assignMap).map(([departmentId, userIds]) => ({ departmentId, userIds })),
        } : {}),
      };
      return (await api.patch(`/correspondence/tickets/${id}`, payload)).data;
    },
    onSuccess: () => { toast.success('บันทึกการแก้ไขแล้ว'); router.push(`/correspondence/tickets/${id}`); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'แก้ไขไม่สำเร็จ')),
  });

  if (!canAccess) return null;
  const selectCls = 'mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="flex flex-col h-full">
      <Header title="แก้ไขสารบรรณ" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center gap-3 mb-5">
          <Link href={`/correspondence/tickets/${id}`}><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900">แก้ไขเอกสาร <span className="font-mono text-blue-700">{ticket?.ticketNumber}</span></h1>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); if (!form.subject.trim()) { toast.error('กรุณาระบุเรื่อง'); return; } save.mutate(); }} className="max-w-4xl space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">ข้อมูลหนังสือ</h2>

            {isCircular && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>ผู้รับหนังสือเวียน (หลายราย)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCircularRecipients((p) => [...p, ''])}><Plus className="h-4 w-4" />เพิ่มผู้รับ</Button>
                </div>
                {circularRecipients.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="flex-1 bg-white" value={r} onChange={(e) => setCircularRecipients((p) => p.map((x, idx) => idx === i ? e.target.value : x))} />
                    <button type="button" onClick={() => setCircularRecipients((p) => p.filter((_, idx) => idx !== i))} className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><Label>เลขที่เอกสาร</Label><Input className="mt-1" {...f('externalDocNumber')} /></div>
              <div><Label>ลงวันที่</Label><Input type="date" className="mt-1" {...f('docDate')} /></div>
            </div>
            <div>
              <Label>จาก (หน่วยงานต้นทาง)</Label>
              <Input className="mt-1" list="src-suggestions-e" {...f('sourceOrg')} />
              <datalist id="src-suggestions-e">{suggestions?.sources?.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <div><Label>เรื่อง<span className="text-red-500 ml-0.5">*</span></Label><Input className="mt-1" {...f('subject')} required /></div>
            <div>
              <Label>เรียน</Label>
              <Input className="mt-1" list="rcpt-suggestions-e" {...f('recipient')} />
              <datalist id="rcpt-suggestions-e">{suggestions?.recipients?.map((s) => <option key={s} value={s} />)}</datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>ความเร่งด่วน</Label><select className={selectCls} {...f('urgencyLevel')}>{URGENCY_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
              <div><Label>ชั้นความลับ</Label><select className={selectCls} {...f('confidentiality')}>{CONFIDENTIALITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>วัตถุประสงค์</Label><select className={selectCls} {...f('purpose')}><option value="">เลือก...</option>{OBJECTIVE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
              {form.purpose === 'อื่นๆ' && <div><Label>ระบุวัตถุประสงค์อื่นๆ</Label><Input className="mt-1" {...f('purposeOther')} /></div>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div><Label>วันที่ส่ง</Label><Input type="date" className="mt-1" {...f('sentDate')} /></div>
              <div><Label>เวลาส่ง</Label><Input type="time" className="mt-1" {...f('sentTime')} /></div>
              <div><Label>วันครบกำหนด</Label><Input type="date" className="mt-1" {...f('dueDate')} /></div>
            </div>

            <div><Label>รายละเอียด</Label><textarea className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={4} {...f('body')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>เลขหนังสืออ้างอิง</Label><Input className="mt-1" {...f('refDocNumber')} /></div>
              <div><Label>รายละเอียดอ้างถึง</Label><Input className="mt-1" {...f('refDocDetail')} /></div>
            </div>
            <div><Label>หมายเหตุ</Label><Input className="mt-1" {...f('note')} /></div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-3">
            <h2 className="font-semibold text-gray-900 text-sm border-b pb-2">มอบหมายกองที่ดำเนินการ</h2>
            {assignEditable ? (
              <>
                <p className="text-xs text-gray-500">ติ๊กเลือกกอง แล้วเลือกผู้รับผิดชอบในกองนั้น (เลือกได้หลายกอง · 1 กองเลือกได้หลายคน)</p>
                <AssignmentPicker departments={departments || []} value={assignMap} onChange={setAssignMap} />
              </>
            ) : (
              <p className="text-sm text-gray-400">เรื่องเข้าสู่ขั้นลงนามแล้ว — เปลี่ยนการมอบหมายได้ที่หน้ารายละเอียด (เห็นควรมอบ)</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="font-semibold text-gray-900 text-sm">สิ่งที่ส่งมาด้วย</h2>
              <Button type="button" variant="outline" size="sm" onClick={() => setEnclosures((p) => [...p, { name: '', qty: '', unit: '' }])}><Plus className="h-4 w-4" />เพิ่มรายการ</Button>
            </div>
            {enclosures.length === 0 ? <p className="text-sm text-gray-400">ยังไม่มีรายการ</p> : (
              <div className="space-y-2">
                {enclosures.map((e, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input className="flex-1" placeholder="ชื่อเอกสาร" value={e.name} onChange={(ev) => setEnclosures((p) => p.map((x, idx) => idx === i ? { ...x, name: ev.target.value } : x))} />
                    <Input className="w-20" placeholder="จำนวน" value={e.qty} onChange={(ev) => setEnclosures((p) => p.map((x, idx) => idx === i ? { ...x, qty: ev.target.value } : x))} />
                    <Input className="w-24" placeholder="หน่วย" value={e.unit} onChange={(ev) => setEnclosures((p) => p.map((x, idx) => idx === i ? { ...x, unit: ev.target.value } : x))} />
                    <button type="button" onClick={() => setEnclosures((p) => p.filter((_, idx) => idx !== i))} className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button type="submit" loading={save.isPending}><Save className="h-4 w-4" />บันทึกการแก้ไข</Button>
            <Link href={`/correspondence/tickets/${id}`}><Button variant="outline" type="button">ยกเลิก</Button></Link>
          </div>
        </form>
      </div>
    </div>
  );
}
