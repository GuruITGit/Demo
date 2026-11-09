'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Empty, MethodChip, Panel, Segmented, SlipButton } from '@/components/pay/pay-ui';

type Status = 'pending' | 'approved' | 'rejected' | 'cancelled';
type Application = {
  id: string; appCode: string; locationId: string; applicantName: string; phone: string; idCardUrl: string | null;
  startDate: string | null; days: number; status: Status; reviewNote: string | null; billId: string | null; tenancyType: 'regular' | 'temporary';
  location?: { name: string; rentRate: string; rentPeriod: 'daily' | 'monthly' };
  openDues: { count: number; total: number };
};

const STATUS_LABEL: Record<Status, string> = { pending: 'รอตรวจ', approved: 'ผู้เช่า · ออกบิลแล้ว', rejected: 'ไม่อนุมัติ', cancelled: 'ลบออกจากผู้เช่าแล้ว' };
const FILTERS: { key: Status | 'all'; label: string }[] = [
  { key: 'pending', label: 'รอตรวจ' }, { key: 'approved', label: 'ผู้เช่า' }, { key: 'rejected', label: 'ไม่อนุมัติ' }, { key: 'cancelled', label: 'ลบแล้ว' }, { key: 'all', label: 'ทั้งหมด' },
];
const thDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

/** ใบสมัครแผงลอยจากประชาชน — อนุมัติแล้วระบบออกบิลค่าเช่าให้ทันที (ประชาชนค้นด้วยรหัส OUT-xxxx) */
export type ApplicationFilter = Status | 'all';
export function OutsideApplications({ canManage, locationId, filter: shared }: { canManage: boolean; locationId?: string; filter?: ApplicationFilter }) {
  const qc = useQueryClient();
  const [own, setOwn] = useState<ApplicationFilter>('pending');
  const controlled = shared !== undefined;
  const [kindFilter, setKindFilter] = useState<'all' | 'regular' | 'temporary'>('all');
  const filter = shared ?? own;
  const setFilter = setOwn;
  const [rejectTarget, setRejectTarget] = useState<Application | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Application | null>(null);
  const { data: all = [] } = useQuery<Application[]>({
    queryKey: ['market', 'outside', 'apps', filter],
    queryFn: async () => (await api.get('/market/outside/applications', { params: filter === 'all' ? {} : { status: filter } })).data.data,
    refetchInterval: 10_000,
  });
  // บิลของใบสมัคร (รหัส OUT-xxxx = stallCode) — แสดงสถานะจ่าย/วิธี/สลิปบนการ์ดใบสมัครเลย
  type AppBill = { stallCode: string; status: string; paidMethod: string | null; submittedMethod: string | null; slipUrl: string | null };
  const { data: bills = [] } = useQuery<AppBill[]>({ queryKey: ['market', 'bills', 'outside-apps'], queryFn: async () => (await api.get('/market/bills')).data.data, refetchInterval: 10_000 });
  const billOf = (code: string) => { const l = bills.filter((b) => b.stallCode === code); return l.find((b) => b.slipUrl) ?? l[0]; };
  const rows = (locationId ? all.filter((a) => a.locationId === locationId) : all).filter((a) => kindFilter === 'all' || a.tenancyType === kindFilter);
  const refresh = () => qc.invalidateQueries({ queryKey: ['market', 'outside', 'apps'] });

  const approve = useMutation({
    mutationFn: (id: string) => api.post(`/market/outside/applications/${id}/approve`),
    onSuccess: (r) => {
      const d = r.data.data;
      toast.success(`อนุมัติแล้ว · ออกบิลค่าเช่า ${Number(d.amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`);
      refresh();
      qc.invalidateQueries({ queryKey: ['market', 'bills'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.post(`/market/outside/applications/${id}/cancel`, {}),
    onSuccess: () => { toast.success('ลบผู้เช่าแล้ว (ประวัติยังเก็บไว้)'); setCancelTarget(null); refresh(); },
    onError: (e) => { toast.error(getErrorMessage(e)); setCancelTarget(null); },
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.post(`/market/outside/applications/${id}/reject`, {}),
    onSuccess: () => { toast.success('ไม่อนุมัติใบสมัครแล้ว'); setRejectTarget(null); refresh(); },
    onError: (e) => { toast.error(getErrorMessage(e)); setRejectTarget(null); },
  });

  return (
    <Panel title={<>ใบสมัครแผงลอย <span className="text-[13px] font-normal text-gray-500">({rows.length})</span></>}>
      {!controlled && (
      <div className="flex flex-wrap gap-2 border-b border-gray-100 px-3 py-2">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>{f.label}</Button>
        ))}
      </div>
      )}
      <div className="border-b border-gray-100 px-3 py-1.5"><Segmented label="ประเภท" value={kindFilter} onChange={setKindFilter} options={[['all', 'ทุกประเภท'], ['regular', 'ประจำ'], ['temporary', 'ชั่วคราว']] as const} /></div>
      {rows.length === 0 ? (
        <Empty>ไม่มีใบสมัครในสถานะนี้</Empty>
      ) : (
        <ul>
          {rows.map((a) => (
            <li key={a.id} className="flex items-center gap-3 border-t border-gray-100 px-3 py-2 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className="keep-name text-base">{a.applicantName}</span>
                  <span className="text-[13px] font-normal text-gray-500">{a.appCode}</span>
                  <span className="whitespace-nowrap rounded-sm bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-700">{a.tenancyType === 'temporary' ? 'ชั่วคราว' : 'ประจำ'}</span>
                  <span className={`whitespace-nowrap rounded-sm px-1.5 py-0 text-[11px] font-medium ${a.status === 'pending' ? 'bg-blue-50 text-blue-700' : a.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[a.status]}</span>
                </p>
                <p className="mt-0.5 text-[13px] text-gray-600">
                  {a.location?.name ?? '—'} · โทร {a.phone} · {a.startDate ? `เริ่ม ${thDate(a.startDate)}` : 'ไม่ระบุวันเริ่ม'} · {a.days} วัน
                </p>
                <p className="text-[13px] text-gray-500">
                  {a.status === 'approved' && (a.openDues.count > 0
                    ? <span className="font-medium text-amber-700">ค้าง {a.openDues.count} รายการ {Number(a.openDues.total).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท · </span>
                    : <span className="text-green-700">ไม่มียอดค้าง · </span>)}
                  {a.reviewNote && `${a.reviewNote} · `}
                  {a.idCardUrl
                    ? <a href={a.idCardUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">ดูรูปบัตรประชาชน</a>
                    : 'ไม่ได้แนบบัตร'}
                </p>
                {(() => { const b = billOf(a.appCode); if (!b) return null; const m = b.paidMethod ?? b.submittedMethod; return (
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="text-gray-500">การชำระเงิน:</span>
                    {b.status === 'paid' ? <span className="font-medium text-green-700">ชำระแล้ว</span> : b.status === 'pending' ? <span className="font-medium text-blue-700">แจ้งชำระแล้ว · รอตรวจ</span> : <span className="font-medium text-amber-700">ยังไม่ชำระ</span>}
                    {m && <MethodChip method={m} />}
                    <SlipButton url={b.slipUrl} method={m} />
                  </p>); })()}
              </div>
              {canManage && a.status === 'pending' && (
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:ml-auto">
                  <Button size="sm" variant="success" loading={approve.isPending && approve.variables === a.id} onClick={() => approve.mutate(a.id)}>อนุมัติและออกบิล</Button>
                  <Button size="sm" variant="outline" onClick={() => setRejectTarget(a)}>ไม่อนุมัติ</Button>
                </div>
              )}
              {canManage && a.status === 'approved' && (
                <Button size="sm" className="shrink-0 ml-auto" variant="outline" disabled={a.openDues.count > 0} title={a.openDues.count > 0 ? 'ต้องชำระยอดค้างให้ครบก่อน' : undefined} onClick={() => setCancelTarget(a)}>ลบผู้เช่า</Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!rejectTarget}
        onOpenChange={(o) => { if (!o) setRejectTarget(null); }}
        loading={reject.isPending}
        onConfirm={() => rejectTarget && reject.mutate(rejectTarget.id)}
        title={`ไม่อนุมัติใบสมัคร ${rejectTarget?.appCode ?? ''}?`}
        description="ผู้สมัครจะไม่ได้รับบิลค่าเช่า ต้องสมัครใหม่หากต้องการเช่า"
        confirmText="ไม่อนุมัติ"
      />
      <ConfirmDialog
        open={!!cancelTarget}
        onOpenChange={(o) => { if (!o) setCancelTarget(null); }}
        loading={cancel.isPending}
        onConfirm={() => cancelTarget && cancel.mutate(cancelTarget.id)}
        title={`ลบผู้เช่า ${cancelTarget?.appCode ?? ''}?`}
        description="ผู้เช่าจะถูกลบออกจากรายชื่อ ประวัติการเช่าและบิลเดิมยังเก็บไว้ เลือกดูได้จากตัวกรอง 'ลบแล้ว'"
        confirmText="ลบผู้เช่า"
      />
    </Panel>
  );
}
