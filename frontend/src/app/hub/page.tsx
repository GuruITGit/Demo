'use client';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { uploadFiles } from '@/lib/upload';
import { trimLogo } from '@/lib/trim-logo';
import { AiSettingsCard } from './ai-settings-card';
import {
  Building2, Globe, Users, FileText, Droplet, Power, KeyRound, Trash2, Pencil,
  Plus, Check, Copy, ShieldCheck, Search, Settings2, AlertTriangle, ToggleRight,
} from 'lucide-react';

const ORG_TYPES = ['อบต', 'เทศบาลตำบล', 'เทศบาลเมือง', 'เทศบาลนคร'];

type Org = {
  id: string; code: string; nameTh: string; nameEn?: string; type: string;
  province: string; district: string; subDistrict: string; address?: string;
  phone?: string; fax?: string; email?: string; website?: string; logoUrl?: string;
  hostnames: string[]; metadata: Record<string, any>; isActive: boolean; createdAt: string;
  counts: { users: number; water: number; tickets: number; citizenReports?: number };
};

/** ศูนย์จัดการทุก อบต. (HUB) — SUPER_ADMIN จัดการทุกหน่วยงานในที่เดียว: สร้าง/แก้/โดเมน/เปิด-ปิด/รีเซ็ตรหัส/ลบ */
export default function TenantsHubPage() {
  const isSuper = useAuthStore((s) => s.user?.roles?.includes('SUPER_ADMIN'));
  const myOrgId = useAuthStore((s) => s.user?.organizationId);
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [manageId, setManageId] = useState<string | null>(null);

  const { data: orgs = [], isLoading } = useQuery<Org[]>({
    queryKey: ['org-hub'],
    queryFn: () => api.get('/organizations/hub').then((r) => r.data.data),
    enabled: !!isSuper,
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return orgs;
    return orgs.filter((o) =>
      [o.nameTh, o.code, o.province, ...(o.hostnames || [])].join(' ').toLowerCase().includes(s));
  }, [orgs, q]);

  const totals = useMemo(() => ({
    orgs: orgs.length,
    active: orgs.filter((o) => o.isActive).length,
    users: orgs.reduce((a, o) => a + (o.counts?.users || 0), 0),
  }), [orgs]);

  const manageOrg = orgs.find((o) => o.id === manageId) || null;
  const refresh = () => qc.invalidateQueries({ queryKey: ['org-hub'] });

  if (!isSuper) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-800">
          หน้านี้สำหรับผู้ดูแลระบบสูงสุด (SUPER_ADMIN) เท่านั้น
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="p-6">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <PageHeader title="ศูนย์จัดการหน่วยงาน" subtitle="จัดการทุก อบต. ในระบบ — สร้าง แก้ไข โดเมน เปิด-ปิด รีเซ็ตรหัส และลบ ในที่เดียว" />
            <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> เปิดหน่วยงานใหม่
            </Button>
          </div>

          {/* สรุป */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="หน่วยงานทั้งหมด" value={totals.orgs} icon={Building2} iconColor="text-blue-600" />
            <StatCard title="เปิดใช้งาน" value={totals.active} subtitle={`ปิดใช้งาน ${totals.orgs - totals.active}`} icon={Power} iconColor="text-emerald-600" />
            <StatCard title="ผู้ใช้รวมทุกหน่วยงาน" value={totals.users.toLocaleString('th-TH')} icon={Users} iconColor="text-violet-600" />
          </div>

          {/* ตั้งค่าระดับเจ้าของระบบ (ใช้ร่วมทุก อบต.) */}
          <AiSettingsCard />

          {/* ค้นหา */}
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหา ชื่อ / รหัส / จังหวัด / โดเมน" className="pl-9" />
          </div>

          {/* ตาราง */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold text-slate-500">
                    <th className="px-4 py-3">หน่วยงาน</th>
                    <th className="px-4 py-3">จังหวัด</th>
                    <th className="px-4 py-3">โดเมน</th>
                    <th className="px-4 py-3 text-center">ข้อมูล</th>
                    <th className="px-4 py-3 text-center">สถานะ</th>
                    <th className="px-4 py-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">กำลังโหลด…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">ไม่พบหน่วยงาน</td></tr>
                  ) : filtered.map((o) => (
                    <tr key={o.id} className={o.isActive ? '' : 'bg-slate-50/60'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {o.logoUrl
                            ? <img src={o.logoUrl} alt="" className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
                            : <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500"><Building2 className="h-4.5 w-4.5" /></span>}
                          <div className="min-w-0">
                            <div className="truncate font-medium text-slate-800">{o.nameTh}</div>
                            <div className="text-xs text-slate-400">{o.type} · {o.code}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{o.province || '—'}</td>
                      <td className="px-4 py-3">
                        {o.hostnames?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {o.hostnames.map((h) => (
                              <span key={h} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                <Globe className="h-3 w-3" />{h}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-xs text-slate-400">— (ล็อกอินด้วยรหัสองค์กร)</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1" title="ผู้ใช้"><Users className="h-3.5 w-3.5" />{o.counts.users}</span>
                          <span className="inline-flex items-center gap-1" title="ทะเบียนน้ำ"><Droplet className="h-3.5 w-3.5" />{o.counts.water}</span>
                          <span className="inline-flex items-center gap-1" title="สารบรรณ"><FileText className="h-3.5 w-3.5" />{o.counts.tickets}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {o.isActive
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">เปิดใช้งาน</span>
                          : <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">ปิดใช้งาน</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setManageId(o.id)}>
                          <Settings2 className="h-3.5 w-3.5" /> จัดการ
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {createOpen && <CreateOrgDialog onClose={() => setCreateOpen(false)} onDone={refresh} />}
      {manageOrg && (
        <ManageDrawer
          org={manageOrg}
          isOwnOrg={manageOrg.id === myOrgId}
          onClose={() => setManageId(null)}
          onChanged={refresh}
        />
      )}
    </>
  );
}

/* ───────────────────────── สร้างหน่วยงานใหม่ (onboard) ───────────────────────── */
function CreateOrgDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    code: '', nameTh: '', type: 'อบต', province: '', district: '', subDistrict: '', phone: '',
    hostnames: '', adminUsername: '', adminPassword: '', adminFullName: '', adminEmail: '',
  });
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));
  const [done, setDone] = useState<any | null>(null);

  const save = useMutation({
    mutationFn: () => api.post('/organizations/onboard', {
      code: f.code.trim(), nameTh: f.nameTh.trim(), type: f.type,
      province: f.province.trim(), district: f.district.trim(), subDistrict: f.subDistrict.trim(),
      phone: f.phone.trim() || undefined,
      hostnames: f.hostnames.split(',').map((h) => h.trim()).filter(Boolean),
      adminUsername: f.adminUsername.trim(), adminPassword: f.adminPassword,
      adminFullName: f.adminFullName.trim(), adminEmail: f.adminEmail.trim() || undefined,
    }).then((r) => r.data.data),
    onSuccess: (data) => { setDone(data); onDone(); toast.success('เปิดใช้งาน อบต. ใหม่แล้ว'); },
    onError: (e) => toast.error(getErrorMessage(e, 'สร้างไม่สำเร็จ')),
  });

  const canSubmit = f.code.trim() && f.nameTh.trim() && f.province.trim() && f.district.trim()
    && f.subDistrict.trim() && f.adminUsername.trim() && f.adminPassword.length >= 8 && f.adminFullName.trim();

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>เปิดใช้งานหน่วยงานใหม่</DialogTitle>
          <DialogDescription>สร้างหน่วยงาน + ผู้ดูแลคนแรก + โดเมน ในคลิกเดียว</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
            <div className="flex items-center gap-2 text-emerald-700"><Check className="h-5 w-5" /> <span className="font-semibold">สร้าง {done.org?.nameTh} เรียบร้อย</span></div>
            <dl className="space-y-1.5 text-sm">
              <CopyRow k="รหัสหน่วยงาน" v={done.org?.code} />
              <CopyRow k="โดเมน" v={(done.org?.hostnames || []).join(', ') || '— (ยังไม่ตั้ง)'} />
              <CopyRow k="ผู้ดูแล (username)" v={done.admin?.username} />
              <CopyRow k="อีเมล" v={done.admin?.email} />
            </dl>
            <p className="text-xs text-slate-500">
              {(done.org?.hostnames || []).length
                ? <>เข้าใช้งานที่ <b>https://{done.org.hostnames[0]}</b> · อย่าลืมตั้งโดเมนใน Cloudflare Tunnel ชี้เซิร์ฟเวอร์เดิม</>
                : <>ยังไม่ตั้งโดเมน — ล็อกอินโดยระบุ <b>รหัสองค์กร {done.org?.code}</b> ที่หน้า login</>}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setDone(null); setF({ code: '', nameTh: '', type: 'อบต', province: '', district: '', subDistrict: '', phone: '', hostnames: '', adminUsername: '', adminPassword: '', adminFullName: '', adminEmail: '' }); }}>เปิดอีกหน่วยงาน</Button>
              <Button onClick={onClose}>เสร็จสิ้น</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <section className="space-y-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Building2 className="h-4 w-4 text-blue-500" /> ข้อมูลหน่วยงาน</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="รหัสหน่วยงาน *"><Input value={f.code} onChange={(e) => set({ code: e.target.value })} placeholder="เช่น KHOKCHAN" /></Field>
                <Field label="ประเภท *">
                  <select value={f.type} onChange={(e) => set({ type: e.target.value })} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
                    {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="ชื่อหน่วยงาน *" className="sm:col-span-2"><Input value={f.nameTh} onChange={(e) => set({ nameTh: e.target.value })} placeholder="องค์การบริหารส่วนตำบล…" /></Field>
                <Field label="จังหวัด *"><Input value={f.province} onChange={(e) => set({ province: e.target.value })} /></Field>
                <Field label="อำเภอ *"><Input value={f.district} onChange={(e) => set({ district: e.target.value })} /></Field>
                <Field label="ตำบล *"><Input value={f.subDistrict} onChange={(e) => set({ subDistrict: e.target.value })} /></Field>
                <Field label="เบอร์โทร"><Input value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
              </div>
            </section>
            <section className="space-y-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Globe className="h-4 w-4 text-blue-500" /> โดเมน</p>
              <Field label="โดเมนของหน่วยงาน (คั่นด้วย , ได้หลายโดเมน)">
                <Input value={f.hostnames} onChange={(e) => set({ hostnames: e.target.value })} placeholder="sao-khokchan.com หรือ khokchan.smartsao.com" />
              </Field>
            </section>
            <section className="space-y-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><ShieldCheck className="h-4 w-4 text-blue-500" /> ผู้ดูแลคนแรก (บทบาท ADMIN)</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="ชื่อผู้ใช้ *"><Input value={f.adminUsername} onChange={(e) => set({ adminUsername: e.target.value })} placeholder="admin" /></Field>
                <Field label="รหัสผ่าน * (≥ 8 ตัว)"><Input type="password" value={f.adminPassword} onChange={(e) => set({ adminPassword: e.target.value })} /></Field>
                <Field label="ชื่อ-สกุล *" className="sm:col-span-2"><Input value={f.adminFullName} onChange={(e) => set({ adminFullName: e.target.value })} /></Field>
                <Field label="อีเมล (เว้นว่าง = สร้างให้อัตโนมัติ)" className="sm:col-span-2"><Input value={f.adminEmail} onChange={(e) => set({ adminEmail: e.target.value })} /></Field>
              </div>
              <p className="text-xs text-slate-400">ชื่อผู้ใช้ซ้ำข้าม อบต. ได้ (unique ต่อหน่วยงาน)</p>
            </section>
            <div className="flex items-center gap-3 pt-1">
              <Button onClick={() => save.mutate()} disabled={!canSubmit} loading={save.isPending} className="gap-1.5">
                <ShieldCheck className="h-4 w-4" /> เปิดใช้งานหน่วยงาน
              </Button>
              {!canSubmit && <span className="text-xs text-slate-400">กรอกช่องที่มี * · รหัสผ่าน ≥ 8 ตัว</span>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── จัดการหน่วยงาน (slide-over) ───────────────────────── */
function ManageDrawer({ org, isOwnOrg, onClose, onChanged }: { org: Org; isOwnOrg: boolean; onClose: () => void; onChanged: () => void }) {
  const [tab, setTab] = useState<'info' | 'domain' | 'modules' | 'users' | 'danger'>('info');
  const tabs = [
    { key: 'info', label: 'ข้อมูล', icon: Pencil },
    { key: 'domain', label: 'โดเมน & สถานะ', icon: Globe },
    { key: 'modules', label: 'โมดูล', icon: ToggleRight },
    { key: 'users', label: 'ผู้ใช้ & รหัส', icon: KeyRound },
    { key: 'danger', label: 'ลบ', icon: Trash2 },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-slate-800">{org.nameTh}</div>
            <div className="text-xs text-slate-400">{org.type} · {org.code}{isOwnOrg && ' · หน่วยงานของคุณ'}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
        </div>

        <div className="flex gap-1 border-b border-slate-200 px-4">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${tab === t.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'} ${t.key === 'danger' ? 'ml-auto' : ''}`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'info' && <InfoTab org={org} onChanged={onChanged} />}
          {tab === 'domain' && <DomainTab org={org} isOwnOrg={isOwnOrg} onChanged={onChanged} />}
          {tab === 'modules' && <ModulesTab org={org} onChanged={onChanged} />}
          {tab === 'users' && <UsersTab org={org} />}
          {tab === 'danger' && <DangerTab org={org} isOwnOrg={isOwnOrg} onClose={onClose} onChanged={onChanged} />}
        </div>
      </div>
    </div>
  );
}

function InfoTab({ org, onChanged }: { org: Org; onChanged: () => void }) {
  const [f, setF] = useState({
    nameTh: org.nameTh || '', nameEn: org.nameEn || '', type: org.type || 'อบต',
    province: org.province || '', district: org.district || '', subDistrict: org.subDistrict || '',
    address: org.address || '', phone: org.phone || '', fax: org.fax || '', email: org.email || '',
    website: org.website || '', logoUrl: org.logoUrl || '',
  });
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));
  // อัปโหลดโลโก้ไป bucket สาธารณะ (avatars) — <img>/ไอคอนเว็บ/Google ต้องเปิดได้โดยไม่ล็อกอิน (แบบเดียวกับ /settings)
  const [uploading, setUploading] = useState(false);
  const uploadLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('เลือกไฟล์รูปภาพเท่านั้น'); return; }
    setUploading(true);
    try {
      const [up] = await uploadFiles([await trimLogo(file)], { bucket: 'avatars', refType: 'org_logo', refId: org.id });
      set({ logoUrl: up.url });
      toast.success('อัปโหลดแล้ว — กด "บันทึก" เพื่อใช้โลโก้นี้');
    } catch (e) {
      toast.error(getErrorMessage(e, 'อัปโหลดไม่สำเร็จ'));
    } finally {
      setUploading(false);
    }
  };
  const save = useMutation({
    mutationFn: () => api.patch(`/organizations/${org.id}`, {
      ...f, nameEn: f.nameEn || undefined, address: f.address || undefined, phone: f.phone || undefined,
      fax: f.fax || undefined, email: f.email || undefined, website: f.website || undefined, logoUrl: f.logoUrl || undefined,
    }).then((r) => r.data.data),
    onSuccess: () => { onChanged(); toast.success('บันทึกข้อมูลหน่วยงานแล้ว'); },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="ชื่อหน่วยงาน (ไทย)" className="sm:col-span-2"><Input value={f.nameTh} onChange={(e) => set({ nameTh: e.target.value })} /></Field>
        <Field label="ชื่อหน่วยงาน (อังกฤษ)" className="sm:col-span-2"><Input value={f.nameEn} onChange={(e) => set({ nameEn: e.target.value })} /></Field>
        <Field label="ประเภท">
          <select value={f.type} onChange={(e) => set({ type: e.target.value })} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="จังหวัด"><Input value={f.province} onChange={(e) => set({ province: e.target.value })} /></Field>
        <Field label="อำเภอ"><Input value={f.district} onChange={(e) => set({ district: e.target.value })} /></Field>
        <Field label="ตำบล"><Input value={f.subDistrict} onChange={(e) => set({ subDistrict: e.target.value })} /></Field>
        <Field label="ที่อยู่" className="sm:col-span-2"><Input value={f.address} onChange={(e) => set({ address: e.target.value })} /></Field>
        <Field label="เบอร์โทร"><Input value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="โทรสาร"><Input value={f.fax} onChange={(e) => set({ fax: e.target.value })} /></Field>
        <Field label="อีเมล"><Input value={f.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="เว็บไซต์"><Input value={f.website} onChange={(e) => set({ website: e.target.value })} /></Field>
        <Field label="โลโก้ (แสดงในหน้าประชาชน แถบบน แท็บเบราว์เซอร์ และผลค้นหา Google)" className="sm:col-span-2">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">
              {f.logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={f.logoUrl} alt="ตัวอย่างโลโก้" className="h-full w-full rounded-full object-cover" />
                : <span className="text-[11px] text-slate-400">ไม่มี</span>}
            </span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <label className={`inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 ${uploading ? 'pointer-events-none opacity-60' : ''}`}>
                  {uploading ? 'กำลังอัปโหลด...' : 'อัปโหลดรูป'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) uploadLogo(file); }} />
                </label>
                <span className="text-xs text-slate-500">PNG สี่เหลี่ยมจัตุรัส 192×192 ขึ้นไป · อัปโหลดแล้วกด &quot;บันทึก&quot;</span>
              </div>
              <Input value={f.logoUrl} onChange={(e) => set({ logoUrl: e.target.value })} placeholder="หรือวางลิงก์รูป https://…" />
            </div>
          </div>
        </Field>
      </div>
      <Button onClick={() => save.mutate()} loading={save.isPending}>บันทึก</Button>
    </div>
  );
}

function DomainTab({ org, isOwnOrg, onChanged }: { org: Org; isOwnOrg: boolean; onChanged: () => void }) {
  const [hosts, setHosts] = useState((org.hostnames || []).join(', '));
  const saveHosts = useMutation({
    mutationFn: () => api.patch(`/organizations/${org.id}`, {
      hostnames: hosts.split(',').map((h) => h.trim()).filter(Boolean),
    }).then((r) => r.data.data),
    onSuccess: () => { onChanged(); toast.success('บันทึกโดเมนแล้ว'); },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });
  const toggleActive = useMutation({
    mutationFn: (isActive: boolean) => api.patch(`/organizations/${org.id}`, { isActive }).then((r) => r.data.data),
    onSuccess: (_d, v) => { onChanged(); toast.success(v ? 'เปิดใช้งานหน่วยงานแล้ว' : 'ปิดใช้งานหน่วยงานแล้ว'); },
    onError: (e) => toast.error(getErrorMessage(e, 'ทำรายการไม่สำเร็จ')),
  });
  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Globe className="h-4 w-4 text-blue-500" /> โดเมน (multi-tenant)</p>
        <Field label="โดเมนของหน่วยงาน (คั่นด้วย , ได้หลายโดเมน)">
          <Input value={hosts} onChange={(e) => setHosts(e.target.value)} placeholder="sao-khokchan.com, khokchan.smartsao.com" />
        </Field>
        <p className="text-xs text-slate-400">เปิดโดเมนไหน = ระบบรู้ว่าเป็น อบต. นี้อัตโนมัติ · ต้องตั้งโดเมนใน Cloudflare Tunnel ชี้เซิร์ฟเวอร์เดิมด้วย</p>
        <Button onClick={() => saveHosts.mutate()} loading={saveHosts.isPending}>บันทึกโดเมน</Button>
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Power className="h-4 w-4 text-blue-500" /> สถานะการใช้งาน</p>
        <p className="text-xs text-slate-500">
          ปิดใช้งาน = หน่วยงานนี้ล็อกอินไม่ได้ + แบรนด์ตามโดเมนหยุดทำงาน (ข้อมูลยังอยู่ครบ เปิดกลับได้ทุกเมื่อ)
        </p>
        {isOwnOrg ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">ปิดหน่วยงานของคุณเองไม่ได้ (กันล็อกตัวเองออกจากระบบ)</p>
        ) : org.isActive ? (
          <Button variant="outline" className="gap-1.5 text-red-600" onClick={() => toggleActive.mutate(false)} loading={toggleActive.isPending}>
            <Power className="h-4 w-4" /> ปิดใช้งานหน่วยงาน
          </Button>
        ) : (
          <Button className="gap-1.5" onClick={() => toggleActive.mutate(true)} loading={toggleActive.isPending}>
            <Power className="h-4 w-4" /> เปิดใช้งานหน่วยงาน
          </Button>
        )}
      </section>
    </div>
  );
}

function UsersTab({ org }: { org: Org }) {
  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ['org-users', org.id],
    queryFn: () => api.get(`/organizations/${org.id}/users`).then((r) => r.data.data),
  });
  const [userId, setUserId] = useState('');
  const [pw, setPw] = useState('');
  const reset = useMutation({
    mutationFn: () => api.post(`/organizations/${org.id}/reset-admin`, { userId: userId || undefined, password: pw }).then((r) => r.data.data),
    onSuccess: (d) => { toast.success(`รีเซ็ตรหัสผ่านของ ${d.username} แล้ว`); setPw(''); },
    onError: (e) => toast.error(getErrorMessage(e, 'รีเซ็ตไม่สำเร็จ')),
  });
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Users className="h-4 w-4 text-blue-500" /> ผู้ใช้ในหน่วยงาน ({users.length})</p>
        <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
          {isLoading ? <p className="px-3 py-4 text-center text-sm text-slate-400">กำลังโหลด…</p>
            : users.length === 0 ? <p className="px-3 py-4 text-center text-sm text-slate-400">ไม่มีผู้ใช้</p>
            : users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-700">{u.fullNameTh || u.username}</div>
                  <div className="text-xs text-slate-400">{u.username} · {(u.roles || []).join(', ') || 'ไม่มีบทบาท'}</div>
                </div>
                {!u.isActive && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">ปิดใช้งาน</span>}
              </div>
            ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><KeyRound className="h-4 w-4 text-blue-500" /> รีเซ็ตรหัสผ่าน</p>
        <Field label="เลือกผู้ใช้">
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
            <option value="">— ผู้ดูแล (ADMIN) คนแรกของหน่วยงาน —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.fullNameTh || u.username} ({u.username})</option>)}
          </select>
        </Field>
        <Field label="รหัสผ่านใหม่ (≥ 8 ตัว)"><Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="รหัสผ่านใหม่" /></Field>
        <Button onClick={() => reset.mutate()} disabled={pw.length < 8} loading={reset.isPending} className="gap-1.5">
          <KeyRound className="h-4 w-4" /> รีเซ็ตรหัสผ่าน
        </Button>
        <p className="text-xs text-slate-400">แจ้งรหัสใหม่ให้ผู้ใช้แล้วให้เปลี่ยนเองภายหลัง</p>
      </section>
    </div>
  );
}

function ModulesTab({ org, onChanged }: { org: Org; onChanged: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ disabledModules: string[]; catalog: { key: string; label: string; group: string }[] }>({
    queryKey: ['org-modules', org.id],
    queryFn: () => api.get(`/organizations/${org.id}/modules`).then((r) => r.data.data),
  });
  const [disabled, setDisabled] = useState<Set<string> | null>(null);
  const cur = disabled ?? new Set(data?.disabledModules || []);
  const toggle = (key: string) => {
    const next = new Set(cur);
    next.has(key) ? next.delete(key) : next.add(key);
    setDisabled(next);
  };
  const save = useMutation({
    mutationFn: () => api.put(`/organizations/${org.id}/modules`, { disabledModules: [...cur] }).then((r) => r.data.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-modules', org.id] });
      qc.invalidateQueries({ queryKey: ['current-modules'] });
      onChanged(); setDisabled(null); toast.success('บันทึกการเปิด-ปิดโมดูลแล้ว');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });

  if (isLoading) return <p className="text-center text-sm text-slate-400">กำลังโหลด…</p>;
  const groups = [...new Set((data?.catalog || []).map((m) => m.group))];
  const dirty = disabled !== null;

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-500">
        ปิดโมดูล = ซ่อนเมนู + บล็อกการเรียกใช้จริงสำหรับหน่วยงานนี้ (ข้อมูลเดิมยังอยู่ เปิดกลับได้)
      </p>
      {groups.map((g) => (
        <section key={g} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{g}</p>
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {(data?.catalog || []).filter((m) => m.group === g).map((m) => {
              const on = !cur.has(m.key);
              return (
                <div key={m.key} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-slate-700">{m.label}</span>
                  <button
                    type="button"
                    onClick={() => toggle(m.key)}
                    role="switch"
                    aria-checked={on}
                    className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <div className="flex items-center gap-3">
        <Button onClick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>บันทึก</Button>
        {dirty && <button className="text-sm text-slate-500 hover:text-slate-700" onClick={() => setDisabled(null)}>ยกเลิกการเปลี่ยน</button>}
      </div>
    </div>
  );
}

/** ล้างเรื่องแจ้ง/ร้องเรียนทั้งหมดของหน่วยงาน — ใช้เคลียร์ข้อมูลทดสอบก่อนเปิดให้ลูกค้าใช้จริง (เฉพาะ SUPER_ADMIN) */
function ClearReportsSection({ org, onChanged }: { org: Org; onChanged: () => void }) {
  const [confirm, setConfirm] = useState('');
  const count = org.counts.citizenReports ?? 0;
  const clear = useMutation({
    mutationFn: () => api.post(`/organizations/${org.id}/clear-citizen-reports`, { confirm: confirm.trim() }).then((r) => r.data.data),
    onSuccess: (d) => { toast.success(`ล้างเรื่องแจ้ง/ร้องเรียนของ ${d.nameTh} แล้ว ${d.deleted} เรื่อง`); setConfirm(''); onChanged(); },
    onError: (e) => toast.error(getErrorMessage(e, 'ล้างข้อมูลไม่สำเร็จ')),
  });
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Trash2 className="h-4 w-4 text-red-500" /> ล้างข้อมูลเรื่องแจ้ง/ร้องเรียน</p>
        <p className="mt-1 text-xs text-slate-500">
          ลบเรื่องแจ้ง/ร้องเรียนและคำขอใช้บริการ<b>ทั้งหมด</b>ของหน่วยงานนี้ (ปัจจุบัน {count} เรื่อง) ย้อนกลับไม่ได้ — ใช้ล้างข้อมูลทดสอบก่อนเปิดใช้จริง
          · เลขอ้างอิงจะเริ่มนับใหม่ · ข้อมูลอื่น (สารบรรณ/ประปา/ผู้ใช้) ไม่ถูกแตะ · ควรสำรองข้อมูลก่อน
        </p>
      </div>
      {count === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">ไม่มีเรื่องแจ้ง/ร้องเรียนให้ล้าง</p>
      ) : (
        <>
          <Field label={`พิมพ์รหัสหน่วยงาน "${org.code}" เพื่อยืนยัน`}>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={org.code} />
          </Field>
          <Button variant="destructive" className="gap-1.5" disabled={confirm.trim() !== org.code} loading={clear.isPending}
            onClick={() => { if (window.confirm(`ยืนยันลบเรื่องแจ้ง/ร้องเรียนทั้งหมด ${count} เรื่องของ ${org.nameTh}?`)) clear.mutate(); }}>
            <Trash2 className="h-4 w-4" /> ล้างเรื่องแจ้ง/ร้องเรียนทั้งหมด
          </Button>
        </>
      )}
    </section>
  );
}

function DangerTab({ org, isOwnOrg, onClose, onChanged }: { org: Org; isOwnOrg: boolean; onClose: () => void; onChanged: () => void }) {
  const [confirm, setConfirm] = useState('');
  const hasData = (org.counts.water + org.counts.tickets) > 0;
  const del = useMutation({
    mutationFn: () => api.delete(`/organizations/${org.id}`).then((r) => r.data.data),
    onSuccess: () => { toast.success(`ลบหน่วยงาน ${org.nameTh} แล้ว`); onChanged(); onClose(); },
    onError: (e) => toast.error(getErrorMessage(e, 'ลบไม่สำเร็จ')),
  });
  return (
    <div className="space-y-4">
      <ClearReportsSection org={org} onChanged={onChanged} />

      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
        <div className="space-y-1 text-sm text-red-800">
          <p className="font-semibold">ลบหน่วยงานถาวร</p>
          <p className="text-red-700">ลบหน่วยงาน ผู้ใช้ทั้งหมด และการตั้งค่าทิ้งถาวร ย้อนกลับไม่ได้</p>
        </div>
      </div>

      {isOwnOrg ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">ลบหน่วยงานของคุณเองไม่ได้</p>
      ) : hasData ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          หน่วยงานนี้มีข้อมูลใช้งานแล้ว (ทะเบียนน้ำ {org.counts.water} · สารบรรณ {org.counts.tickets}) — ลบไม่ได้ ให้ <b>ปิดใช้งาน</b> แทน (แท็บ “โดเมน & สถานะ”)
        </p>
      ) : (
        <>
          <Field label={`พิมพ์รหัสหน่วยงาน "${org.code}" เพื่อยืนยัน`}>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={org.code} />
          </Field>
          <Button variant="destructive" className="gap-1.5" disabled={confirm.trim() !== org.code} loading={del.isPending} onClick={() => del.mutate()}>
            <Trash2 className="h-4 w-4" /> ลบหน่วยงานถาวร
          </Button>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */
function Field({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function CopyRow({ k, v }: { k: string; v?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className="flex items-center gap-1.5 font-medium text-slate-800">
        {v || '—'}
        {v && <button onClick={() => { navigator.clipboard?.writeText(v).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }); }}
          className="text-slate-400 hover:text-slate-700">{copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}</button>}
      </dd>
    </div>
  );
}
