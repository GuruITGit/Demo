'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatThaiDateTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, QrCode, ArrowRightLeft, ClipboardCheck, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from '@/components/shared/status-badge';
import { OwnerActions } from '@/components/shared/owner-actions';

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { hasRole } = useAuthStore();
  const [showInspectForm, setShowInspectForm] = useState(false);
  const [inspectForm, setInspectForm] = useState({ condition: 'ดี', inspectionDate: new Date().toISOString().slice(0, 10), remarks: '' });

  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: async () => {
      const { data } = await api.get(`/assets/${id}`);
      return data.data;
    },
  });

  const { data: transfers } = useQuery({
    queryKey: ['asset-transfers', id],
    queryFn: async () => {
      const { data } = await api.get(`/assets/${id}/transfers`);
      return data.data;
    },
  });

  const { data: inspections } = useQuery({
    queryKey: ['asset-inspections', id],
    queryFn: async () => {
      const { data } = await api.get(`/assets/${id}/inspections`);
      return data.data;
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/assets/${id}`),
    onSuccess: () => { toast.success('ลบครุภัณฑ์สำเร็จ'); router.push('/assets'); },
    onError: () => toast.error('ไม่สามารถลบได้'),
  });

  const addInspection = useMutation({
    mutationFn: (body: typeof inspectForm) => api.post(`/assets/${id}/inspect`, body),
    onSuccess: () => {
      toast.success('บันทึกการตรวจสอบสำเร็จ');
      qc.invalidateQueries({ queryKey: ['asset-inspections', id] });
      qc.invalidateQueries({ queryKey: ['asset', id] });
      setInspectForm({ condition: 'ดี', inspectionDate: new Date().toISOString().slice(0, 10), remarks: '' });
      setShowInspectForm(false);
    },
    onError: () => toast.error('ไม่สามารถบันทึกได้'),
  });

  if (isLoading) return <div className="flex flex-col h-full"><Header title="รายละเอียดครุภัณฑ์" /><div className="p-6 animate-pulse"><div className="h-40 bg-gray-100 rounded" /></div></div>;
  if (!asset) return null;

  const isAdmin = hasRole(['SUPER_ADMIN', 'ADMIN']);
  const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-';
  const CONDITIONS = ['ดี', 'พอใช้', 'ชำรุด', 'ต้องซ่อม'];

  return (
    <div className="flex flex-col h-full">
      <Header title="รายละเอียดครุภัณฑ์" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/assets">
            <Button variant="outline"><ArrowLeft className="h-4 w-4" />ย้อนกลับ</Button>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 flex-1">{asset.name}</h1>
          <StatusBadge status={asset.status} />
          <OwnerActions
            record={{ createdBy: asset.createdBy }}
            permission="assets:delete:Asset"
            editHref={`/assets/${id}/edit`}
            onDelete={() => remove.mutate()}
            deleting={remove.isPending}
            deleteDescription={`ต้องการลบครุภัณฑ์ "${asset.name}" ใช่หรือไม่?`}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-800 mb-4">ข้อมูลครุภัณฑ์</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className="text-gray-500">รหัสครุภัณฑ์</dt><dd className="font-mono mt-0.5">{asset.assetCode}</dd></div>
                <div><dt className="text-gray-500">ประเภท</dt><dd className="mt-0.5">{asset.category?.nameTh || '-'}</dd></div>
                <div><dt className="text-gray-500">หน่วยงาน</dt><dd className="mt-0.5">{asset.department?.nameTh || '-'}</dd></div>
                <div><dt className="text-gray-500">ผู้รับผิดชอบ</dt><dd className="mt-0.5">{asset.custodian?.fullNameTh || '-'}</dd></div>
                {asset.serialNumber && <div><dt className="text-gray-500">Serial No.</dt><dd className="font-mono mt-0.5">{asset.serialNumber}</dd></div>}
                {asset.brand && <div><dt className="text-gray-500">ยี่ห้อ/รุ่น</dt><dd className="mt-0.5">{asset.brand} {asset.model || ''}</dd></div>}
                {asset.purchaseDate && <div><dt className="text-gray-500">วันที่จัดซื้อ</dt><dd className="mt-0.5">{formatDate(asset.purchaseDate)}</dd></div>}
                {asset.purchasePrice && <div><dt className="text-gray-500">ราคา</dt><dd className="mt-0.5">{Number(asset.purchasePrice).toLocaleString('th-TH')} บาท</dd></div>}
                {asset.location && <div className="col-span-2"><dt className="text-gray-500">สถานที่เก็บ</dt><dd className="mt-0.5">{asset.location}</dd></div>}
                {asset.description && <div className="col-span-2"><dt className="text-gray-500">รายละเอียด</dt><dd className="mt-0.5 whitespace-pre-wrap">{asset.description}</dd></div>}
              </dl>
            </div>

            {transfers && transfers.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" />ประวัติการโอนย้าย</h2>
                <ul className="space-y-3">
                  {transfers.map((t: any) => (
                    <li key={t.id} className="flex items-start gap-3 text-sm">
                      <div className="flex-1">
                        <p className="text-gray-700">{t.fromDepartment?.nameTh || '-'} → {t.toDepartment?.nameTh || '-'}</p>
                        {t.reason && <p className="text-xs text-gray-500 mt-0.5">{t.reason}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(t.transferDate)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Inspections */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800 flex items-center gap-2"><ClipboardCheck className="h-4 w-4" />ประวัติการตรวจสอบ</h2>
                <Button variant="outline" size="sm" onClick={() => setShowInspectForm(!showInspectForm)}>
                  {showInspectForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {showInspectForm ? 'ยกเลิก' : 'ตรวจสอบ'}
                </Button>
              </div>

              {showInspectForm && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">สภาพ</p>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={inspectForm.condition} onChange={(e) => setInspectForm((p) => ({ ...p, condition: e.target.value }))}>
                        {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">วันที่ตรวจสอบ</p>
                      <Input type="date" value={inspectForm.inspectionDate} onChange={(e) => setInspectForm((p) => ({ ...p, inspectionDate: e.target.value }))} />
                    </div>
                  </div>
                  <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="หมายเหตุ" value={inspectForm.remarks} onChange={(e) => setInspectForm((p) => ({ ...p, remarks: e.target.value }))} />
                  <Button onClick={() => addInspection.mutate(inspectForm)} loading={addInspection.isPending} size="sm"><ClipboardCheck className="h-3.5 w-3.5" />บันทึกการตรวจสอบ</Button>
                </div>
              )}

              {inspections && inspections.length > 0 ? (
                <ul className="space-y-3">
                  {inspections.map((ins: any) => (
                    <li key={ins.id} className="flex items-start gap-3 text-sm">
                      <div className="flex-1">
                        <p className="text-gray-700 font-medium">{ins.condition}</p>
                        {ins.remarks && <p className="text-xs text-gray-500 mt-0.5">{ins.remarks}</p>}
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(ins.inspectionDate)} · {ins.inspector?.fullNameTh || '-'}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-gray-400">ยังไม่มีประวัติ</p>}
            </div>
          </div>

          <div className="space-y-5">
            {asset.qrCodeUrl && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm text-center">
                <h2 className="font-semibold text-gray-800 mb-3 flex items-center justify-center gap-2"><QrCode className="h-4 w-4" />QR Code</h2>
                <img src={asset.qrCodeUrl} alt="QR Code" className="mx-auto w-32 h-32" />
                <p className="text-xs text-gray-400 mt-2 font-mono">{asset.assetCode}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
