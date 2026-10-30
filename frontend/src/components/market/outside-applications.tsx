'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Empty, Panel } from '@/components/pay/pay-ui';

type Status = 'pending' | 'approved' | 'rejected';
type Application = {
  id: string; appCode: string; applicantName: string; phone: string; idCardUrl: string | null;
  startDate: string | null; days: number; status: Status; reviewNote: string | null; billId: string | null;
  location?: { name: string; rentRate: string; rentPeriod: 'daily' | 'monthly' };
};

const STATUS_LABEL: Record<Status, string> = { pending: 'รอตรวจ', approved: 'อนุมัติแล้ว · ออกบิลแล้ว', rejected: 'ไม่อนุมัติ' };
const FILTERS: { key: Status | 'all'; label: string }[] = [
  { key: 'pending', label: 'รอตรวจ' }, { key: 'approved', label: 'อนุมัติแล้ว' }, { key: 'rejected', label: 'ไม่อนุมัติ' }, { key: 'all', label: 'ทั้งหมด' },
];
const thDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

/** ใบสมัครแผงลอยจากประชาชน — อนุมัติแล้วระบบออกบิลค่าเช่าให้ทันที (ประชาชนค้นด้วยรหัส OUT-xxxx) */
export function OutsideApplications({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Status | 'all'>('pending');
  const [rejectTarget, setRejectTarget] = useState<Application | null>(null);
  const { data: rows = [] } = useQuery<Application[]>({
    queryKey: ['market', 'outside', 'apps', filter],
    queryFn: async () => (await api.get('/market/outside/applications', { params: filter === 'all' ? {} : { status: filter } })).data.data,
    refetchInterval: 10_000,
  });
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
  const reject = useMutation({
    mutationFn: (id: string) => api.post(`/market/outside/applications/${id}/reject`, {}),
    onSuccess: () => { toast.success('ไม่อนุมัติใบสมัครแล้ว'); setRejectTarget(null); refresh(); },
    onError: (e) => { toast.error(getErrorMessage(e)); setRejectTarget(null); },
  });

  return (
    <Panel title={<>ใบสมัครแผงลอย <span className="text-sm font-normal text-gray-500">({rows.length})</span></>}>
      <div className="flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>{f.label}</Button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty>ไม่มีใบสมัครในสถานะนี้</Empty>
      ) : (
        <ul>
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.appCode} <span className="font-normal text-gray-500">· {a.applicantName}</span></p>
                <p className="text-sm text-gray-500">
                  {a.location?.name ?? '—'} · โทร {a.phone} · {a.startDate ? `เริ่ม ${thDate(a.startDate)}` : 'ไม่ระบุวันเริ่ม'} · {a.days} วัน
                </p>
                <p className="text-sm text-gray-500">
                  {STATUS_LABEL[a.status]}
                  {a.reviewNote && ` · ${a.reviewNote}`}
                  {' · '}
                  {a.idCardUrl
                    ? <a href={a.idCardUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">ดูรูปบัตรประชาชน</a>
                    : 'ไม่ได้แนบบัตร'}
                </p>
              </div>
              {canManage && a.status === 'pending' && (
                <div className="flex gap-2">
                  <Button size="sm" variant="success" loading={approve.isPending && approve.variables === a.id} onClick={() => approve.mutate(a.id)}>อนุมัติและออกบิล</Button>
                  <Button size="sm" variant="outline" onClick={() => setRejectTarget(a)}>ไม่อนุมัติ</Button>
                </div>
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
    </Panel>
  );
}
