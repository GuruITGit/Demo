'use client';
import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TitleSelect } from '@/components/shared/title-select';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Key, Trash2, Unlock, ShieldCheck } from 'lucide-react';
import { formatThaiDateTime } from '@/lib/utils';
import Link from 'next/link';
import { PERMISSION_MODULES, getGrantsForItems, getActiveItemsFromPermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { hasRole, user: me } = useAuthStore();
  const qc = useQueryClient();

  const isSuperAdmin = hasRole('SUPER_ADMIN');
  const isAdmin = hasRole(['SUPER_ADMIN', 'ADMIN']);

  const { data: userDetail, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: async () => (await api.get(`/users/${id}`)).data.data,
  });

  const { data: rolesList } = useQuery({
    queryKey: ['roles-list'],
    queryFn: async () => (await api.get('/users/roles/list')).data.data as { id: string; name: string; nameTh: string }[],
    enabled: isAdmin,
  });

  const { data: userRoles } = useQuery({
    queryKey: ['user', id, 'roles'],
    queryFn: async () => (await api.get(`/users/${id}/roles`)).data.data as { roleId: string; role: { name: string; nameTh: string } }[],
    enabled: isAdmin,
  });

  const { data: eff } = useQuery({
    queryKey: ['user', id, 'effective-permissions'],
    queryFn: async () => {
      const { data } = await api.get(`/users/${id}/effective-permissions`);
      return (data.data ?? data) as {
        source: string; roles?: string[];
        permissions: { id: string; module: string; action: string; subject: string }[];
        rolePermissions: { module: string; action: string; subject: string }[];
        overridePermissions: { module: string; action: string; subject: string }[];
      };
    },
    enabled: isAdmin,
  });

  const { data: allPermissions } = useQuery({
    queryKey: ['permissions-list'],
    queryFn: async () => (await api.get('/users/permissions/list')).data.data as { id: string; module: string; action: string; subject: string }[],
    enabled: isAdmin,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', 'all'],
    queryFn: async () => (await api.get(`/organizations/${me?.organizationId}/departments?includeHidden=1`)).data.data as any[],
    enabled: !!me?.organizationId && isAdmin,
  });

  const [form, setForm] = useState({ titleTh: '', fullNameTh: '', phone: '', positionName: '', departmentId: '', isActive: true });
  const [overrideItems, setOverrideItems] = useState<Set<string>>(new Set());
  const [overrideDirty, setOverrideDirty] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [newPw, setNewPw] = useState('');
  const [newPwConfirm, setNewPwConfirm] = useState('');

  useEffect(() => {
    if (userDetail) setForm({
      titleTh: userDetail.titleTh || 'นาย', fullNameTh: userDetail.fullNameTh || '', phone: userDetail.phone || '',
      positionName: userDetail.positionName || '', departmentId: userDetail.departmentId || '', isActive: userDetail.isActive,
    });
  }, [userDetail]);

  const keyToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of allPermissions || []) m.set(`${p.module}:${p.action}:${p.subject}`, p.id);
    return m;
  }, [allPermissions]);

  // items ที่ได้จาก "บทบาท" (แสดงติ๊ก+ล็อก) และ override เพิ่มรายคน
  const roleItemKeys = useMemo(() => {
    const keys = new Set((eff?.rolePermissions || []).map((p) => `${p.module}:${p.action}:${p.subject}`));
    return getActiveItemsFromPermissions(keys);
  }, [eff]);

  useEffect(() => {
    if (!eff) return;
    const overKeys = new Set((eff.overridePermissions || []).map((p) => `${p.module}:${p.action}:${p.subject}`));
    const overActive = getActiveItemsFromPermissions(overKeys);
    // เก็บเฉพาะที่ "เกิน" จากบทบาท
    const extra = new Set([...overActive].filter((k) => !roleItemKeys.has(k)));
    setOverrideItems(extra);
    setOverrideDirty(false);
  }, [eff, roleItemKeys]);

  const currentRoleId = userRoles?.[0]?.roleId || '';

  const setRole = useMutation({
    mutationFn: (roleId: string) => api.put(`/users/${id}/role`, { roleId }),
    onSuccess: () => {
      toast.success('เปลี่ยนบทบาทสำเร็จ');
      qc.invalidateQueries({ queryKey: ['user', id, 'roles'] });
      qc.invalidateQueries({ queryKey: ['user', id, 'effective-permissions'] });
    },
    onError: (e: any) => toast.error(getErrorMessage(e, 'เปลี่ยนบทบาทไม่สำเร็จ')),
  });

  const saveOverride = useMutation({
    mutationFn: async () => {
      // เก็บเฉพาะสิทธิ์ที่ "เกิน" จากบทบาท (override เพิ่มได้อย่างเดียว)
      const grantKeys = getGrantsForItems(overrideItems);
      const roleKeys = new Set((eff?.rolePermissions || []).map((p) => `${p.module}:${p.action}:${p.subject}`));
      const ids = [...new Set(grantKeys.filter((k) => !roleKeys.has(k)).map((k) => keyToId.get(k)).filter(Boolean) as string[])];
      await api.put(`/users/${id}/permissions`, { permissionIds: ids });
    },
    onSuccess: () => { toast.success('บันทึกสิทธิ์เพิ่มเติมสำเร็จ'); setOverrideDirty(false); qc.invalidateQueries({ queryKey: ['user', id, 'effective-permissions'] }); },
    onError: (e: any) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });

  const update = useMutation({
    mutationFn: (body: any) => api.put(`/users/${id}`, body),
    onSuccess: () => { toast.success('บันทึกสำเร็จ'); qc.invalidateQueries({ queryKey: ['user', id] }); },
    onError: () => toast.error('ไม่สามารถบันทึกได้'),
  });

  const resetPw = useMutation({
    mutationFn: (newPassword?: string) => api.post(`/users/${id}/reset-password`, newPassword ? { newPassword } : {}),
    onSuccess: (res, newPassword) => {
      if (newPassword) toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      else toast.success(`รหัสผ่านชั่วคราว: ${res.data.data?.tempPassword || res.data.tempPassword}`);
      setPwModal(false); setNewPw(''); setNewPwConfirm('');
    },
    onError: () => toast.error('เปลี่ยนรหัสผ่านไม่สำเร็จ'),
  });

  const unlock = useMutation({
    mutationFn: () => api.post(`/users/${id}/unlock`),
    onSuccess: () => { toast.success('ปลดล็อกบัญชีสำเร็จ'); qc.invalidateQueries({ queryKey: ['user', id] }); },
    onError: () => toast.error('ปลดล็อกไม่สำเร็จ'),
  });

  const deleteUser = useMutation({
    mutationFn: () => api.delete(`/users/${id}`),
    onSuccess: () => { toast.success('ลบผู้ใช้สำเร็จ'); router.push('/users'); },
    onError: () => toast.error('ไม่สามารถลบผู้ใช้ได้'),
  });

  const toggleOverride = (key: string) => {
    if (roleItemKeys.has(key)) return; // สิทธิ์จากบทบาท แก้ที่บทบาท
    setOverrideItems((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
    setOverrideDirty(true);
  };

  if (isLoading) return (
    <div className="flex flex-col h-full"><Header title="ข้อมูลผู้ใช้" /><div className="p-6 animate-pulse"><div className="h-40 bg-gray-100 rounded-xl" /></div></div>
  );
  if (!userDetail) return null;

  const isSelf = me?.id === userDetail.id;
  const isLocked = userDetail.lockedUntil && new Date(userDetail.lockedUntil) > new Date();

  return (
    <div className="flex flex-col h-full">
      <Header title="ข้อมูลผู้ใช้" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5 max-w-6xl">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/users"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900">{userDetail.titleTh}{userDetail.fullNameTh}</h1>
          <span className={cn('text-xs px-2 py-0.5 rounded-full', userDetail.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>{userDetail.isActive ? 'ใช้งาน' : 'ระงับ'}</span>
          {isLocked && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">ถูกล็อก</span>}
        </div>

        {/* ข้อมูลบัญชี */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4 w-full max-w-3xl">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">ข้อมูลบัญชี</h3>
            <span className="text-xs text-gray-400">เข้าล่าสุด: {userDetail.lastLoginAt ? formatThaiDateTime(userDetail.lastLoginAt) : '-'}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-gray-500">ชื่อผู้ใช้</p><p className="font-mono font-medium">{userDetail.username}</p></div>
            <div><p className="text-xs text-gray-500">อีเมล</p><p>{userDetail.email}</p></div>
          </div>

          {isAdmin && (
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">คำนำหน้า</Label>
                  <TitleSelect value={form.titleTh} onChange={(v) => setForm((p) => ({ ...p, titleTh: v }))} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-3"><Label className="text-xs">ชื่อ-สกุล</Label><Input className="mt-1 text-sm" value={form.fullNameTh} onChange={(e) => setForm((p) => ({ ...p, fullNameTh: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">ตำแหน่ง</Label><Input className="mt-1 text-sm" placeholder="เช่น ผู้อำนวยการกองช่าง" value={form.positionName} onChange={(e) => setForm((p) => ({ ...p, positionName: e.target.value }))} /></div>
                <div><Label className="text-xs">เบอร์โทรศัพท์</Label><Input className="mt-1 text-sm" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">กอง/ส่วน</Label>
                  <select className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.departmentId} onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}>
                    <option value="">ไม่ระบุ</option>
                    {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.nameTh}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" /><span className="text-sm text-gray-700">เปิดใช้งานบัญชี</span></label>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => update.mutate(form)} loading={update.isPending}><Save className="h-3.5 w-3.5" />บันทึกข้อมูล</Button>
                <Button size="sm" variant="outline" onClick={() => setPwModal(true)}><Key className="h-3.5 w-3.5" />เปลี่ยนรหัสผ่าน</Button>
                <Button size="sm" variant="outline" onClick={() => unlock.mutate()} loading={unlock.isPending} className={isLocked ? 'text-orange-600 border-orange-200 hover:bg-orange-50' : ''}><Unlock className="h-3.5 w-3.5" />ปลดล็อกบัญชี</Button>
                {isAdmin && !isSelf && (
                  <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => { if (confirm(`ลบผู้ใช้ "${userDetail.fullNameTh}" ออกจากระบบถาวร?`)) deleteUser.mutate(); }} loading={deleteUser.isPending}><Trash2 className="h-3.5 w-3.5" />ลบผู้ใช้</Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* modal เปลี่ยนรหัสผ่าน */}
        {pwModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setPwModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold text-gray-900">เปลี่ยนรหัสผ่าน</h3>
              <p className="text-xs text-gray-500">สำหรับ: <span className="font-medium text-gray-700">{userDetail.titleTh}{userDetail.fullNameTh}</span></p>
              <div className="space-y-3">
                <div><Label className="text-xs">รหัสผ่านใหม่ <span className="text-red-500">*</span></Label><Input type="password" className="mt-1 text-sm" placeholder="อย่างน้อย 8 ตัวอักษร" value={newPw} onChange={(e) => setNewPw(e.target.value)} /></div>
                <div><Label className="text-xs">ยืนยันรหัสผ่าน <span className="text-red-500">*</span></Label><Input type="password" className="mt-1 text-sm" placeholder="พิมพ์รหัสผ่านอีกครั้ง" value={newPwConfirm} onChange={(e) => setNewPwConfirm(e.target.value)} /></div>
              </div>
              {newPw && newPwConfirm && newPw !== newPwConfirm && <p className="text-xs text-red-500">รหัสผ่านไม่ตรงกัน</p>}
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="flex-1" loading={resetPw.isPending} onClick={() => { if (newPw.length < 8) { toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; } if (newPw !== newPwConfirm) { toast.error('รหัสผ่านไม่ตรงกัน'); return; } resetPw.mutate(newPw); }}>บันทึก</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => { setPwModal(false); setNewPw(''); setNewPwConfirm(''); }}>ยกเลิก</Button>
              </div>
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400 mb-2">หรือสุ่มรหัสผ่านชั่วคราว</p>
                <Button size="sm" variant="outline" className="w-full text-xs" loading={resetPw.isPending} onClick={() => resetPw.mutate(undefined)}>สร้างรหัสผ่านชั่วคราวอัตโนมัติ</Button>
              </div>
            </div>
          </div>
        )}

        {/* บทบาท + สิทธิ์ */}
        {isAdmin && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-gray-900 text-sm">บทบาทและสิทธิ์การใช้งาน</h3>
            </div>

            <div>
              <Label className="text-xs">บทบาท (กำหนดสิทธิ์หลักของผู้ใช้)</Label>
              <select
                className="mt-1 w-full max-w-sm border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={currentRoleId}
                onChange={(e) => { if (e.target.value) setRole.mutate(e.target.value); }}
                disabled={setRole.isPending || (currentRoleId && userRoles?.[0]?.role?.name === 'SUPER_ADMIN' && !isSuperAdmin) || false}
              >
                <option value="">— ยังไม่กำหนดบทบาท —</option>
                {rolesList?.filter((r) => r.name !== 'SUPER_ADMIN').map((r) => <option key={r.id} value={r.id}>{r.nameTh || r.name}</option>)}
              </select>
              <p className="mt-1 text-xs text-gray-400">แก้ว่าบทบาทนี้ทำอะไรได้ที่ ตั้งค่า → บทบาท/สิทธิ์</p>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-500 mb-2">สิทธิ์เพิ่มเติมเฉพาะบุคคล (นอกเหนือจากบทบาท) — ติ๊กเพื่อ<b>เพิ่ม</b> สิทธิ์จากบทบาทที่ล็อกไว้แก้ที่หน้าบทบาท</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {PERMISSION_MODULES.map((mod) => (
                  <div key={mod.key} className="rounded-lg border border-gray-200 overflow-hidden">
                    <div className="px-3 py-2 text-xs font-semibold bg-gray-50 text-gray-600">{mod.label}</div>
                    <div className="flex flex-wrap gap-1 p-2">
                      {mod.items.map((item) => {
                        const fromRole = roleItemKeys.has(item.key);
                        const checked = fromRole || overrideItems.has(item.key);
                        return (
                          <label key={item.key} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors',
                            fromRole ? 'bg-blue-50 text-blue-400 border-blue-100 cursor-not-allowed'
                              : checked ? 'bg-emerald-100 text-emerald-800 border-emerald-300 cursor-pointer'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 cursor-pointer')}>
                            <input type="checkbox" checked={checked} disabled={fromRole} onChange={() => toggleOverride(item.key)} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                            {item.label}{fromRole && <span className="ml-1 text-[10px]">(บทบาท)</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {overrideDirty && (
                <div className="flex items-center gap-3 pt-3">
                  <Button size="sm" onClick={() => saveOverride.mutate()} loading={saveOverride.isPending}><Save className="h-3.5 w-3.5" />บันทึกสิทธิ์เพิ่มเติม</Button>
                  <span className="text-xs text-amber-600">มีการเปลี่ยนแปลงที่ยังไม่บันทึก</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
