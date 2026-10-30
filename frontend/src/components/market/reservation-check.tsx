'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Empty, Panel } from '@/components/pay/pay-ui';

type Reservation = {
  id: string; stallCode: string; zone: string; tenantName: string | null; contactPhone: string | null;
  reservedAt: string | null; reserveStartDate: string | null; reserveDays: number | null; reserveCardUrl: string | null;
};

const thDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

/** แท็บ "จองแผง": ใครจองแผงไหน (เบอร์/วันเริ่มเช่า/จำนวนวัน/รูปบัตร) + ยืนยัน/ปฏิเสธ + แจ้งเตือนผู้จัดการตลาด */
export function ReservationCheck({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<Reservation[]>({
    queryKey: ['market', 'reservations'],
    queryFn: async () => (await api.get('/market/reservations')).data.data,
    refetchInterval: 5_000,
  });
  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'occupied' | 'available' }) => api.patch(`/market/stalls/${id}`, { status }),
    onSuccess: (_r, v) => { toast.success(v.status === 'occupied' ? 'ยืนยันเป็นผู้เช่าแล้ว' : 'ปฏิเสธการจองแล้ว แผงกลับเป็นว่าง'); qc.invalidateQueries({ queryKey: ['market'] }); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });
  const notify = useMutation({
    mutationFn: async () => (await api.post('/market/reservations/notify')).data.data,
    onSuccess: (d) => toast.success(`แจ้งเตือนผู้จัดการตลาดแล้ว · ${d?.count ?? rows.length} แผงรอยืนยัน`),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Panel
      title={<>การจองแผงที่รอยืนยัน <span className="text-sm font-normal text-gray-500">({rows.length})</span></>}
      actions={canManage && rows.length > 0 && <Button size="sm" variant="outline" loading={notify.isPending} onClick={() => notify.mutate()}>แจ้งเตือนผู้จัดการตลาด</Button>}
    >
      {isLoading ? null : rows.length === 0 ? (
        <Empty>ยังไม่มีการจองที่รอยืนยัน — เมื่อประชาชนจองแผง จะขึ้นที่นี่และมีแจ้งเตือน</Empty>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">แผง {r.stallCode} <span className="font-normal text-gray-500">· โซน {r.zone} · {r.tenantName || '—'}</span></p>
                <p className="text-sm text-gray-500">
                  โทร {r.contactPhone ? <a href={`tel:${r.contactPhone}`} className="text-sky-700 underline">{r.contactPhone}</a> : '—'}
                  {r.reservedAt && ` · จองเมื่อ ${new Date(r.reservedAt).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}`}
                </p>
                <p className="text-sm text-gray-500">
                  {r.reserveStartDate ? `เริ่มเช่า ${thDate(r.reserveStartDate)}${r.reserveDays ? ` · ${r.reserveDays} วัน` : ''}` : 'ไม่ได้ระบุวันเริ่มเช่า'}
                  {' · '}
                  {r.reserveCardUrl
                    ? <a href={r.reserveCardUrl} target="_blank" rel="noreferrer" className="text-sky-700 underline">ดูรูปบัตรประชาชน</a>
                    : 'ไม่ได้แนบบัตร'}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button size="sm" variant="success" loading={decide.isPending && decide.variables?.id === r.id && decide.variables.status === 'occupied'} onClick={() => decide.mutate({ id: r.id, status: 'occupied' })}>ยืนยันเป็นผู้เช่า</Button>
                  <Button size="sm" variant="outline" loading={decide.isPending && decide.variables?.id === r.id && decide.variables.status === 'available'} onClick={() => decide.mutate({ id: r.id, status: 'available' })}>ปฏิเสธการจอง</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
