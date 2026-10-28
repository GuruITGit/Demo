'use client';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { Settings, Building2, Bell, Lock, Save, FolderOpen, Plus, Trash2, Check, X, Network, ShieldCheck, ImagePlus, Database, AlertTriangle } from 'lucide-react';
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { uploadFiles } from '@/lib/upload';
import { trimLogo } from '@/lib/trim-logo';
import { formatThaiDateTime } from '@/lib/utils';
import { PERMISSION_MODULES, getGrantsForItems, getActiveItemsFromPermissions } from '@/lib/permissions';

type SettingsSection = 'organization' | 'departments' | 'roles' | 'system' | 'notifications' | 'security' | 'maintenance';

function SectionNav({ active, onChange, isAdmin, isSuperAdmin }: { active: SettingsSection; onChange: (s: SettingsSection) => void; isAdmin: boolean; isSuperAdmin: boolean }) {
  const all: { key: SettingsSection; label: string; icon: React.ReactNode; adminOnly?: boolean; superAdminOnly?: boolean }[] = [
    { key: 'organization', label: 'ข้อมูลองค์กร', icon: <Building2 className="h-4 w-4" /> },
    { key: 'departments', label: 'จัดการกอง/แผนก', icon: <Network className="h-4 w-4" />, adminOnly: true },
    { key: 'roles', label: 'บทบาท/สิทธิ์', icon: <ShieldCheck className="h-4 w-4" />, adminOnly: true },
    { key: 'system', label: 'ตั้งค่าระบบ', icon: <Settings className="h-4 w-4" /> },
    { key: 'notifications', label: 'การแจ้งเตือน', icon: <Bell className="h-4 w-4" /> },
    { key: 'security', label: 'ความปลอดภัย', icon: <Lock className="h-4 w-4" /> },
    // ล้างข้อมูล = เจ้าของระบบเท่านั้น (backend บังคับ SUPER_ADMIN) — ADMIN ของ อบต. ไม่เห็นเมนูนี้
    { key: 'maintenance', label: 'ล้างข้อมูล', icon: <Database className="h-4 w-4" />, superAdminOnly: true },
  ];
  const items = all.filter((i) => (!i.adminOnly || isAdmin) && (!i.superAdminOnly || isSuperAdmin));
  return (
    <nav className="space-y-1">
      {items.map((item) => (
        <button key={item.key} onClick={() => onChange(item.key)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left ${active === item.key ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100'}`}>
          {item.icon}{item.label}
        </button>
      ))}
    </nav>
  );
}

function OrganizationSettings() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { data: org } = useQuery({
    queryKey: ['organization', user?.organizationId],
    queryFn: async () => {
      const { data } = await api.get(`/organizations/${user?.organizationId}`);
      return data.data;
    },
    enabled: !!user?.organizationId,
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

  if (org && !initialized) {
    const c = org.metadata?.contact || {};
    setForm({ nameTh: org.nameTh ?? '', nameEn: org.nameEn ?? '', address: org.address ?? '', phone: org.phone ?? '', website: org.website ?? '', taxId: org.taxId ?? '', orgCode: org.orgCode ?? '',
      hours: c.hours ?? '', lineId: c.lineId ?? '', lineUrl: c.lineUrl ?? '', facebookUrl: c.facebookUrl ?? '', mapUrl: c.mapUrl ?? '' });
    setInitialized(true);
  }

  const save = useMutation({
    mutationFn: (body: typeof form) => api.patch(`/organizations/${user?.organizationId}`, body),
    onSuccess: () => { toast.success('บันทึกข้อมูลองค์กรสำเร็จ'); qc.invalidateQueries({ queryKey: ['organization'] }); },
    onError: () => toast.error('ไม่สามารถบันทึกได้'),
  });

  // ช่องทางติดต่อหน้าประชาชน เก็บใน metadata.contact — ต้อง merge กับ metadata เดิม (มี disabledModules ฯลฯ) ห้ามทับทั้งก้อน
  const CONTACT_KEYS = ['hours', 'lineId', 'lineUrl', 'facebookUrl', 'mapUrl'];
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const base = Object.fromEntries(Object.entries(form).filter(([k]) => !CONTACT_KEYS.includes(k)));
    const contact = Object.fromEntries(CONTACT_KEYS.map((k) => [k, (form[k] || '').trim()]));
    save.mutate({ ...base, metadata: { ...(org?.metadata || {}), contact } } as never);
  };

  // อัปโหลดโลโก้/ตราประทับหน่วยงาน
  const uploadImg = useMutation({
    mutationFn: async ({ file, field }: { file: File; field: 'logoUrl' | 'sealUrl' }) => {
      // โลโก้/ตรา แสดงเป็น <img> ตรงๆ ทั่วระบบ (top-nav/หน้า login) → ต้องอยู่ bucket สาธารณะ (avatars)
      // ไม่ใช่ documents ที่เป็น private (ต้องมี signed token) มิฉะนั้นรูปจะ 404
      const img = field === 'logoUrl' ? await trimLogo(file) : file; // โลโก้: ตัดขอบขาวให้เต็มกรอบวงกลม
      const [up] = await uploadFiles([img], { bucket: 'avatars', refType: field === 'logoUrl' ? 'org_logo' : 'org_seal', refId: user?.organizationId });
      await api.patch(`/organizations/${user?.organizationId}`, { [field]: up.url });
    },
    onSuccess: () => { toast.success('อัปเดตรูปแล้ว'); qc.invalidateQueries({ queryKey: ['organization'] }); },
    onError: () => toast.error('อัปโหลดไม่สำเร็จ'),
  });

  if (!org) return <div className="animate-pulse h-40 bg-gray-100 rounded-xl" />;

  const ImgSlot = ({ label, url, field }: { label: string; url?: string; field: 'logoUrl' | 'sealUrl' }) => (
    <div>
      <Label>{label}</Label>
      <label className="mt-1 relative w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 group">
        {url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={url} alt={label} className="w-full h-full object-contain p-1" />
          : <ImagePlus className="h-6 w-6 text-gray-400" />}
        <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs text-white transition-opacity">เปลี่ยนรูป</span>
        <input type="file" accept="image/*" className="hidden" disabled={uploadImg.isPending} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) uploadImg.mutate({ file: f, field }); }} />
      </label>
    </div>
  );

  const fields = [
    { name: 'nameTh', label: 'ชื่อองค์กร (ภาษาไทย)' },
    { name: 'nameEn', label: 'ชื่อองค์กร (ภาษาอังกฤษ)' },
    { name: 'orgCode', label: 'รหัสองค์กร' },
    { name: 'taxId', label: 'เลขประจำตัวผู้เสียภาษี' },
    { name: 'address', label: 'ที่อยู่' },
    { name: 'phone', label: 'เบอร์โทรศัพท์' },
    { name: 'website', label: 'เว็บไซต์' },
  ];
  // แสดงบนหน้าบริการประชาชน (/citizen) ส่วน "ติดต่อ อบต." — ช่องไหนว่างจะไม่แสดง
  const contactFields = [
    { name: 'hours', label: 'เวลาทำการ', ph: 'จันทร์–ศุกร์ 08:30–16:30 น.' },
    { name: 'lineId', label: 'LINE Official Account (ไอดี)', ph: '@lamnangrong' },
    { name: 'lineUrl', label: 'ลิงก์เพิ่มเพื่อน LINE (ไม่บังคับ)', ph: 'https://lin.ee/...' },
    { name: 'facebookUrl', label: 'Facebook Page', ph: 'https://facebook.com/...' },
    { name: 'mapUrl', label: 'ลิงก์ Google Maps ที่ทำการ', ph: 'https://maps.app.goo.gl/...' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-5 w-full max-w-5xl">
      <h3 className="font-semibold text-gray-900">ข้อมูลองค์กร</h3>
      <div className="flex gap-6">
        <ImgSlot label="โลโก้หน่วยงาน" url={org.logoUrl} field="logoUrl" />
        <ImgSlot label="ตราประทับ" url={org.sealUrl} field="sealUrl" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {fields.map((f) => (
          <div key={f.name} className={f.name === 'address' ? 'md:col-span-2' : ''}>
            <Label>{f.label}</Label>
            <Input className="mt-1" value={form[f.name] ?? ''} onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))} />
          </div>
        ))}
      </div>
      <div className="border-t border-gray-100 pt-5">
        <h3 className="font-semibold text-gray-900">ช่องทางติดต่อบนหน้าบริการประชาชน</h3>
        <p className="mt-0.5 text-sm text-gray-500">แสดงในส่วน &quot;ติดต่อ อบต.&quot; ของหน้า /citizen · ช่องที่เว้นว่างจะไม่แสดง</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {contactFields.map((f) => (
          <div key={f.name} className={f.name === 'mapUrl' ? 'md:col-span-2' : ''}>
            <Label>{f.label}</Label>
            <Input className="mt-1" placeholder={f.ph} value={form[f.name] ?? ''} onChange={(e) => setForm((p) => ({ ...p, [f.name]: e.target.value }))} />
          </div>
        ))}
      </div>
      <Button type="submit" loading={save.isPending}><Save className="h-4 w-4" />บันทึก</Button>
    </form>
  );
}

// ตั้งค่าระบบที่ "ใช้งานจริง" เท่านั้น (rework v20000) — 4 ค่า, ตัวอื่นซ่อน
const SYSTEM_SETTING_META: { key: string; label: string; hint: string; unit?: string; type?: 'number' | 'text' | 'boolean' }[] = [
  { key: 'auth.max_failed_attempts', label: 'ล็อกอินผิดกี่ครั้งจึงล็อกบัญชี', hint: 'ป้อนรหัสผ่านผิดครบจำนวนนี้ ระบบจะล็อกบัญชีชั่วคราว', unit: 'ครั้ง' },
  { key: 'auth.lockout_minutes', label: 'ระยะเวลาล็อกบัญชี', hint: 'เมื่อถูกล็อก ต้องรอกี่นาทีจึงลองใหม่ได้', unit: 'นาที' },
  { key: 'file.max_size_mb', label: 'ขนาดไฟล์แนบสูงสุดต่อไฟล์', hint: 'ไฟล์ที่ใหญ่กว่านี้จะอัปโหลดไม่ได้', unit: 'MB' },
  { key: 'file.allowed_types', label: 'ชนิดไฟล์ที่อนุญาต', hint: 'นามสกุลไฟล์ที่แนบได้ คั่นด้วยจุลภาค เช่น pdf,docx,xlsx,jpg,png,zip', type: 'text' },
];

function SystemSettings() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data.data as any[];
    },
  });

  const update = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => api.patch(`/settings/${key}`, { value }),
    onSuccess: () => { toast.success('บันทึกสำเร็จ'); qc.invalidateQueries({ queryKey: ['system-settings'] }); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });

  if (isLoading) return <div className="animate-pulse h-40 bg-gray-100 rounded-xl" />;

  const valueOf = (key: string) => settings?.find((s: any) => s.settingKey === key)?.settingValue ?? '';

  return (
    <div className="space-y-4 w-full max-w-3xl">
      <h3 className="font-semibold text-gray-900">การตั้งค่าระบบ</h3>
      <div className="space-y-3">
        {SYSTEM_SETTING_META.map((m) => {
          const current = valueOf(m.key);
          const type = m.type || 'number';
          const on = current === 'true';
          return (
            <div key={m.key} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{m.label}</p>
                <p className="text-xs text-gray-500">{m.hint}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {type === 'boolean' ? (
                  <button
                    onClick={() => update.mutate({ key: m.key, value: on ? 'false' : 'true' })}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${on ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-200 text-gray-500'}`}
                  >
                    {on ? 'เปิดใช้งาน' : 'ปิดอยู่'}
                  </button>
                ) : (
                  <>
                    <Input
                      type={type === 'text' ? 'text' : 'number'}
                      className={type === 'text' ? 'w-64 text-sm h-8' : 'w-24 text-sm h-8'}
                      defaultValue={current}
                      onBlur={(e) => { if (e.target.value !== current) update.mutate({ key: m.key, value: e.target.value }); }}
                    />
                    {m.unit && <span className="text-xs text-gray-500">{m.unit}</span>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-400">ค่าเหล่านี้มีผลกับทั้งระบบทันทีหลังบันทึก</p>
    </div>
  );
}

// ประเภทแจ้งเตือน — ตรงกับ event ที่ระบบส่งจริง (Rework 2.x: ทุกอย่างยุบเข้าสารบรรณ)
const DEFAULT_NOTIF_TYPES = [
  { key: 'ticket:assigned', label: 'มอบหมายสารบรรณให้ผู้ปฏิบัติ (หัวหน้ากอง)' },
  { key: 'ticket:step', label: 'สารบรรณส่งต่อให้ดำเนินการขั้นถัดไป' },
  { key: 'ticket:returned', label: 'สารบรรณถูกตีกลับ' },
  { key: 'ticket:edited', label: 'มีการแก้ไขเอกสารสารบรรณ' },
  { key: 'ticket:completed', label: 'สารบรรณเสร็จสิ้น (นายกลงนาม)' },
  { key: 'leave:new', label: 'คำขอลาใหม่' },
  { key: 'leave:result', label: 'ผลการอนุมัติการลา' },
  { key: 'meeting:invite', label: 'นัดประชุมใหม่' },
  { key: 'system:announcement', label: 'ประกาศระบบ' },
];

function NotificationSettings() {
  const qc = useQueryClient();
  const { data: prefs } = useQuery({
    queryKey: ['notification-prefs'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/preferences');
      return (data.data ?? []) as any[];
    },
  });

  const update = useMutation({
    mutationFn: (p: any[]) => api.put('/notifications/preferences', { prefs: p }),
    onSuccess: () => { toast.success('บันทึกสำเร็จ'); qc.invalidateQueries({ queryKey: ['notification-prefs'] }); },
  });

  const isEnabled = (key: string) => {
    const pref = prefs?.find((p: any) => p.notificationType === key);
    return pref ? pref.inApp !== false : true;
  };

  const toggle = (key: string) => {
    const currentState = isEnabled(key);
    const existing = prefs ?? [];
    const updated = existing.filter((p: any) => p.notificationType !== key);
    updated.push({ notificationType: key, inApp: !currentState, email: !currentState });
    update.mutate(updated);
  };

  return (
    <div className="space-y-4 w-full max-w-5xl">
      <h3 className="font-semibold text-gray-900">การแจ้งเตือน</h3>
      <p className="text-sm text-gray-500">กำหนดการรับการแจ้งเตือนสำหรับแต่ละประเภทกิจกรรม</p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {DEFAULT_NOTIF_TYPES.map((t) => {
        const on = isEnabled(t.key);
        return (
          <div key={t.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-800">{t.label}</span>
            <button
              onClick={() => toggle(t.key)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function SecuritySettings() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const change = useMutation({
    mutationFn: (body: typeof form) => api.put('/auth/me/password', { currentPassword: body.currentPassword, newPassword: body.newPassword }),
    onSuccess: () => { toast.success('เปลี่ยนรหัสผ่านสำเร็จ'); setForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); },
    onError: () => toast.error('รหัสผ่านปัจจุบันไม่ถูกต้อง'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword) { toast.error('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
    if (form.newPassword.length < 8) { toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
    change.mutate(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      <h3 className="font-semibold text-gray-900">เปลี่ยนรหัสผ่าน</h3>
      <div>
        <Label>รหัสผ่านปัจจุบัน</Label>
        <Input type="password" className="mt-1" value={form.currentPassword} onChange={(e) => setForm((p) => ({ ...p, currentPassword: e.target.value }))} required />
      </div>
      <div>
        <Label>รหัสผ่านใหม่</Label>
        <Input type="password" className="mt-1" value={form.newPassword} onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))} required />
      </div>
      <div>
        <Label>ยืนยันรหัสผ่านใหม่</Label>
        <Input type="password" className="mt-1" value={form.confirmPassword} onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))} required />
      </div>
      <Button type="submit" loading={change.isPending}><Lock className="h-4 w-4" />เปลี่ยนรหัสผ่าน</Button>
    </form>
  );
}

/** จัดการบทบาท/สิทธิ์ (admin) — เลือกบทบาท → กำหนดว่าเข้าโมดูลไหน/ทำอะไรได้ (ป้ายไทย) → บันทึก */
function RoleSettings() {
  const qc = useQueryClient();
  const { data: roles } = useQuery({ queryKey: ['roles-list'], queryFn: async () => (await api.get('/users/roles/list')).data.data as any[] });
  const { data: perms } = useQuery({ queryKey: ['perms-list'], queryFn: async () => (await api.get('/users/permissions/list')).data.data as any[] });
  const [roleId, setRoleId] = useState('');
  const [items, setItems] = useState<Set<string>>(new Set());

  const role = roles?.find((r) => r.id === roleId);
  const readonly = role?.name === 'SUPER_ADMIN';

  const keyToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of perms || []) m.set(`${p.module}:${p.action}:${p.subject}`, p.id);
    return m;
  }, [perms]);
  const idToKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of perms || []) m.set(p.id, `${p.module}:${p.action}:${p.subject}`);
    return m;
  }, [perms]);
  const allItemKeys = useMemo(() => new Set(PERMISSION_MODULES.flatMap((m) => m.items.map((i) => i.key))), []);

  const { data: rolePermIds } = useQuery({ queryKey: ['role-perms', roleId], queryFn: async () => (await api.get(`/users/roles/${roleId}/permissions`)).data.data as string[], enabled: !!roleId });
  useEffect(() => {
    if (readonly) { setItems(new Set(allItemKeys)); return; }
    if (rolePermIds) {
      const keys = new Set(rolePermIds.map((id) => idToKey.get(id)).filter(Boolean) as string[]);
      setItems(getActiveItemsFromPermissions(keys));
    }
  }, [rolePermIds, readonly, idToKey, allItemKeys]);

  const save = useMutation({
    mutationFn: () => {
      const ids = [...new Set(getGrantsForItems(items).map((k) => keyToId.get(k)).filter(Boolean) as string[])];
      return api.put(`/users/roles/${roleId}/permissions`, { permissionIds: ids });
    },
    onSuccess: () => { toast.success('บันทึกสิทธิ์ของบทบาทแล้ว'); qc.invalidateQueries({ queryKey: ['role-perms', roleId] }); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'ไม่สำเร็จ')),
  });

  const isSystemRole = !!role?.isSystem;
  const [newRoleName, setNewRoleName] = useState('');
  const [editName, setEditName] = useState('');
  const [editing, setEditing] = useState(false);

  const createRole = useMutation({
    mutationFn: () => api.post('/users/roles', { nameTh: newRoleName.trim() }),
    onSuccess: (res: any) => { toast.success('เพิ่มบทบาทแล้ว'); setNewRoleName(''); qc.invalidateQueries({ queryKey: ['roles-list'] }); const id = res.data?.data?.role?.id; if (id) setRoleId(id); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'ไม่สำเร็จ')),
  });
  const renameRole = useMutation({
    mutationFn: () => api.put(`/users/roles/${roleId}`, { nameTh: editName.trim() }),
    onSuccess: () => { toast.success('บันทึกชื่อบทบาทแล้ว'); setEditing(false); qc.invalidateQueries({ queryKey: ['roles-list'] }); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'ไม่สำเร็จ')),
  });
  const deleteRole = useMutation({
    mutationFn: () => api.delete(`/users/roles/${roleId}`),
    onSuccess: () => { toast.success('ลบบทบาทแล้ว'); setRoleId(''); qc.invalidateQueries({ queryKey: ['roles-list'] }); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'ลบไม่สำเร็จ')),
  });

  const toggleItem = (key: string) => { if (readonly) return; setItems((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; }); };
  const toggleModule = (modKey: string, on: boolean) => {
    if (readonly) return;
    const mod = PERMISSION_MODULES.find((m) => m.key === modKey);
    if (!mod) return;
    setItems((s) => { const n = new Set(s); for (const it of mod.items) on ? n.add(it.key) : n.delete(it.key); return n; });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">บทบาทและสิทธิ์การใช้งาน</h3>
        <p className="text-sm text-gray-500">เลือกบทบาท แล้วกำหนดว่าเข้าโมดูลไหน/ทำอะไรได้บ้าง (ผู้ดูแลระบบสูงสุดมีสิทธิ์ทั้งหมดเสมอ)</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm" value={roleId} onChange={(e) => { setRoleId(e.target.value); setEditing(false); }}>
          <option value="">เลือกบทบาท...</option>
          {roles?.filter((r) => r.name !== 'SUPER_ADMIN').map((r) => <option key={r.id} value={r.id}>{r.nameTh || r.name}</option>)}
        </select>
        {roleId && !isSystemRole && !editing && (
          <>
            <Button variant="outline" size="sm" onClick={() => { setEditName(role?.nameTh || ''); setEditing(true); }}>เปลี่ยนชื่อ</Button>
            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { if (confirm(`ลบบทบาท "${role?.nameTh}"?`)) deleteRole.mutate(); }} loading={deleteRole.isPending}><Trash2 className="h-4 w-4" />ลบบทบาท</Button>
          </>
        )}
      </div>

      {roleId && !isSystemRole && editing && (
        <div className="flex items-center gap-2">
          <Input className="max-w-xs" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="ชื่อบทบาท" autoFocus />
          <Button size="sm" onClick={() => renameRole.mutate()} loading={renameRole.isPending} disabled={!editName.trim()}>บันทึก</Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>ยกเลิก</Button>
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
        <Input className="max-w-xs" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="ชื่อบทบาทใหม่..." onKeyDown={(e) => { if (e.key === 'Enter' && newRoleName.trim()) createRole.mutate(); }} />
        <Button size="sm" variant="outline" onClick={() => createRole.mutate()} loading={createRole.isPending} disabled={!newRoleName.trim()}><Plus className="h-4 w-4" />เพิ่มบทบาท</Button>
      </div>

      {roleId && (
        <>
          {readonly && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">บทบาทนี้คือผู้ดูแลระบบสูงสุด — มีสิทธิ์ทั้งหมดเสมอ แก้ไขไม่ได้</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {PERMISSION_MODULES.map((mod) => {
              const all = mod.items.every((i) => items.has(i.key));
              const some = mod.items.some((i) => items.has(i.key));
              return (
                <div key={mod.key} className={`rounded-lg border p-3 ${some ? 'border-blue-200' : 'border-gray-200'}`}>
                  <label className="mb-2 flex items-center gap-2 border-b border-gray-100 pb-2 font-medium text-gray-800">
                    <input type="checkbox" className="h-4 w-4" checked={all} disabled={readonly} onChange={(e) => toggleModule(mod.key, e.target.checked)} />
                    {mod.label}
                  </label>
                  <div className="space-y-1">
                    {mod.items.map((it) => (
                      <label key={it.key} className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" className="h-3.5 w-3.5" checked={items.has(it.key)} disabled={readonly} onChange={() => toggleItem(it.key)} />
                        <span>{it.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {!readonly && (
            <Button onClick={() => save.mutate()} loading={save.isPending}><Save className="h-4 w-4" />บันทึกสิทธิ์</Button>
          )}
        </>
      )}
    </div>
  );
}

/** ล้างข้อมูล demo (SUPER_ADMIN) — เลือกขอบเขต + ยืนยัน 2 ชั้น */
const PURGE_MODULES: { key: string; label: string }[] = [
  { key: 'correspondence', label: 'สารบรรณ' },
  { key: 'projects', label: 'โครงการ' },
  { key: 'meetings', label: 'การประชุม' },
  { key: 'leave', label: 'การลา' },
  { key: 'dms', label: 'คลังเอกสาร' },
  { key: 'notifications', label: 'การแจ้งเตือน' },
  { key: 'citizen_reports', label: 'เรื่องแจ้ง/ร้องเรียน' },
];
function MaintenanceSettings() {
  const { user } = useAuthStore();
  const { data: org } = useQuery({
    queryKey: ['organization', user?.organizationId],
    queryFn: async () => (await api.get(`/organizations/${user?.organizationId}`)).data.data,
    enabled: !!user?.organizationId,
  });
  const [mode, setMode] = useState<'all' | 'modules' | 'range' | 'tickets'>('all');
  const [modules, setModules] = useState<Set<string>>(new Set());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [resetSeq, setResetSeq] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  // โหมดเลือกลบสารบรรณทีละรายการ (rework v20000)
  const [tkDept, setTkDept] = useState('');
  const [tkFrom, setTkFrom] = useState('');
  const [tkTo, setTkTo] = useState('');
  const [tkSearch, setTkSearch] = useState('');
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await api.get(`/organizations/${user?.organizationId}/departments`)).data.data as any[],
    enabled: !!user?.organizationId && mode === 'tickets',
  });
  const { data: ticketList, isLoading: ticketsLoading } = useQuery({
    queryKey: ['purge-tickets', tkDept, tkFrom, tkTo, tkSearch],
    queryFn: async () => {
      const { data } = await api.get('/correspondence/tickets', {
        params: { limit: 200, deptId: tkDept || undefined, dateFrom: tkFrom || undefined, dateTo: tkTo || undefined, search: tkSearch || undefined },
      });
      return (data.data ?? data) as any[];
    },
    enabled: mode === 'tickets',
  });

  const orgName = org?.nameTh || '';
  const confirmOk = confirmText.trim() === orgName.trim() && orgName.length > 0;

  const purge = useMutation({
    mutationFn: () => {
      const body: any = { confirmText, password, resetSequences: resetSeq };
      if (mode === 'all') body.resetAll = true;
      if (mode === 'modules') body.modules = [...modules];
      if (mode === 'range') { body.modules = modules.size ? [...modules] : PURGE_MODULES.map((m) => m.key); body.dateFrom = dateFrom || undefined; body.dateTo = dateTo || undefined; }
      if (mode === 'tickets') body.deleteTicketIds = [...selectedTickets];
      return api.post('/maintenance/purge', body);
    },
    onSuccess: (res) => { toast.success('ล้างข้อมูลสำเร็จ'); setConfirmText(''); setPassword(''); setSelectedTickets(new Set()); console.log('purge summary', res.data); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'ล้างข้อมูลไม่สำเร็จ')),
  });

  const toggleMod = (k: string) => setModules((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleTicket = (id: string) => setSelectedTickets((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [backupLoading, setBackupLoading] = useState(false);
  const downloadBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await api.get('/maintenance/backup', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smartgov-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('ดาวน์โหลดสำรองข้อมูลแล้ว');
    } catch {
      toast.error('ดาวน์โหลดสำรองข้อมูลไม่สำเร็จ');
    } finally {
      setBackupLoading(false);
    }
  };
  const canSubmit = confirmOk && password.length > 0 && !purge.isPending
    && (mode === 'all' || (mode === 'modules' && modules.size > 0) || mode === 'range' || (mode === 'tickets' && selectedTickets.size > 0));

  return (
    <div className="max-w-xl space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
        <div>
          <h3 className="font-semibold text-red-800">ล้างข้อมูล demo</h3>
          <p className="text-sm text-red-600">ลบข้อมูลธุรกรรมของ <b>{orgName || 'หน่วยงานนี้'}</b> ออกจากระบบถาวร (หน่วยงานอื่นไม่ถูกแตะ) — ไม่แตะข้อมูลตั้งต้น (กอง/บทบาท/สิทธิ์/หมวด/องค์กร) ข้อมูลประปา และไม่ลบบัญชีผู้ดูแล เป็นการกระทำที่กู้คืนไม่ได้</p>
          <p className="mt-1 text-xs text-red-500">โมดูลที่ล้าง: {PURGE_MODULES.map((m) => m.label).join(' · ')}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
        <div>
          <p className="text-sm font-medium text-blue-800">สำรองข้อมูลก่อนล้าง</p>
          <p className="text-xs text-blue-600">ดาวน์โหลดข้อมูลธุรกรรมทั้งหมดเป็นไฟล์ JSON เก็บไว้ (แนะนำให้ทำก่อนล้างทุกครั้ง)</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadBackup} loading={backupLoading} className="shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100">
          <Database className="h-4 w-4" />ดาวน์โหลดสำรอง
        </Button>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">ขอบเขต</label>
        {([['all', 'ล้างทั้งระบบ (ข้อมูลธุรกรรมทุกโมดูล)'], ['modules', 'เฉพาะโมดูลที่เลือก'], ['range', 'เฉพาะช่วงเวลา'], ['tickets', 'เลือกลบสารบรรณทีละรายการ']] as const).map(([v, label]) => (
          <label key={v} className="flex items-center gap-2 text-sm text-gray-700">
            <input type="radio" name="purge-mode" checked={mode === v} onChange={() => setMode(v)} />{label}
          </label>
        ))}
      </div>

      {(mode === 'modules' || mode === 'range') && (
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="mb-2 text-xs text-gray-500">เลือกโมดูล{mode === 'range' ? ' (ไม่เลือก = ทุกโมดูล)' : ''}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PURGE_MODULES.map((m) => (
              <label key={m.key} className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={modules.has(m.key)} onChange={() => toggleMod(m.key)} />{m.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {mode === 'range' && (
        <div className="flex gap-2">
          <div className="flex-1"><Label className="text-xs">ตั้งแต่วันที่</Label><Input type="date" className="mt-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
          <div className="flex-1"><Label className="text-xs">ถึงวันที่</Label><Input type="date" className="mt-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
        </div>
      )}

      {mode === 'tickets' && (
        <div className="rounded-lg border border-gray-200 p-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input placeholder="ค้นหา เลข/เรื่อง/จาก" className="h-8 flex-1 min-w-40 text-sm" value={tkSearch} onChange={(e) => setTkSearch(e.target.value)} />
            <select value={tkDept} onChange={(e) => setTkDept(e.target.value)} className="h-8 rounded-lg border border-gray-300 px-2 text-sm">
              <option value="">ทุกกอง</option>
              {departments?.map((d) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
            </select>
            <Input type="date" className="h-8 w-36 text-sm" value={tkFrom} onChange={(e) => setTkFrom(e.target.value)} title="ตั้งแต่วันที่" />
            <Input type="date" className="h-8 w-36 text-sm" value={tkTo} onChange={(e) => setTkTo(e.target.value)} title="ถึงวันที่" />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>เลือกแล้ว {selectedTickets.size} รายการ{ticketList && ` · พบ ${ticketList.length}`}</span>
            {(ticketList?.length ?? 0) > 0 && (
              <button type="button" className="text-blue-600 hover:underline"
                onClick={() => setSelectedTickets((prev) => prev.size === ticketList!.length ? new Set() : new Set(ticketList!.map((t: any) => t.id)))}>
                {selectedTickets.size === ticketList?.length ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมดที่พบ'}
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border border-gray-100 divide-y divide-gray-100">
            {ticketsLoading ? (
              <p className="p-4 text-center text-sm text-gray-400">กำลังโหลด...</p>
            ) : (ticketList?.length ?? 0) === 0 ? (
              <p className="p-4 text-center text-sm text-gray-400">ไม่พบสารบรรณตามเงื่อนไข</p>
            ) : ticketList!.map((t: any) => (
              <label key={t.id} className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                <input type="checkbox" className="mt-1" checked={selectedTickets.has(t.id)} onChange={() => toggleTicket(t.id)} />
                <div className="min-w-0">
                  <p className="font-mono text-xs text-blue-700">{t.receiveRegNumber || t.ticketNumber || '-'}</p>
                  <p className="truncate text-gray-800">{t.subject}</p>
                  <p className="text-xs text-gray-400">{t.sourceOrg || '-'}{t.createdAt ? ` · ${formatThaiDateTime(t.createdAt)}` : ''}</p>
                </div>
              </label>
            ))}
          </div>
          <p className="text-xs text-amber-600">ลบเฉพาะสารบรรณที่ติ๊กเท่านั้น (พร้อมไฟล์แนบ/ไทม์ไลน์ของเรื่องนั้น) — กู้คืนไม่ได้</p>
        </div>
      )}

      {mode !== 'tickets' && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={resetSeq} onChange={(e) => setResetSeq(e.target.checked)} />รีเซ็ตเลขทะเบียนเอกสารด้วย
        </label>
      )}

      <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/50 p-3">
        <p className="text-sm font-medium text-red-700">ยืนยัน 2 ชั้น</p>
        <div>
          <Label className="text-xs">พิมพ์ชื่อองค์กรให้ตรง: <span className="font-mono text-gray-700">{orgName || '—'}</span></Label>
          <Input className="mt-1" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="ชื่อองค์กร" />
        </div>
        <div>
          <Label className="text-xs">รหัสผ่านของคุณ (ผู้ดูแล)</Label>
          <Input type="password" className="mt-1" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ยืนยันตัวตน" />
        </div>
      </div>

      <Button
        onClick={() => { if (confirm('ยืนยันล้างข้อมูล? การกระทำนี้กู้คืนไม่ได้')) purge.mutate(); }}
        loading={purge.isPending} disabled={!canSubmit}
        className="bg-red-600 hover:bg-red-700"
      >
        <Trash2 className="h-4 w-4" />ล้างข้อมูล
      </Button>
    </div>
  );
}

/** จัดการกอง/แผนก (admin) — เพิ่ม/แก้/ลบ */
function DepartmentSettings() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { data: depts } = useQuery({ queryKey: ['departments', 'manage'], queryFn: async () => (await api.get(`/organizations/${user?.organizationId}/departments?includeHidden=1`)).data.data as any[], enabled: !!user?.organizationId });
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrefix, setEditPrefix] = useState('');
  const done = () => { qc.invalidateQueries({ queryKey: ['departments'] }); qc.invalidateQueries({ queryKey: ['departments', 'manage'] }); };
  const err = (e: any) => toast.error(getErrorMessage(e, 'ไม่สำเร็จ'));

  const create = useMutation({ mutationFn: () => api.post(`/organizations/${user?.organizationId}/departments`, { code: `D${Date.now().toString(36).toUpperCase()}`, nameTh: newName.trim() }), onSuccess: () => { toast.success('เพิ่มกองแล้ว'); setNewName(''); done(); }, onError: err });
  const update = useMutation({ mutationFn: (v: { id: string; nameTh: string; docPrefix: string }) => api.put(`/organizations/departments/${v.id}`, { nameTh: v.nameTh, docPrefix: v.docPrefix.trim() || null }), onSuccess: () => { toast.success('บันทึกแล้ว'); setEditId(null); done(); }, onError: err });
  const toggleHidden = useMutation({ mutationFn: (v: { id: string; hidden: boolean }) => api.put(`/organizations/departments/${v.id}`, { hiddenFromForms: v.hidden }), onSuccess: () => { toast.success('อัปเดตแล้ว'); done(); }, onError: err });
  const toggleDirectory = useMutation({ mutationFn: (v: { id: string; hidden: boolean }) => api.put(`/organizations/departments/${v.id}`, { hiddenFromDirectory: v.hidden }), onSuccess: () => { toast.success('อัปเดตแล้ว'); done(); }, onError: err });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/organizations/departments/${id}`), onSuccess: () => { toast.success('ลบแล้ว'); done(); }, onError: err });

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">กอง / แผนก</h3>
        <p className="text-sm text-gray-500">เพิ่ม/แก้/ลบ กองในองค์กร (ลบได้เมื่อไม่มีบุคลากรสังกัด) · ตั้ง "อักษรนำหน้าเลขทะเบียน" ของแต่ละกองได้</p>
      </div>
      <div className="flex gap-2">
        <Input placeholder="ชื่อกองใหม่... เช่น กองสาธารณสุข" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) create.mutate(); }} />
        <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!newName.trim()}><Plus className="h-4 w-4" />เพิ่ม</Button>
      </div>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {depts?.map((d: any) => {
          const editing = editId === d.id;
          return (
            <li key={d.id} className="flex items-center gap-2 px-3 py-2.5">
              {editing ? (
                <>
                  <Input className="h-8 flex-1" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="ชื่อกอง" autoFocus />
                  <Input className="h-8 w-28" value={editPrefix} onChange={(e) => setEditPrefix(e.target.value)} placeholder="เลขนำหน้า เช่น บร" title="อักษรนำหน้าเลขทะเบียน" />
                  <button onClick={() => update.mutate({ id: d.id, nameTh: editName, docPrefix: editPrefix })} className="rounded-md p-1.5 text-green-600 hover:bg-green-50"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setEditId(null)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800">{d.nameTh}</span>
                  {d.docPrefix && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-mono text-blue-600" title="อักษรนำหน้าเลขทะเบียน">{d.docPrefix}</span>}
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-400">{d.code}</span>
                  <button onClick={() => toggleHidden.mutate({ id: d.id, hidden: !d.hiddenFromForms })} title="ซ่อน/แสดงกองนี้ในแบบฟอร์มต่างๆ (เช่น มอบหมายสารบรรณ)" className={`rounded-full px-2 py-0.5 text-xs ${d.hiddenFromForms ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{d.hiddenFromForms ? 'ซ่อนจากฟอร์ม' : 'แสดงในฟอร์ม'}</button>
                  <button onClick={() => toggleDirectory.mutate({ id: d.id, hidden: !d.hiddenFromDirectory })} title="ซ่อน/แสดงกองนี้ในหน้าบุคลากร — ใช้กับกองที่ไม่ใช่หน่วยงานจริง เช่น กองที่พักบัญชีระบบ" className={`rounded-full px-2 py-0.5 text-xs ${d.hiddenFromDirectory ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'}`}>{d.hiddenFromDirectory ? 'ซ่อนจากบุคลากร' : 'แสดงในบุคลากร'}</button>
                  <button onClick={() => { setEditId(d.id); setEditName(d.nameTh); setEditPrefix(d.docPrefix || ''); }} className="rounded-md p-1.5 text-xs text-gray-400 hover:bg-blue-50 hover:text-blue-600">แก้ไข</button>
                  <button onClick={() => del.mutate(d.id)} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** จัดการหมวดหมู่เอกสาร (admin) — เพิ่ม/แก้/ลบ หมวดขององค์กร (หมวดมาตรฐานแก้ไม่ได้) */
function CategorySettings() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const { data: cats } = useQuery({ queryKey: ['doc-categories'], queryFn: async () => (await api.get('/documents/categories')).data.data as any[] });
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const done = () => qc.invalidateQueries({ queryKey: ['doc-categories'] });
  const err = (e: any) => toast.error(getErrorMessage(e, 'ไม่สำเร็จ'));

  const create = useMutation({ mutationFn: () => api.post('/documents/categories', { nameTh: newName.trim() }), onSuccess: () => { toast.success('เพิ่มหมวดหมู่แล้ว'); setNewName(''); done(); }, onError: err });
  const update = useMutation({ mutationFn: (v: { id: string; nameTh: string }) => api.put(`/documents/categories/${v.id}`, { nameTh: v.nameTh }), onSuccess: () => { toast.success('บันทึกแล้ว'); setEditId(null); done(); }, onError: err });
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/documents/categories/${id}`), onSuccess: () => { toast.success('ลบแล้ว'); done(); }, onError: err });

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <h3 className="font-semibold text-gray-900">หมวดหมู่เอกสาร</h3>
        <p className="text-sm text-gray-500">เพิ่ม/แก้/ลบ หมวดหมู่ที่ใช้ในคลังเอกสาร (หมวดมาตรฐานแก้ไขไม่ได้)</p>
      </div>
      <div className="flex gap-2">
        <Input placeholder="ชื่อหมวดหมู่ใหม่..." value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) create.mutate(); }} />
        <Button onClick={() => create.mutate()} loading={create.isPending} disabled={!newName.trim()}><Plus className="h-4 w-4" />เพิ่ม</Button>
      </div>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        {cats?.map((c: any) => {
          const isGlobal = !c.organizationId;
          const editing = editId === c.id;
          return (
            <li key={c.id} className="flex items-center gap-2 px-3 py-2.5">
              {editing ? (
                <>
                  <Input className="h-8 flex-1" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                  <button onClick={() => update.mutate({ id: c.id, nameTh: editName })} className="rounded-md p-1.5 text-green-600 hover:bg-green-50"><Check className="h-4 w-4" /></button>
                  <button onClick={() => setEditId(null)} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-800">{c.nameTh}</span>
                  {isGlobal ? (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">มาตรฐาน</span>
                  ) : (
                    <>
                      <button onClick={() => { setEditId(c.id); setEditName(c.nameTh); }} className="rounded-md p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 text-xs">แก้ไข</button>
                      <button onClick={() => del.mutate(c.id)} className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function SettingsPage() {
  const canAccess = usePermissionGuard('settings:read:SystemSetting');
  const { isAdmin, hasRole } = useAuthStore();
  const isSuperAdmin = hasRole('SUPER_ADMIN');
  const [section, setSection] = useState<SettingsSection>('organization');
  if (!canAccess) return null;

  const SECTION_CONTENT: Record<SettingsSection, React.ReactNode> = {
    organization: <OrganizationSettings />,
    departments: <DepartmentSettings />,
    roles: <RoleSettings />,
    system: <SystemSettings />,
    notifications: <NotificationSettings />,
    security: <SecuritySettings />,
    maintenance: <MaintenanceSettings />,
  };

  return (
    <div className="flex flex-col h-full">
      <Header title="ตั้งค่า" />
      <div className="flex-1 overflow-y-auto p-6">
        <PageHeader title="ตั้งค่าระบบ" subtitle="จัดการการตั้งค่าต่างๆ ของระบบ" />
        <div className="mt-5 flex gap-6">
          <aside className="w-48 flex-shrink-0">
            <SectionNav active={section} onChange={setSection} isAdmin={isAdmin()} isSuperAdmin={isSuperAdmin} />
          </aside>
          <main className="flex-1 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            {SECTION_CONTENT[section]}
          </main>
        </div>
      </div>
    </div>
  );
}
