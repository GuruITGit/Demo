'use client';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { PeoplePicker } from '@/components/shared/people-picker';
import { cn } from '@/lib/utils';

/** ผู้รับการส่งต่อสารบรรณ — คน (หัวหน้ากอง/ใครก็ได้) หรือ ปลัด */
export type Recipient =
  | { kind: 'person'; userId: string; name: string; deptName?: string | null }
  | { kind: 'clerk' }
  | null;

interface TreeUser { id: string; fullNameTh: string; titleTh?: string; positionName?: string }
interface TreeDept { id: string; nameTh: string; users: TreeUser[]; divisions: { users: TreeUser[] }[] }
interface TreeGroup { departments: TreeDept[] }

const nameOf = (u?: TreeUser | null) => (u ? `${u.titleTh || ''}${u.fullNameTh}`.trim() : '');

/**
 * เลือกผู้รับสารบรรณ (ไดนามิก) — เลือกกอง → ได้หัวหน้ากองอัตโนมัติ (เปลี่ยนเป็นใครก็ได้ด้วยการค้นชื่อ)
 * หรือกด "ส่งปลัด" · ไม่มีตัวเลือกนายก (ส่งนายกได้เฉพาะปลัด)
 */
export function RecipientPicker({ value, onChange, excludeUserId }: {
  value: Recipient;
  onChange: (r: Recipient) => void;
  /** ตัดตัวเองออก (ส่งต่อให้ตัวเองไม่ได้) */
  excludeUserId?: string;
}) {
  const orgId = useAuthStore((s) => s.user?.organizationId);
  const { data: tree = [] } = useQuery({
    queryKey: ['org-tree'],
    queryFn: async () => (await api.get('/users/tree')).data.data as TreeGroup[],
  });
  const { data: depts = [] } = useQuery({
    queryKey: ['departments', orgId],
    queryFn: async () => (await api.get(`/organizations/${orgId}/departments`)).data.data as { id: string; nameTh: string; headUserId?: string | null }[],
    enabled: !!orgId,
  });

  // user → (ข้อมูลคน, ชื่อกอง) จากผังองค์กร
  const userIndex = React.useMemo(() => {
    const m = new Map<string, { user: TreeUser; deptId: string; deptName: string }>();
    for (const g of tree) for (const d of g.departments) {
      for (const u of d.users) m.set(u.id, { user: u, deptId: d.id, deptName: d.nameTh });
      for (const v of d.divisions) for (const u of v.users) m.set(u.id, { user: u, deptId: d.id, deptName: d.nameTh });
    }
    return m;
  }, [tree]);

  const [mode, setMode] = React.useState<'person' | 'clerk'>(value?.kind === 'clerk' ? 'clerk' : 'person');
  const [deptId, setDeptId] = React.useState('');
  const [noHead, setNoHead] = React.useState(false);

  const pickPerson = (userId: string) => {
    if (!userId) { onChange(null); return; }
    const info = userIndex.get(userId);
    onChange({ kind: 'person', userId, name: info ? nameOf(info.user) : '', deptName: info?.deptName ?? null });
  };

  const onDept = (id: string) => {
    setDeptId(id);
    const head = depts.find((d) => d.id === id)?.headUserId;
    if (head && head !== excludeUserId) { setNoHead(false); pickPerson(head); } else { setNoHead(!!id); onChange(null); }
  };

  const tab = (on: boolean) => cn('flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    on ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800');

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button type="button" className={tab(mode === 'person')} onClick={() => { setMode('person'); if (value?.kind === 'clerk') onChange(null); }}>
          <Building2 className="h-4 w-4" />กอง / บุคคล
        </button>
        <button type="button" className={tab(mode === 'clerk')} onClick={() => { setMode('clerk'); onChange({ kind: 'clerk' }); }}>
          <ShieldCheck className="h-4 w-4" />ส่งปลัด
        </button>
      </div>

      {mode === 'clerk' ? (
        <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm text-violet-800">
          ส่งถึงปลัด (ปลัดทุกคนได้รับแจ้งเตือน) — ปลัดเป็นผู้ส่งต่อนายกในขั้นสุดท้าย
        </p>
      ) : (
        <>
          <div>
            <label className="text-xs font-medium text-gray-600">กอง</label>
            <select value={deptId} onChange={(e) => onDept(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">เลือกกอง (ได้หัวหน้ากองอัตโนมัติ)...</option>
              {depts.map((d) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
            </select>
            {noHead && <p className="mt-1 text-xs text-amber-700">กองนี้ยังไม่ได้ตั้งหัวหน้ากอง — เลือกผู้รับด้านล่างเอง</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">ผู้รับ (ค้นชื่อเปลี่ยนเป็นคนอื่นได้ เช่น รักษาราชการแทน / ธุรการ)</label>
            <div className="mt-1">
              <PeoplePicker value={value?.kind === 'person' ? value.userId : ''} placeholder="ค้นหาชื่อผู้รับ..."
                onChange={(uid) => { if (uid && uid === excludeUserId) return; pickPerson(uid); }} />
            </div>
          </div>
          {value?.kind === 'person' && (
            <p className="flex items-center gap-1.5 text-sm text-gray-700">
              <UserRound className="h-4 w-4 text-blue-600" />ส่งถึง <b className="font-semibold">{value.name}</b>
              {value.deptName && <span className="text-gray-500">· {value.deptName}</span>}
            </p>
          )}
        </>
      )}
    </div>
  );
}
