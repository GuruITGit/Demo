'use client';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ChevronRight, ChevronDown, Search, X, User as UserIcon, Check } from 'lucide-react';

interface PickUser {
  id: string;
  fullNameTh: string;
  titleTh?: string;
  positionName?: string;
}
interface Division { id: string; nameTh: string; users: PickUser[] }
interface Department { id: string; nameTh: string; deptType: string; divisions: Division[]; users: PickUser[] }
interface Group { group: string; departments: Department[] }

const displayName = (u?: PickUser | null) => u ? `${u.titleTh || ''}${u.fullNameTh}`.trim() : '';

/**
 * People Picker — เลือกบุคลากรผ่าน popup แบบ Tree/Accordion (ฝ่าย → กอง → งาน → คน)
 * พร้อมช่องค้นหาด่วน ใช้ได้ทุกที่ที่ต้องเลือกบุคลากร
 */
export function PeoplePicker({
  value,
  onChange,
  label,
  placeholder = 'เลือกบุคลากร...',
  allowClear = true,
  onPickDepartment,
}: {
  value?: string;
  onChange: (userId: string, user?: PickUser) => void;
  label?: string;
  placeholder?: string;
  allowClear?: boolean;
  /** ถ้าส่งมา จะมีปุ่ม "ทั้งกอง" ที่หัวข้อแต่ละกอง เพื่อเพิ่มสมาชิกทั้งกองในคลิกเดียว */
  onPickDepartment?: (deptId: string, users: PickUser[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const { data: tree = [], isLoading } = useQuery({
    queryKey: ['org-tree'],
    queryFn: async () => (await api.get('/users/tree')).data.data as Group[],
  });

  // หา user ที่เลือกไว้ (เพื่อแสดงชื่อ)
  const allUsers = React.useMemo(() => {
    const out: PickUser[] = [];
    for (const g of tree) for (const d of g.departments) {
      out.push(...d.users);
      for (const v of d.divisions) out.push(...v.users);
    }
    return out;
  }, [tree]);
  const selected = allUsers.find((u) => u.id === value);

  const toggle = (k: string) => setExpanded((p) => ({ ...p, [k]: !p[k] }));
  const matches = (u: PickUser) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return `${u.fullNameTh} ${u.positionName || ''}`.toLowerCase().includes(q);
  };

  const pick = (u: PickUser) => { onChange(u.id, u); setOpen(false); setSearch(''); };

  const UserRow = ({ u }: { u: PickUser }) => (
    <button
      type="button"
      onClick={() => pick(u)}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-blue-50 ${value === u.id ? 'bg-blue-100' : ''}`}
    >
      <UserIcon className="h-3.5 w-3.5 text-gray-400 shrink-0" />
      <span className="flex-1 truncate">{displayName(u)} <span className="text-gray-400">— {u.positionName}</span></span>
      {value === u.id && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
    </button>
  );

  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex-1 flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-sm text-left hover:border-blue-400"
        >
          <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
            {selected ? `${displayName(selected)} — ${selected.positionName}` : placeholder}
          </span>
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
        </button>
        {allowClear && value && (
          <button type="button" onClick={() => onChange('', undefined)} className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" title="ล้าง">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold text-gray-800">เลือกบุคลากร</h3>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="พิมพ์ชื่อ หรือ ตำแหน่ง เพื่อค้นหาด่วน..."
                  className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {isLoading ? (
                <p className="p-4 text-center text-sm text-gray-400">กำลังโหลด...</p>
              ) : tree.map((g) => {
                // กรองตามคำค้น: แสดงกลุ่ม/กอง/งานที่มีคนตรงเงื่อนไข
                const deptsToShow = g.departments.filter((d) =>
                  d.users.some(matches) || d.divisions.some((v) => v.users.some(matches)));
                if (!deptsToShow.length) return null;
                return (
                  <div key={g.group} className="mb-1">
                    <div className="px-2 py-1 text-xs font-bold text-gray-500 uppercase tracking-wide">{g.group}</div>
                    {deptsToShow.map((d) => {
                      const dk = `d-${d.id}`;
                      const open = search.trim() ? true : expanded[dk];
                      const deptUsers = [...d.users, ...d.divisions.flatMap((v) => v.users)];
                      return (
                        <div key={d.id} className="ml-1">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => toggle(dk)} className="flex flex-1 items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              <span className="text-blue-600">[กอง]</span> {d.nameTh}
                            </button>
                            {onPickDepartment && deptUsers.length > 0 && (
                              <button
                                type="button"
                                onClick={() => { onPickDepartment(d.id, deptUsers); setOpen(false); setSearch(''); }}
                                className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                                title={`เพิ่มทั้งกอง (${deptUsers.length} คน)`}
                              >
                                + ทั้งกอง
                              </button>
                            )}
                          </div>
                          {open && (
                            <div className="ml-5 border-l border-gray-100 pl-2">
                              {d.users.filter(matches).map((u) => <UserRow key={u.id} u={u} />)}
                              {d.divisions.filter((v) => v.users.some(matches)).map((v) => {
                                const vk = `v-${v.id}`;
                                const vopen = search.trim() ? true : expanded[vk];
                                return (
                                  <div key={v.id}>
                                    <button type="button" onClick={() => toggle(vk)} className="flex w-full items-center gap-1 rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-50">
                                      {vopen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                      <span className="text-gray-400">[งาน]</span> {v.nameTh}
                                    </button>
                                    {vopen && <div className="ml-5">{v.users.filter(matches).map((u) => <UserRow key={u.id} u={u} />)}</div>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
