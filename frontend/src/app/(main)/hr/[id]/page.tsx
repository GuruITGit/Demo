'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Phone, Mail, Building2, Briefcase, Users as UsersIcon, Crown, Shield,
  Wrench, Calculator, Scale, HeartPulse, GraduationCap, HandHeart, UserCog, User as UserIcon } from 'lucide-react';
import Link from 'next/link';

function positionIcon(pos = ''): any {
  if (/นายก/.test(pos)) return Crown;
  if (/ปลัด/.test(pos)) return Shield;
  if (/ประธานสภา|สมาชิกสภา|สภา/.test(pos)) return UsersIcon;
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

export default function StaffProfilePage() {
  const { id } = useParams<{ id: string }>();

  const { data: p, isLoading } = useQuery({
    queryKey: ['staff-profile', id],
    queryFn: async () => (await api.get(`/users/${id}/profile`)).data.data,
  });

  if (isLoading) return <div className="flex flex-col h-full"><Header title="บุคลากร" /><div className="p-6 text-gray-400">กำลังโหลด...</div></div>;
  if (!p) return <div className="flex flex-col h-full"><Header title="บุคลากร" /><div className="p-6 text-gray-400">ไม่พบบุคลากร</div></div>;

  const Icon = positionIcon(p.positionName);

  return (
    <div className="flex flex-col h-full">
      <Header title="โปรไฟล์บุคลากร" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-5">
          <Link href="/hr"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
        </div>

        <div className="max-w-2xl space-y-5">
          {/* การ์ดหัวโปรไฟล์ */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center gap-5">
            {p.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.avatarUrl} alt={p.fullNameTh} className="w-24 h-24 rounded-2xl object-cover shrink-0" />
            ) : (
              <div className="w-24 h-24 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                <Icon className="h-12 w-12 text-blue-600" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{p.titleTh}{p.fullNameTh}</h1>
                {p.status && <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[p.status] || 'bg-gray-100 text-gray-600 border-gray-300'}`}>{p.status}</span>}
              </div>
              {p.fullNameEn && <p className="text-sm text-gray-400">{p.fullNameEn}</p>}
              <p className="text-sm text-blue-700 font-medium mt-1">{p.positionName || '-'}</p>
            </div>
          </div>

          {/* รายละเอียดงาน + ติดต่อ (ไม่มีข้อมูลส่วนตัว) */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm border-b pb-2">ข้อมูลการทำงาน</h2>
            <Row icon={Building2} label="ฝ่าย / กลุ่ม" value={p.department?.groupLabel} />
            <Row icon={Building2} label="กอง" value={p.department?.nameTh} />
            <Row icon={Briefcase} label="งาน" value={p.division?.nameTh} />
            <h2 className="font-semibold text-gray-800 text-sm border-b pb-2 pt-2">ช่องทางติดต่อ</h2>
            <Row icon={Phone} label="เบอร์โทร" value={p.phone} />
            <Row icon={Mail} label="อีเมล" value={p.email} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-gray-400">{label}</p>
        <p className="text-sm text-gray-800">{value || '-'}</p>
      </div>
    </div>
  );
}
