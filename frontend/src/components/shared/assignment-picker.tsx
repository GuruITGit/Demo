'use client';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ChevronRight, ChevronDown, User as UserIcon } from 'lucide-react';

interface PickUser { id: string; fullNameTh: string; titleTh?: string; positionName?: string }
interface Division { id: string; nameTh: string; users: PickUser[] }
interface TreeDept { id: string; nameTh: string; users: PickUser[]; divisions: Division[] }
interface Group { group: string; departments: TreeDept[] }

const displayName = (u: PickUser) => `${u.titleTh || ''}${u.fullNameTh}`.trim();

/**
 * มอบหมายกอง + ผู้รับผิดชอบในกอง (tree view)
 * — ติ๊กเลือกกอง → กอง "กางออก" แสดงเฉพาะคนในกองนั้น → ติ๊กเลือกได้หลายคน
 * value = { [deptId]: userId[] }  (กองที่ถูกเลือก = key ที่มีอยู่; userId[] = คนในกองนั้น)
 */
export function AssignmentPicker({
  departments,
  value,
  onChange,
}: {
  departments: { id: string; nameTh: string }[];
  value: Record<string, string[]>;
  onChange: (v: Record<string, string[]>) => void;
}) {
  const { data: tree = [] } = useQuery({
    queryKey: ['org-tree'],
    queryFn: async () => (await api.get('/users/tree')).data.data as Group[],
  });

  // deptId -> รายชื่อคนในกอง (รวมคนในงาน/ฝ่ายย่อย)
  const usersByDept = React.useMemo(() => {
    const m = new Map<string, PickUser[]>();
    for (const g of tree) for (const d of g.departments) {
      m.set(d.id, [...d.users, ...d.divisions.flatMap((v) => v.users)]);
    }
    return m;
  }, [tree]);

  const toggleDept = (deptId: string) => {
    const next = { ...value };
    if (deptId in next) delete next[deptId];
    else next[deptId] = [];
    onChange(next);
  };
  const togglePerson = (deptId: string, userId: string) => {
    const cur = value[deptId] || [];
    const next = { ...value, [deptId]: cur.includes(userId) ? cur.filter((x) => x !== userId) : [...cur, userId] };
    onChange(next);
  };
  const selectAllInDept = (deptId: string, on: boolean) => {
    const all = (usersByDept.get(deptId) || []).map((u) => u.id);
    onChange({ ...value, [deptId]: on ? all : [] });
  };

  return (
    <div className="space-y-2">
      {departments.map((d) => {
        const selected = d.id in value;
        const people = usersByDept.get(d.id) || [];
        const picked = value[d.id] || [];
        const allOn = people.length > 0 && people.every((u) => picked.includes(u.id));
        return (
          <div key={d.id} className={`rounded-lg border ${selected ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200'}`}>
            <div className="flex items-center gap-2 px-3 py-2">
              <label className="flex flex-1 items-center gap-2 cursor-pointer">
                <input type="checkbox" className="h-4 w-4" checked={selected} onChange={() => toggleDept(d.id)} />
                <span className="text-sm font-medium text-gray-800">{d.nameTh}</span>
                {selected && picked.length > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">{picked.length} คน</span>}
              </label>
              {selected && people.length > 0 && (
                <button type="button" onClick={() => selectAllInDept(d.id, !allOn)} className="shrink-0 rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-xs text-blue-700 hover:bg-blue-50">
                  {allOn ? 'ล้างทั้งกอง' : 'เลือกทั้งกอง'}
                </button>
              )}
            </div>
            {selected && (
              <div className="border-t border-blue-100 px-3 py-2">
                {people.length === 0 ? (
                  <p className="text-xs text-gray-400">ยังไม่มีบุคลากรในกองนี้ (มอบหมายเป็นกองได้)</p>
                ) : (
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {people.map((u) => (
                      <label key={u.id} className={`flex items-start gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer ${picked.includes(u.id) ? 'bg-blue-100 text-blue-800' : 'hover:bg-gray-50 text-gray-700'}`}>
                        <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 shrink-0" checked={picked.includes(u.id)} onChange={() => togglePerson(d.id, u.id)} />
                        <UserIcon className="mt-0.5 h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="min-w-0 flex-1">
                          <span className="block leading-tight">{displayName(u)}</span>
                          {u.positionName && <span className="block text-xs leading-tight text-gray-400">{u.positionName}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {departments.length === 0 && <p className="text-sm text-gray-400">ไม่มีกองให้เลือก</p>}
    </div>
  );
}
