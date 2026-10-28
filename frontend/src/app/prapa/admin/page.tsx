'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/water-api';
import { toast } from '@/hooks/use-toast';
import { UserCog, Plus, Pencil, Trash2, KeyRound, Check } from 'lucide-react';
import { TableCard, Table, THead, Th, Td, Tr, TableMessage, CodeChip, StatusPill } from '@/components/shared/table';
import { PageHeader, Sheet, Field, inputCls, btn, MobileList, EmptyState } from '../ui';
import { useWaterAuthStore } from '@/stores/water-auth.store';
import { LegacySyncCard } from './legacy-sync-card';

type WUser = { id: string; username: string; fullName: string; phone?: string; role: string; caps: string[]; active: boolean; lastLoginAt?: string };

const CAPS: { key: string; label: string }[] = [
  { key: 'reading', label: 'จดมิเตอร์ / เก็บค่าน้ำ' },
  { key: 'payment', label: 'รับชำระเงิน' },
  { key: 'slips', label: 'ตรวจสลิปโอน' },
  { key: 'notices', label: 'หนังสือแจ้งค้างชำระ' },
  { key: 'reports', label: 'รายงาน / สรุป' },
  { key: 'customers', label: 'ทะเบียนผู้ใช้น้ำ' },
  { key: 'settings', label: 'ตั้งค่าระบบ' },
  { key: 'users', label: 'จัดการผู้ใช้ (แอดมิน)' },
];
const ROLES: { key: string; label: string; caps: string[] }[] = [
  { key: 'admin', label: 'แอดมิน (ทุกสิทธิ์)', caps: CAPS.map((c) => c.key) },
  { key: 'reader', label: 'เจ้าหน้าที่จด (จด+เก็บภาคสนาม)', caps: ['reading', 'payment'] },
  { key: 'cashier', label: 'เก็บเงินสำนักงาน', caps: ['payment', 'slips', 'notices', 'reports', 'customers'] },
  { key: 'viewer', label: 'ดูรายงานอย่างเดียว', caps: ['reports'] },
];
const roleLabel = (r: string) => ROLES.find((x) => x.key === r)?.label || r;

export default function PrapaAdminPage() {
  const qc = useQueryClient();
  const isAdmin = useWaterAuthStore((s) => s.user?.role === 'admin');
  const [editing, setEditing] = useState<Partial<WUser> & { password?: string } | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['water-users'],
    queryFn: async () => (await api.get('/water/users')).data.data as WUser[],
  });

  const save = useMutation({
    mutationFn: () => {
      const e = editing!;
      const body: any = { fullName: e.fullName, phone: e.phone, role: e.role, caps: e.caps, active: e.active };
      if (e.password) body.password = e.password;
      if (!e.id) body.username = e.username;
      return e.id ? api.put(`/water/users/${e.id}`, body) : api.post('/water/users', body);
    },
    onSuccess: () => { toast.success('บันทึกแล้ว'); setEditing(null); qc.invalidateQueries({ queryKey: ['water-users'] }); },
    onError: (err) => toast.error(getErrorMessage(err, 'บันทึกไม่สำเร็จ')),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/water/users/${id}`),
    onSuccess: () => { toast.success('ลบแล้ว'); qc.invalidateQueries({ queryKey: ['water-users'] }); },
    onError: (err) => toast.error(getErrorMessage(err, 'ลบไม่สำเร็จ')),
  });

  const openNew = () => setEditing({ role: 'reader', caps: ['reading', 'payment'], active: true });
  const setRole = (role: string) => setEditing((e) => ({ ...e!, role, caps: ROLES.find((r) => r.key === role)?.caps || e!.caps }));
  const toggleCap = (cap: string) => setEditing((e) => {
    const caps = new Set(e!.caps || []);
    if (caps.has(cap)) caps.delete(cap); else caps.add(cap);
    return { ...e!, caps: [...caps] };
  });

  const capsText = (u: WUser) => (u.role === 'admin' ? 'ทุกสิทธิ์' : `${(u.caps || []).length} โมดูล`);
  const askRemove = (u: WUser) => { if (confirm(`ลบผู้ใช้ ${u.username}?`)) remove.mutate(u.id); };
  const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition';
  const activePill = (u: WUser) => <StatusPill tone={u.active ? 'emerald' : 'slate'}>{u.active ? 'ใช้งาน' : 'ระงับ'}</StatusPill>;
  const canSave = !save.isPending && !!editing?.fullName?.trim() && (!!editing?.id || (!!editing?.username?.trim() && !!editing?.password));

  return (
    <div className="space-y-4">
      <PageHeader icon={UserCog} iconClass="text-slate-500" title="จัดการผู้ใช้ / สิทธิ์" desc="บัญชีประปาแยกจากสารบรรณ · เลือกบทบาทแล้วปรับสิทธิ์รายคนได้"
        actions={<button onClick={openNew} className={btn('primary')}><Plus className="h-4 w-4" /> <span className="hidden sm:inline">เพิ่มผู้ใช้</span><span className="sm:hidden">เพิ่ม</span></button>} />

      {/* มือถือ: รายการกระชับ */}
      <div className="sm:hidden">
        {isLoading ? <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
        : (users || []).length === 0 ? <EmptyState title="ยังไม่มีผู้ใช้" desc='กด "เพิ่ม" เพื่อสร้างบัญชี' />
        : (
          <MobileList>
            {users!.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-900"><span className="truncate">{u.fullName}</span> {activePill(u)}</p>
                  <p className="truncate text-xs text-slate-400"><span className="font-mono">{u.username}</span> · {roleLabel(u.role)} · {capsText(u)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setEditing({ ...u, password: '' })} aria-label="แก้ไข" className={`${iconBtn} active:bg-slate-100`}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => askRemove(u)} aria-label="ลบ" className={`${iconBtn} active:bg-rose-50 active:text-rose-500`}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </MobileList>
        )}
      </div>

      {/* จอใหญ่: ตารางกลาง */}
      <TableCard className="hidden sm:block">
        <Table>
          <THead><Th>ชื่อผู้ใช้</Th><Th>ชื่อ-สกุล</Th><Th>บทบาท</Th><Th>สิทธิ์</Th><Th align="center">สถานะ</Th><Th /></THead>
          <tbody>
            {isLoading ? <TableMessage colSpan={6}>กำลังโหลด...</TableMessage>
            : (users || []).length === 0 ? <TableMessage colSpan={6}>ยังไม่มีผู้ใช้ (กด &quot;เพิ่มผู้ใช้&quot;)</TableMessage>
            : users!.map((u) => (
              <Tr key={u.id}>
                <Td><CodeChip>{u.username}</CodeChip></Td>
                <Td className="text-slate-800">{u.fullName}</Td>
                <Td className="text-slate-600">{roleLabel(u.role)}</Td>
                <Td className="text-xs text-slate-400">{capsText(u)}</Td>
                <Td align="center">{activePill(u)}</Td>
                <Td align="right">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => setEditing({ ...u, password: '' })} aria-label="แก้ไข" className={`${iconBtn} hover:bg-slate-100 hover:text-sky-600`}><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => askRemove(u)} aria-label="ลบ" className={`${iconBtn} hover:bg-rose-50 hover:text-rose-500`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableCard>

      {isAdmin && <LegacySyncCard />}

      {editing && (
        <Sheet title={editing.id ? `แก้ไข ${editing.username}` : 'เพิ่มผู้ใช้'} onClose={() => setEditing(null)}
          footer={
            <div className="flex gap-2">
              <button onClick={() => setEditing(null)} className={btn('secondary')}>ยกเลิก</button>
              <button onClick={() => save.mutate()} disabled={!canSave} className={`${btn('primary')} flex-1`}>บันทึก</button>
            </div>
          }>
          <div className="space-y-3">
            {!editing.id && (
              <Field label="ชื่อผู้ใช้ (สำหรับล็อกอิน)">
                <input value={editing.username || ''} autoFocus autoCapitalize="none" onChange={(e) => setEditing({ ...editing, username: e.target.value })} className={`${inputCls} font-mono`} placeholder="เช่น somchai" />
              </Field>
            )}
            <Field label="ชื่อ-สกุล"><input value={editing.fullName || ''} onChange={(e) => setEditing({ ...editing, fullName: e.target.value })} className={inputCls} placeholder="นายสมชาย ใจดี" /></Field>
            <Field label="เบอร์โทร (ถ้ามี)"><input value={editing.phone || ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className={inputCls} inputMode="tel" /></Field>
            <Field label={<span className="flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> รหัสผ่าน {editing.id && '(เว้นว่าง = ไม่เปลี่ยน)'}</span>}>
              <input type="text" autoCapitalize="none" value={editing.password || ''} onChange={(e) => setEditing({ ...editing, password: e.target.value })} className={inputCls} placeholder={editing.id ? 'ตั้งรหัสใหม่...' : 'อย่างน้อย 6 ตัว'} />
            </Field>
            <Field label="บทบาท (ตั้งสิทธิ์เริ่มต้น)">
              <select value={editing.role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
                {ROLES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </select>
            </Field>

            <div>
              <span className="mb-1.5 block text-xs font-medium text-slate-500">สิทธิ์เข้าถึงแต่ละโมดูล (ปรับเองได้)</span>
              <div className="grid grid-cols-2 gap-2">
                {CAPS.map((c) => {
                  const on = editing.role === 'admin' || (editing.caps || []).includes(c.key);
                  return (
                    <button key={c.key} type="button" disabled={editing.role === 'admin'} onClick={() => toggleCap(c.key)}
                      className={`flex min-h-11 items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-xs transition ${on ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500'} ${editing.role === 'admin' ? 'opacity-70' : ''}`}>
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300'}`}>{on && <Check className="h-3 w-3" />}</span>
                      {c.label}
                    </button>
                  );
                })}
              </div>
              {editing.role === 'admin' && <p className="mt-1 text-[11px] text-slate-400">แอดมินมีทุกสิทธิ์เสมอ</p>}
            </div>

            <label className="flex items-center gap-2.5 py-1 text-sm text-slate-600">
              <input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="h-5 w-5 accent-sky-600" /> เปิดใช้งานบัญชี
            </label>
          </div>
        </Sheet>
      )}
    </div>
  );
}
