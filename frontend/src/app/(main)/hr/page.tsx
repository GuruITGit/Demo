'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import Link from 'next/link';
import {
  Building2, Wallet, Wrench, GraduationCap, HeartPulse, HandHeart, Crown, Shield, Users,
  ChevronRight, Home, User as UserIcon, UserCog, Scale, Calculator, Briefcase,
} from 'lucide-react';

interface PUser { id: string; fullNameTh: string; titleTh?: string; positionName?: string; avatarUrl?: string; status?: string }
interface Division { id: string; nameTh: string; users: PUser[] }
interface Department { id: string; code: string; nameTh: string; deptType: string; divisions: Division[]; users: PUser[] }
interface Group { group: string; departments: Department[] }

// icon ตามกอง (ไม่ใช้ icon โฟลเดอร์)
const DEPT_ICON: Record<string, any> = {
  EXEC: Crown, MGMT: Shield, COUNCIL: Users, ADMIN: Building2,
  FINANCE: Wallet, ENGINEERING: Wrench, EDUCATION: GraduationCap, HEALTH: HeartPulse, WELFARE: HandHeart,
};
// icon ตามตำแหน่ง (จับจากคำในชื่อตำแหน่ง)
function positionIcon(pos = ''): any {
  if (/นายก/.test(pos)) return Crown;
  if (/ปลัด/.test(pos)) return Shield;
  if (/ประธานสภา|สมาชิกสภา|สภา/.test(pos)) return Users;
  if (/ผู้อำนวยการ|หัวหน้า/.test(pos)) return UserCog;
  if (/ช่าง|วิศวกร|โยธา|ประปา/.test(pos)) return Wrench;
  if (/การเงิน|บัญชี|จัดเก็บ|คลัง/.test(pos)) return Calculator;
  if (/พัสดุ/.test(pos)) return Briefcase;
  if (/นิติ|กฎหมาย/.test(pos)) return Scale;
  if (/สาธารณสุข|อนามัย|พยาบาล/.test(pos)) return HeartPulse;
  if (/ครู|ศึกษา/.test(pos)) return GraduationCap;
  if (/พัฒนาชุมชน|สวัสดิการ|สังคม/.test(pos)) return HandHeart;
  return UserIcon;
}

const STATUS_STYLE: Record<string, string> = {
  'มา': 'bg-green-100 text-green-700 border-green-300',
  'ลา': 'bg-orange-100 text-orange-700 border-orange-300',
  'ประชุม': 'bg-blue-100 text-blue-700 border-blue-300',
};

export default function StaffDirectoryPage() {
  const [deptId, setDeptId] = useState<string | null>(null);
  const [divId, setDivId] = useState<string | null>(null);

  const { data: tree = [], isLoading } = useQuery({
    queryKey: ['staff-directory'],
    queryFn: async () => (await api.get('/users/directory')).data.data as Group[],
  });

  const { data: away } = useQuery({
    queryKey: ['staff-away'],
    queryFn: async () => (await api.get('/users/away/today')).data.data as { leaveToday: any[]; meetingToday: any[]; upcomingLeave: any[] },
  });

  const allDepts = tree.flatMap((g) => g.departments);
  const curDept = allDepts.find((d) => d.id === deptId);
  const curDiv = curDept?.divisions.find((v) => v.id === divId);

  const Person = ({ u }: { u: PUser }) => {
    const Icon = positionIcon(u.positionName);
    return (
      <Link href={`/hr/${u.id}`} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:border-blue-400 hover:shadow-sm transition">
        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 overflow-hidden">
          {u.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={u.avatarUrl} alt={u.fullNameTh} className="w-full h-full object-cover" />
            : <Icon className="h-6 w-6 text-blue-600" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800 truncate">{u.titleTh}{u.fullNameTh}</p>
          <p className="text-xs text-gray-500 truncate">{u.positionName || '-'}</p>
        </div>
        {u.status && <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[u.status] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>{u.status}</span>}
      </Link>
    );
  };

  const Folder = ({ icon: Icon, title, subtitle, onClick }: { icon: any; title: string; subtitle?: string; onClick: () => void }) => (
    <button onClick={onClick} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-400 hover:shadow-sm transition text-left">
      <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
        <Icon className="h-6 w-6 text-indigo-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <Header title="บุคลากร" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* ปฏิทินบุคลากร — วันนี้ใครไม่อยู่ + ลาที่บันทึกไว้ล่วงหน้า */}
        {away && (away.leaveToday?.length > 0 || away.meetingToday?.length > 0 || away.upcomingLeave?.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-semibold text-orange-800 mb-2">🌴 ลาวันนี้ ({away.leaveToday?.length ?? 0})</p>
              {!away.leaveToday?.length ? <p className="text-xs text-gray-400">ไม่มี</p> : (
                <ul className="space-y-1 text-sm text-gray-700">
                  {away.leaveToday.map((l: any, i: number) => <li key={i}>{l.title}{l.firstName} {l.lastName} <span className="text-gray-400">— {l.type}</span></li>)}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-800 mb-2">📅 ประชุมวันนี้ ({away.meetingToday?.length ?? 0})</p>
              {!away.meetingToday?.length ? <p className="text-xs text-gray-400">ไม่มี</p> : (
                <ul className="space-y-1 text-sm text-gray-700">
                  {away.meetingToday.map((m: any, i: number) => <li key={i}>{m.title} <span className="text-gray-400">— {new Date(m.startDatetime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</span></li>)}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-800 mb-2">🔜 ลาเร็วๆ นี้ ({away.upcomingLeave?.length ?? 0})</p>
              {!away.upcomingLeave?.length ? <p className="text-xs text-gray-400">ไม่มี</p> : (
                <ul className="space-y-1 text-sm text-gray-700">
                  {away.upcomingLeave.map((l: any, i: number) => (
                    <li key={i}>{l.title}{l.firstName} {l.lastName} <span className="text-gray-400">— {l.type} ({new Date(l.startDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})</span></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* breadcrumb */}
        <div className="flex items-center gap-1 text-sm text-gray-500 flex-wrap">
          <button onClick={() => { setDeptId(null); setDivId(null); }} className="flex items-center gap-1 hover:text-blue-600"><Home className="h-4 w-4" />บุคลากรทั้งหมด</button>
          {curDept && <><ChevronRight className="h-3.5 w-3.5" /><button onClick={() => setDivId(null)} className="hover:text-blue-600">{curDept.nameTh}</button></>}
          {curDiv && <><ChevronRight className="h-3.5 w-3.5" /><span className="text-gray-800 font-medium">{curDiv.nameTh}</span></>}
        </div>

        {isLoading ? (
          <p className="text-gray-400">กำลังโหลด...</p>
        ) : !curDept ? (
          [...tree].sort((a, b) => Number(!a.group || /อื่น/.test(a.group)) - Number(!b.group || /อื่น/.test(b.group))).map((g) => (
            <div key={g.group}>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{g.group}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {g.departments.map((d) => {
                  const count = d.users.length + d.divisions.reduce((s, v) => s + v.users.length, 0);
                  return <Folder key={d.id} icon={DEPT_ICON[d.code] || Building2} title={d.nameTh} subtitle={`${count} คน`} onClick={() => { setDeptId(d.id); setDivId(null); }} />;
                })}
              </div>
            </div>
          ))
        ) : !curDiv ? (
          <div className="space-y-5">
            {curDept.divisions.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {curDept.divisions.map((v) => <Folder key={v.id} icon={Briefcase} title={v.nameTh} subtitle={`${v.users.length} คน`} onClick={() => setDivId(v.id)} />)}
              </div>
            )}
            {curDept.users.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {curDept.users.map((u) => <Person key={u.id} u={u} />)}
              </div>
            )}
            {curDept.divisions.length === 0 && curDept.users.length === 0 && <p className="text-gray-400 text-sm">ยังไม่มีบุคลากรในกองนี้</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {curDiv.users.length ? curDiv.users.map((u) => <Person key={u.id} u={u} />) : <p className="text-gray-400 text-sm">ยังไม่มีบุคลากรในงานนี้</p>}
          </div>
        )}
      </div>
    </div>
  );
}
