'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Pencil, Trash2, Coins, AlertTriangle, Wallet, FileSpreadsheet, ChevronRight } from 'lucide-react';
import { Pagination } from '@/components/shared/pagination';
import { TableCard, Table, THead, Th, Td, Tr, TableMessage, Dash, CodeChip } from '@/components/shared/table';
import { useCanManage } from '../use-can-manage';
import { PageHeader, SearchInput, controlBase, btn, MobileList, EmptyState } from '../ui';
import { useVillages, useCustomersList, useSaveCustomer, useRemoveCustomer } from './use-customers';
import { StatusBadge, money } from './shared';
import { EditModal } from './edit-modal';
import { BulkRateModal } from './bulk-rate-modal';
import { ImportModal } from './import-modal';
import { CustomerDetail } from './customer-detail';
import type { Customer } from './types';

export default function PrapaCustomersPage() {
  const qc = useQueryClient();
  const canManage = useCanManage();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [villageNo, setVillageNo] = useState('');
  const [status, setStatus] = useState('');
  const [overdue, setOverdue] = useState('');
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [bulk, setBulk] = useState(false);
  const [importing, setImporting] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const { data: villages } = useVillages();
  const { data, isLoading } = useCustomersList({ page, search, villageNo, status, overdue });
  const save = useSaveCustomer(editing, () => setEditing(null));
  const remove = useRemoveCustomer();

  const rows: Customer[] = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, totalPages: 1 };
  const summary = data?.summary as { totalCustomers: number; overdueCount: number; totalOutstanding: number } | undefined;

  const filter = (fn: () => void) => { fn(); setPage(1); };
  const sel = `${controlBase} min-w-0 px-2.5 sm:px-3`;
  const askRemove = (r: Customer) => { if (confirm(`ลบ ${r.customerCode} ${r.fullName}?`)) remove.mutate(r.id); };

  return (
    <div className="space-y-4">
      <PageHeader icon={Users} iconClass="text-violet-500" title="ทะเบียนผู้ใช้น้ำ" desc="แตะรายชื่อเพื่อดูรายละเอียดและประวัติบิล"
        actions={canManage && <button onClick={() => setEditing({ customerCode: '', fullName: '' })} className={btn('primary')}><Plus className="h-4 w-4" /> เพิ่ม</button>} />

      {canManage && (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button onClick={() => setImporting(true)} className={btn('secondary')}><FileSpreadsheet className="h-4 w-4 text-emerald-500" /> นำเข้าข้อมูล</button>
          <button onClick={() => setBulk(true)} className={btn('secondary')}><Coins className="h-4 w-4 text-amber-500" /> ตั้งราคา/หน่วย</button>
        </div>
      )}

      {/* สรุปสถานะยอดค้าง — อิงตัวกรองหมู่/สถานะ/ค้นหาปัจจุบัน (ไม่รวมตัวกรองยอดค้างเอง จะได้เห็นบริบทเทียบทั้งหมด) */}
      {summary && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <p className="flex items-center gap-1 text-xs text-slate-400"><Users className="h-3.5 w-3.5 shrink-0" /> ทั้งหมด</p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-slate-800 sm:text-xl">{summary.totalCustomers.toLocaleString()}</p>
          </div>
          <button onClick={() => filter(() => setOverdue(overdue ? '' : '1'))}
            className={`rounded-2xl border p-3 text-left transition ${overdue ? 'border-amber-300 bg-amber-50' : 'border-amber-100 bg-amber-50/50 hover:bg-amber-50'}`}>
            <p className="flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> ค้างชำระ</p>
            <p className="mt-0.5 text-base font-bold tabular-nums text-amber-700 sm:text-xl">{summary.overdueCount.toLocaleString()} <span className="text-xs font-normal sm:text-sm">ราย</span></p>
          </button>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3">
            <p className="flex items-center gap-1 text-xs text-rose-700"><Wallet className="h-3.5 w-3.5 shrink-0" /> ยอดค้างรวม</p>
            <p className="mt-0.5 truncate text-base font-bold tabular-nums text-rose-700 sm:text-xl">{money(summary.totalOutstanding)}</p>
          </div>
        </div>
      )}

      {/* ค้นหา + ตัวกรอง */}
      <div className="space-y-2 lg:flex lg:items-center lg:gap-2 lg:space-y-0">
        <SearchInput value={search} onChange={(v) => filter(() => setSearch(v))} placeholder="ค้นหา ชื่อ / รหัส / เลขบัตร..." className="lg:flex-1" />
        <div className="grid grid-cols-3 gap-2 lg:flex">
          <select value={villageNo} onChange={(e) => filter(() => setVillageNo(e.target.value))} className={`${sel} lg:w-36`}>
            <option value="">ทุกหมู่</option>
            {villages?.map((v) => <option key={v.villageNo} value={v.villageNo}>หมู่ {v.villageNo} ({v.count})</option>)}
          </select>
          <select value={status} onChange={(e) => filter(() => setStatus(e.target.value))} className={`${sel} lg:w-44`}>
            <option value="">ทุกสถานะ</option>
            <option value="active">ใช้งาน</option>
            <option value="inactive">ยกเลิก (รวมมีหนี้ค้าง)</option>
          </select>
          <select value={overdue} onChange={(e) => filter(() => setOverdue(e.target.value))} className={`${sel} lg:w-44`}>
            <option value="">ยอดค้างทั้งหมด</option>
            <option value="0">ไม่ค้างชำระ</option>
            <option value="1">ค้าง 1 เดือน</option>
            <option value="2">ค้าง 2 เดือน</option>
            <option value="3plus">ค้าง 3 เดือนขึ้นไป</option>
          </select>
        </div>
      </div>
      <p className="text-sm text-slate-400">ทั้งหมด <b className="font-semibold text-slate-600">{Number(meta.total).toLocaleString()}</b> ราย</p>

      {/* มือถือ: รายการกระชับ แตะ → รายละเอียด */}
      <div className="space-y-3 sm:hidden">
        {isLoading ? <p className="py-10 text-center text-sm text-slate-400">กำลังโหลด...</p>
        : rows.length === 0 ? <EmptyState title="ไม่พบรายชื่อ" />
        : (
          <MobileList>
            {rows.map((r) => (
              <button key={r.id} onClick={() => setViewingId(r.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left active:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-slate-900"><span className="truncate">{r.fullName}</span>{r.usageStatus && r.usageStatus !== '01' && <span className="shrink-0"><StatusBadge s={r.usageStatus} /></span>}</p>
                  <p className="truncate text-xs text-slate-400"><span className="font-mono">{r.customerCode}</span>{r.villageNo ? ` · หมู่ ${r.villageNo}` : ''}{r.phone ? ` · ${r.phone}` : ''}</p>
                </div>
                {r.outstanding ? <span className="shrink-0 text-sm font-semibold tabular-nums text-rose-600">{money(r.outstanding)}</span> : null}
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </button>
            ))}
          </MobileList>
        )}
        <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} total={Number(meta.total)} pageSize={meta.limit || 20} unit="ราย" />
      </div>

      {/* จอใหญ่: ตารางกลาง */}
      <TableCard className="hidden sm:block">
        <Table>
          <THead>
            <Th>รหัส</Th><Th>ชื่อ-สกุล</Th><Th>หมู่</Th><Th>เลขบัตร</Th><Th>เบอร์โทร</Th>
            <Th align="right">ยอดค้าง</Th><Th>สถานะ</Th><Th />
          </THead>
          <tbody>
            {isLoading ? <TableMessage colSpan={8}>กำลังโหลด...</TableMessage>
            : rows.length === 0 ? <TableMessage colSpan={8}>ไม่พบรายชื่อ</TableMessage>
            : rows.map((r) => (
              <Tr key={r.id} onClick={() => setViewingId(r.id)}>
                <Td><CodeChip>{r.customerCode}</CodeChip></Td>
                <Td className="font-medium text-slate-900">{r.fullName}</Td>
                <Td className="text-slate-500">
                  {r.villageNo ? <span className="inline-flex whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">หมู่ {r.villageNo}</span> : <Dash />}
                </Td>
                <Td className="font-mono text-xs tracking-wide text-slate-500">{r.nationalId || <span className="font-sans"><Dash /></span>}</Td>
                <Td className="text-slate-500">{r.phone || <Dash />}</Td>
                <Td align="right" className="font-mono">{r.outstanding ? <span className="font-semibold text-rose-600">{money(r.outstanding)}</span> : <Dash />}</Td>
                <Td><StatusBadge s={r.usageStatus} /></Td>
                <Td onClick={(e) => e.stopPropagation()}>
                  {canManage && (
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(r)} aria-label="แก้ไข" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-sky-600"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => askRemove(r)} aria-label="ลบ" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>

        <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} total={Number(meta.total)} pageSize={meta.limit || 20} unit="ราย" />
      </TableCard>

      {viewingId && <CustomerDetail id={viewingId} onClose={() => setViewingId(null)} onEdit={canManage ? (c) => { setViewingId(null); setEditing(c); } : undefined} />}
      {editing && <EditModal editing={editing} setEditing={setEditing} save={save} />}
      {bulk && <BulkRateModal villages={villages || []} currentVillage={villageNo}
        onClose={() => setBulk(false)}
        onDone={() => { setBulk(false); qc.invalidateQueries({ queryKey: ['prapa-customers'] }); qc.invalidateQueries({ queryKey: ['prapa-customer'] }); }} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </div>
  );
}
