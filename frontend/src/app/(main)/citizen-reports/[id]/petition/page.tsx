'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, Printer, PenLine, Trash2 } from 'lucide-react';
import { SignatureDrawer } from '@/components/shared/signature-drawer';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';

const TITLE_OPTIONS = ['นาย', 'นาง', 'นางสาว'];

type SigSlot = 'deptHead' | 'clerk' | 'mayor';
// เกณฑ์สิทธิ์ต้องตรงกับ attachSignature() ฝั่ง backend — ที่นี่แค่ซ่อนปุ่ม ตัวบังคับจริงอยู่ที่ API
const SIG_SLOTS: { slot: SigSlot; field: string; label: string; roles?: string[]; onlyHint: string }[] = [
  { slot: 'deptHead', field: 'deptHeadSignature', label: 'หัวหน้าส่วน/ผอ.กอง', onlyHint: 'เฉพาะหัวหน้ากองที่ถูกส่งเรื่องไป' },
  { slot: 'clerk', field: 'clerkSignature', label: 'ปลัด', roles: ['CLERK', 'DEPUTY_CLERK'], onlyHint: 'เฉพาะปลัด/รองปลัด' },
  { slot: 'mayor', field: 'mayorSignature', label: 'นายก', roles: ['MAYOR', 'DEPUTY_MAYOR'], onlyHint: 'เฉพาะนายก/รองนายก' },
];

/**
 * ย่อรูปลายเซ็นให้เล็กลงก่อนส่ง (รูปถ่ายจากมือถือหลาย MB เกิน body limit 1MB ของ API) —
 * ตัดให้กว้างไม่เกิน 600px สูงไม่เกิน 240px แล้วเก็บเป็น PNG (คงพื้นโปร่งใสของลายเซ็นที่วาด)
 */
function shrinkSignature(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 600 / img.width, 240 / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('อ่านไฟล์รูปไม่ได้'));
    img.src = dataUrl;
  });
}

/**
 * แก้ทุกช่องว่างของ "คำร้องทั่วไป" เอง (เรฟหน้า /correspondence/tickets/new) — กรอกครบแล้วกด
 * "บันทึก & พิมพ์เอกสาร" ออกมาเป็น PDF ทันที คนละกลไกกับสารบรรณทั้งหมด (ดู citizen-report.service.ts)
 */
export default function PetitionEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const canManage = useAuthStore((s) => s.hasPermission('complaint:manage:Report'));

  const { data: report, isLoading } = useQuery({
    queryKey: ['citizen-report', id],
    queryFn: async () => (await api.get(`/citizen-reports/${id}`)).data.data,
    enabled: !!id,
  });

  const { data: org } = useQuery({
    queryKey: ['organization', user?.organizationId],
    queryFn: async () => (await api.get(`/organizations/${user?.organizationId}`)).data.data,
    enabled: !!user?.organizationId,
  });

  const [form, setForm] = useState({
    subject: '', reporterName: '', reporterPhone: '', villageNo: '',
    titlePrefix: 'นาย', houseNo: '', subDistrict: '', district: '', province: '', docDate: '',
    detail: '',
  });
  const [ready, setReady] = useState(false);
  // ลายเซ็น 3 ช่อง — บันทึกทันทีที่แนบ/ลบ ผ่าน endpoint แยก (นายก/ปลัดไม่มีสิทธิ์แก้เอกสาร แต่ต้องแนบช่องตัวเองได้)
  const [sigs, setSigs] = useState<Record<SigSlot, string>>({ deptHead: '', clerk: '', mayor: '' });
  const [signingSlot, setSigningSlot] = useState<SigSlot | null>(null);

  const isAdmin = (user?.roles || []).some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN');
  const canSign = (slot: SigSlot) => {
    if (isAdmin) return true; // admin แนบแทนได้ทุกช่อง
    const def = SIG_SLOTS.find((x) => x.slot === slot)!;
    if (slot === 'deptHead') return !!report?.targetDept?.headUserId && report.targetDept.headUserId === user?.id;
    return (user?.roles || []).some((r) => def.roles!.includes(r));
  };

  const saveSig = useMutation({
    mutationFn: async ({ slot, image }: { slot: SigSlot; image: string }) => {
      await api.patch(`/citizen-reports/${id}/signature`, { slot, signatureImage: image });
      return { slot, image };
    },
    onSuccess: ({ slot, image }) => {
      setSigs((p) => ({ ...p, [slot]: image }));
      setSigningSlot(null);
      toast.success(image ? 'แนบลายเซ็นแล้ว' : 'ลบลายเซ็นแล้ว');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกลายเซ็นไม่สำเร็จ')),
  });

  const handleSigSave = async (dataUrl: string) => {
    if (!signingSlot) return;
    let image: string;
    try {
      image = await shrinkSignature(dataUrl);
    } catch {
      return toast.error('อ่านไฟล์รูปลายเซ็นไม่ได้ ลองใช้ไฟล์ PNG/JPG');
    }
    saveSig.mutate({ slot: signingSlot, image });
  };

  // เติมค่าเริ่มต้นครั้งเดียวตอนโหลดเสร็จ — ของเดิมมาก่อน ไม่มีค่อย fallback ของ อบต./วันนี้
  useEffect(() => {
    if (!report || ready) return;
    const a = report.answers || {};
    setForm({
      subject: report.subject || '',
      reporterName: report.reporterName || '',
      reporterPhone: report.reporterPhone || '',
      villageNo: report.villageNo ? String(report.villageNo) : '',
      titlePrefix: a.titlePrefix || 'นาย',
      // ขอใช้บริการ: location = จุดเกิดเหตุ/พิกัด GPS ไม่ใช่บ้านเลขที่ — ไม่เอามาเติม
      // เรื่องเก่าที่ช่องที่อยู่เป็นพิกัด "lat, lng" ก็ไม่เอามาเติม
      houseNo: a.houseNo || (String(report.category || '').startsWith('ขอใช้บริการ') || /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(report.location || '') ? '' : report.location) || '',
      subDistrict: a.subDistrict || org?.subDistrict || '',
      district: a.district || org?.district || '',
      province: a.province || org?.province || '',
      docDate: a.docDate || new Date().toISOString().slice(0, 10),
      detail: report.detail || '',
    });
    setSigs({
      deptHead: report.deptHeadSignature || '',
      clerk: report.clerkSignature || '',
      mayor: report.mayorSignature || '',
    });
    setReady(true);
  }, [report, org, ready]);

  const f = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [name]: e.target.value })),
  });

  // ผู้ไม่มีสิทธิ์แก้เอกสาร (เช่น นายก/ปลัด ที่เข้ามาแนบลายเซ็น) — แค่พิมพ์ ไม่บันทึกช่องข้อมูล
  const saveAndPrint = useMutation({
    mutationFn: async () => {
      if (canManage) await api.patch(`/citizen-reports/${id}`, {
        subject: form.subject.trim(),
        reporterName: form.reporterName.trim(),
        reporterPhone: form.reporterPhone.trim(),
        villageNo: form.villageNo,
        detail: form.detail.trim(),
        answers: {
          titlePrefix: form.titlePrefix,
          houseNo: form.houseNo.trim(),
          subDistrict: form.subDistrict.trim(),
          district: form.district.trim(),
          province: form.province.trim(),
          docDate: form.docDate,
        },
        petitionChecked: true,
      });
      const res = await api.get(`/citizen-reports/${id}/petition-pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    // กลับไปที่เรื่องเดิม (เปิด modal รายละเอียดให้เลย) ไม่ใช่แค่หน้ารายการเปล่าๆ
    onSuccess: () => {
      toast.success(canManage ? 'ยืนยันแล้ว — เปิดเอกสาร PDF ในแท็บใหม่' : 'เปิดเอกสาร PDF ในแท็บใหม่');
      router.push(`/citizen-reports?open=${id}`);
    },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึก/สร้างเอกสารไม่สำเร็จ')),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) return saveAndPrint.mutate();
    if (!form.subject.trim()) return toast.error('กรุณากรอกเรื่อง');
    if (!form.reporterName.trim()) return toast.error('กรุณากรอกชื่อ-สกุลผู้ยื่น');
    if (!form.detail.trim()) return toast.error('กรุณากรอกความประสงค์');
    saveAndPrint.mutate();
  };

  if (isLoading || !ready) return <div className="flex h-full flex-col"><Header title="คำร้องทั่วไป" /><p className="p-6 text-sm text-slate-400">กำลังโหลด...</p></div>;

  const selectCls = 'mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const Req = () => <span className="ml-0.5 text-red-500">*</span>;

  return (
    <div className="flex h-full flex-col">
      <Header title="แก้ไขคำร้องทั่วไป" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-5 flex items-center gap-3">
          <Link href="/citizen-reports"><Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button></Link>
          <h1 className="text-lg font-semibold text-gray-900">แก้ไขคำร้องทั่วไป — {report?.refNo}</h1>
        </div>

        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
          {!canManage && (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-600">
              ดูข้อมูลเอกสารได้อย่างเดียว — แนบลายเซ็นได้เฉพาะช่องของตำแหน่งคุณ
            </p>
          )}
          <fieldset disabled={!canManage} className="space-y-6">
          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="border-b pb-2 text-sm font-semibold text-gray-900">ข้อมูลเอกสาร</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>เรื่อง<Req /></Label>
                <Input className="mt-1" {...f('subject')} />
              </div>
              <div>
                <Label>วันที่เอกสาร<Req /></Label>
                <Input type="date" className="mt-1" {...f('docDate')} />
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="border-b pb-2 text-sm font-semibold text-gray-900">ผู้ยื่นคำร้อง</h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>คำนำหน้า</Label>
                <select className={selectCls} {...f('titlePrefix')}>
                  {TITLE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <Label>ชื่อ-สกุล<Req /></Label>
                <Input className="mt-1" {...f('reporterName')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>บ้านเลขที่</Label>
                <Input className="mt-1" {...f('houseNo')} />
              </div>
              <div>
                <Label>หมู่ที่</Label>
                <Input className="mt-1" {...f('villageNo')} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>ตำบล</Label>
                <Input className="mt-1" {...f('subDistrict')} />
              </div>
              <div>
                <Label>อำเภอ</Label>
                <Input className="mt-1" {...f('district')} />
              </div>
              <div>
                <Label>จังหวัด</Label>
                <Input className="mt-1" {...f('province')} />
              </div>
            </div>
            <div>
              <Label>เบอร์โทรศัพท์</Label>
              <Input className="mt-1" {...f('reporterPhone')} />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="border-b pb-2 text-sm font-semibold text-gray-900">ความประสงค์<Req /></h2>
            <textarea className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" rows={5} maxLength={2000} {...f('detail')} />
          </div>
          </fieldset>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="border-b pb-2">
              <h2 className="text-sm font-semibold text-gray-900">ลายเซ็นผู้พิจารณา</h2>
              <p className="mt-0.5 text-xs text-gray-500">แต่ละช่องแนบได้เฉพาะเจ้าของตำแหน่งหรือผู้ดูแลระบบ (ไม่บังคับ) — บันทึกทันที ไม่เปลี่ยนสถานะการอนุมัติ</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {SIG_SLOTS.map(({ slot, label, onlyHint }) => {
                const allowed = canSign(slot);
                const busy = saveSig.isPending && saveSig.variables?.slot === slot;
                return (
                  <div key={slot} className="flex flex-col rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-medium text-gray-700">{label}</p>
                    <div className="mt-2 flex h-20 items-center justify-center rounded-md bg-gray-50">
                      {sigs[slot] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sigs[slot]} alt={`ลายเซ็น${label}`} className="max-h-16 max-w-full object-contain" />
                      ) : (
                        <span className="text-xs text-gray-400">ยังไม่แนบ</span>
                      )}
                    </div>
                    {allowed ? (
                      <div className="mt-2 flex gap-1.5">
                        <Button type="button" variant="outline" size="sm" className="flex-1" disabled={busy} onClick={() => setSigningSlot(slot)}>
                          <PenLine className="h-3.5 w-3.5" />{sigs[slot] ? 'เปลี่ยน' : 'แนบ'}
                        </Button>
                        {sigs[slot] && (
                          <Button type="button" variant="outline" size="sm" disabled={busy} aria-label={`ลบลายเซ็น${label}`}
                            onClick={() => { if (confirm(`ลบลายเซ็นช่อง${label}?`)) saveSig.mutate({ slot, image: '' }); }}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-center text-[11px] text-gray-400">{onlyHint}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" loading={saveAndPrint.isPending}><Printer className="h-4 w-4" />{canManage ? 'ยืนยัน' : 'พิมพ์เอกสาร'}</Button>
            <Link href="/citizen-reports"><Button variant="outline" type="button">ยกเลิก</Button></Link>
          </div>
        </form>
      </div>

      {signingSlot && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setSigningSlot(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-base font-semibold text-gray-900">
              แนบลายเซ็น — {SIG_SLOTS.find((x) => x.slot === signingSlot)?.label}
            </h3>
            <SignatureDrawer onSave={handleSigSave} onCancel={() => setSigningSlot(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
