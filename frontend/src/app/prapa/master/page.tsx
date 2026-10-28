'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import { Database, Plus, Pencil, Trash2, Download } from 'lucide-react';
import { TableCard, Table, THead, Th, Td, Tr, TableMessage, CodeChip } from '@/components/shared/table';
import { PageHeader, FilterPills, Sheet, Field, inputCls, btn, MobileList, EmptyState } from '../ui';
import { useCanManage } from '../use-can-manage';

type MType = { key: string; label: string; valueLabel?: string; hint?: string };
const TYPES: MType[] = [
  { key: 'area', label: 'พื้นที่ / หมู่' },
  { key: 'route', label: 'เส้นทางจัดเก็บ' },
  { key: 'payment_channel', label: 'วิธีการชำระเงิน' },
  { key: 'discount', label: 'ผู้ได้รับสิทธิ (ส่วนลด)', valueLabel: 'ส่วนลด (บาท)' },
  { key: 'meter_size', label: 'ขนาดมิเตอร์', valueLabel: 'ค่าธรรมเนียม (บาท)' },
  { key: 'user_type', label: 'ประเภทผู้ใช้ (สูตรค่าน้ำ)', valueLabel: 'ราคา/หน่วย (บาท)' },
  { key: 'usage_status', label: 'สถานะการใช้งาน' },
];

type Row = { id: string; type: string; code?: string; name: string; value?: string | null; sortOrder?: number; active?: boolean };

export default function PrapaMasterPage() {
  const qc = useQueryClient();
  const canManage = useCanManage();
  const [type, setType] = useState('area');
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const cfg = TYPES.find((t) => t.key === type)!;

  const { data, isLoading } = useQuery({
    queryKey: ['water-master', type],
    queryFn: async () => (await api.get('/water/master', { params: { type } })).data.data as Row[],
  });
  const rows = data || [];

  const save = useMutation({
    mutationFn: () => {
      const body: any = { type, code: editing?.code?.trim() || undefined, name: editing?.name?.trim(),
        value: editing?.value != null && editing.value !== '' ? Number(editing.value) : undefined, sortOrder: editing?.sortOrder ?? 0 };
      return editing?.id ? api.put(`/water/master/${editing.id}`, body) : api.post('/water/master', body);
    },
    onSuccess: () => { toast.success('บันทึกแล้ว'); setEditing(null); qc.invalidateQueries({ queryKey: ['water-master', type] }); },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/water/master/${id}`),
    onSuccess: () => { toast.success('ลบแล้ว'); qc.invalidateQueries({ queryKey: ['water-master', type] }); },
    onError: (e) => toast.error(getErrorMessage(e, 'ลบไม่สำเร็จ')),
  });
  const seed = useMutation({
    mutationFn: () => api.post('/water/master/seed', null, { params: { type } }),
    onSuccess: (res) => { const a = res.data.data?.added ?? 0; toast.success(a ? `ดึงเพิ่ม ${a} รายการ` : 'ครบแล้ว ไม่มีรายการใหม่'); qc.invalidateQueries({ queryKey: ['water-master', type] }); },
    onError: (e) => toast.error(getErrorMessage(e, 'ดึงข้อมูลไม่สำเร็จ')),
  });
  const fmtValue = (v: Row['value']) => v != null ? Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2 }) : '—';
  const askRemove = (r: Row) => { if (confirm(`ลบ ${r.name}?`)) remove.mutate(r.id); };
  const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition';

  return (
    <div className="space-y-4">
      <PageHeader icon={Database} iconClass="text-slate-500" title="ข้อมูลพื้นฐาน" desc="ค่าที่ใช้เลือกในทะเบียนและการคิดค่าน้ำ" />

      <FilterPills items={TYPES.map((t) => ({ key: t.key, label: t.label }))} value={type} onChange={setType} />

      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-slate-500">{cfg.label} · {rows.length} รายการ</p>
        {canManage && (
          <div className="flex shrink-0 gap-2">
            <button onClick={() => seed.mutate()} disabled={seed.isPending} title="ดึงค่าที่มีอยู่จริงจากทะเบียนผู้ใช้น้ำมาเติม" className={btn('secondary')}>
              <Download className="h-4 w-4" /> <span className="hidden sm:inline">ดึงจากข้อมูลจริง</span><span className="sm:hidden">ดึงข้อมูล</span>
            </button>
            <button onClick={() => setEditing({ type })} className={btn('primary')}><Plus className="h-4 w-4" /> เพิ่ม</button>
          </div>
        )}
      </div>

      {/* มือถือ: รายการกระชับ */}
      <div className="sm:hidden">
        {isLoading ? <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
        : rows.length === 0 ? <EmptyState title="ยังไม่มีข้อมูล" />
        : (
          <MobileList>
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{r.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {r.code ? <span className="font-mono">{r.code}</span> : 'ไม่มีรหัส'}
                    {cfg.valueLabel && <> · {cfg.valueLabel} <span className="font-mono text-slate-600">{fmtValue(r.value)}</span></>}
                  </p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => setEditing(r)} aria-label="แก้ไข" className={`${iconBtn} active:bg-slate-100`}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => askRemove(r)} aria-label="ลบ" className={`${iconBtn} active:bg-rose-50 active:text-rose-500`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            ))}
          </MobileList>
        )}
      </div>

      {/* จอใหญ่: ตารางกลาง */}
      <TableCard className="hidden sm:block">
        <Table>
          <THead><Th>รหัส</Th><Th>ชื่อ</Th>{cfg.valueLabel && <Th align="right">{cfg.valueLabel}</Th>}<Th /></THead>
          <tbody>
            {isLoading ? <TableMessage colSpan={4}>กำลังโหลด...</TableMessage>
            : rows.length === 0 ? <TableMessage colSpan={4}>ยังไม่มีข้อมูล</TableMessage>
            : rows.map((r) => (
              <Tr key={r.id}>
                <Td>{r.code ? <CodeChip>{r.code}</CodeChip> : <span className="text-slate-300">—</span>}</Td>
                <Td className="text-slate-800">{r.name}</Td>
                {cfg.valueLabel && <Td align="right" className="font-mono text-slate-700">{fmtValue(r.value)}</Td>}
                <Td align="right">
                  {canManage && (
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(r)} aria-label="แก้ไข" className={`${iconBtn} hover:bg-slate-100 hover:text-sky-600`}><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => askRemove(r)} aria-label="ลบ" className={`${iconBtn} hover:bg-rose-50 hover:text-rose-500`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableCard>

      {editing && (
        <Sheet title={`${editing.id ? 'แก้ไข' : 'เพิ่ม'} · ${cfg.label}`} onClose={() => setEditing(null)}
          footer={
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className={btn('secondary')}>ยกเลิก</button>
              <button onClick={() => save.mutate()} disabled={save.isPending || !editing.name?.trim()} className={`${btn('primary')} flex-1`}>บันทึก</button>
            </div>
          }>
          <div className="space-y-3">
            <Field label="รหัส (ถ้ามี)"><input value={editing.code || ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })} className={inputCls} /></Field>
            <Field label="ชื่อ"><input value={editing.name || ''} autoFocus onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputCls} /></Field>
            {cfg.valueLabel && (
              <Field label={cfg.valueLabel}><input type="number" inputMode="decimal" step="0.01" value={(editing.value as any) ?? ''} onChange={(e) => setEditing({ ...editing, value: e.target.value })} className={inputCls} /></Field>
            )}
          </div>
        </Sheet>
      )}
    </div>
  );
}
