'use client';
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Empty, Panel } from '@/components/pay/pay-ui';

type Reservation = {
  id: string; stallCode: string; zone: string; tenantName: string | null; contactPhone: string | null;
  reservedAt: string | null; reserveStartDate: string | null; reserveDays: number | null; reserveCardUrl: string | null;
};

const thDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

/** เช็คการจองแผง: ดูว่าใครจองแผงไหน (วันเริ่มเช่า/จำนวนวัน/รูปบัตร) และแจ้งเตือนผู้จัดการตลาดให้ไปยืนยัน */
export function ReservationCheck({ canManage }: { canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: rows = [] } = useQuery<Reservation[]>({
    queryKey: ['market', 'reservations'],
    queryFn: async () => (await api.get('/market/reservations')).data.data,
    enabled: open,
    refetchInterval: open ? 5_000 : false,
  });
  const notify = useMutation({
    mutationFn: async () => (await api.post('/market/reservations/notify')).data.data,
    onSuccess: (d) => toast.success(`แจ้งเตือนผู้จัดการตลาดแล้ว · ${d?.count ?? rows.length} แผงรอยืนยัน`),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <Panel
      title={<>เช็คการจองแผง {open && <span className="text-sm font-normal text-gray-500">({rows.length})</span>}</>}
      actions={<Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>{open ? 'ซ่อนรายการ' : 'เช็คการจอง'}</Button>}
    >
      {open && (rows.length === 0 ? (
        <Empty>ยังไม่มีการจองที่รอยืนยัน</Empty>
      ) : (
        <>
          <ul>
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-4 py-3 first:border-t-0">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">แผง {r.stallCode} <span className="font-normal text-gray-500">· {r.tenantName || '—'}</span></p>
                  <p className="text-sm text-gray-500">
                    โทร {r.contactPhone || '—'}
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
              </li>
            ))}
          </ul>
          {canManage && (
            <div className="border-t border-gray-100 px-4 py-3 text-right">
              <Button size="sm" loading={notify.isPending} onClick={() => notify.mutate()}>แจ้งเตือนผู้จัดการตลาดให้ยืนยัน</Button>
            </div>
          )}
        </>
      ))}
    </Panel>
  );
}
