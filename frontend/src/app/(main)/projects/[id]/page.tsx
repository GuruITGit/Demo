'use client';
import { useState, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, getErrorMessage } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatThaiDateTime } from '@/lib/utils';
import { ArrowLeft, ClipboardList, User, Plus, GitBranch, History } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { AttachmentPanel } from '@/components/shared/attachment-panel';
import { ProjectPhotos } from '@/components/shared/project-photos';
import { ProposalDoc } from '@/components/shared/proposal-doc';
import { ProposalForm, normalizeProposal, type Proposal } from '@/components/shared/proposal-form';

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const router = useRouter();
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const [mode, setMode] = useState<'none' | 'update' | 'new-plan'>('none');
  const [confirmDel, setConfirmDel] = useState(false);
  const [desc, setDesc] = useState('');
  const [editProposal, setEditProposal] = useState<Proposal>(normalizeProposal(null));
  const [selId, setSelId] = useState<string>('');
  const [showDiff, setShowDiff] = useState(true);

  const { data: p, isLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      const { data } = await api.get(`/projects/${id}`);
      return data.data;
    },
  });

  const del = useMutation({
    mutationFn: () => api.delete(`/projects/${id}`),
    onSuccess: () => { toast.success('ลบโครงการสำเร็จ'); router.push('/projects'); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const submitPlan = useMutation({
    mutationFn: () => api.post(`/projects/${id}/${mode === 'update' ? 'update' : 'new-plan'}`, { description: desc, proposal: editProposal }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', id] });
      toast.success(mode === 'update' ? 'บันทึกการอัปเดตแล้ว' : 'เปิดแผนใหม่แล้ว');
      setMode('none'); setDesc(''); setSelId('');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  function openEditor(m: 'update' | 'new-plan') {
    setEditProposal(normalizeProposal(p?.proposal));
    setDesc('');
    setMode(m);
  }

  if (isLoading) return <div className="flex items-center justify-center h-full"><div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;
  if (!p) return null;

  const plans: any[] = p.plans ?? [];
  const versions = plans.filter((pl) => pl.proposal);
  const selected = versions.find((v) => v.id === selId) || versions[versions.length - 1];
  const selIdx = versions.findIndex((v) => v.id === selected?.id);
  const prevVer = selIdx > 0 ? versions[selIdx - 1] : undefined;
  const latestId = versions[versions.length - 1]?.id;

  const verLabel = (pl: any) => `แผนที่ ${pl.planNo}${pl.revisionNo > 0 ? ` • อัปเดตครั้งที่ ${pl.revisionNo}` : ''}`;

  return (
    <div className="flex flex-col h-full">
      <Header title="รายละเอียดโครงการ" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <PageHeader title={p.title} subtitle={`เลขที่ ${p.projectNumber} • ปีงบประมาณ ${p.fiscalYear}`}>
          <div className="flex gap-2">
            {isAdmin && (
              <>
                <Link href={`/projects/${id}/edit`}><Button variant="outline">แก้ไขข้อมูล</Button></Link>
                <Button variant="outline" onClick={() => setConfirmDel(true)}>ลบ</Button>
              </>
            )}
            <Link href="/projects"><Button variant="outline"><ArrowLeft className="h-4 w-4 mr-1" />ย้อนกลับ</Button></Link>
          </div>
        </PageHeader>

        {!isAdmin && <p className="text-xs text-gray-400">โครงการนี้ดูได้อย่างเดียว (แก้ไขได้เฉพาะผู้ดูแลระบบ)</p>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── ซ้าย: เอกสาร / ฟอร์มแก้ไข ── */}
          <div className="lg:col-span-2 space-y-4">
            {isAdmin && mode !== 'none' ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 space-y-4">
                <p className="text-base font-semibold text-gray-800">{mode === 'update' ? 'อัปเดตแผนเดิม (เพิ่มครั้งที่อัปเดต)' : 'เปิดแผนใหม่ (แผนถัดไป)'}</p>
                <div>
                  <Label>รายละเอียด / สิ่งที่เปลี่ยนแปลง<span className="text-red-500 ml-0.5">*</span></Label>
                  <textarea className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="สรุปสั้น ๆ ว่าแก้อะไร" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">เนื้อหาโครงการ (แก้แล้วบันทึกเป็นเวอร์ชันใหม่ — ของเดิมยังเก็บไว้)</p>
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <ProposalForm value={editProposal} onChange={setEditProposal} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button loading={submitPlan.isPending} disabled={!desc.trim()} onClick={() => submitPlan.mutate()}>บันทึกเวอร์ชันใหม่</Button>
                  <Button variant="outline" onClick={() => setMode('none')}>ยกเลิก</Button>
                </div>
              </div>
            ) : selected?.proposal ? (
              <>
                <div className="flex flex-wrap items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                  <span className="text-sm font-medium text-gray-700">กำลังดู: {verLabel(selected)}{selected.id === latestId ? ' (ปัจจุบัน)' : ''}</span>
                  {prevVer && (
                    <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer ml-auto">
                      <input type="checkbox" checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} />
                      ไฮไลต์ส่วนที่เปลี่ยนจากเวอร์ชันก่อน
                    </label>
                  )}
                </div>
                <ProposalDoc
                  proposal={normalizeProposal(selected.proposal)}
                  prev={showDiff && prevVer ? normalizeProposal(prevVer.proposal) : undefined}
                  title={p.title}
                />
              </>
            ) : p.proposal ? (
              <ProposalDoc proposal={normalizeProposal(p.proposal)} title={p.title} />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-sm text-gray-400">ยังไม่มีเนื้อหาโครงการ</div>
            )}

            <ProjectPhotos projectId={id} canEdit={isAdmin} />

            <AttachmentPanel refType="project" refId={id} title="เอกสารแนบโครงการ" canEdit={isAdmin} />
          </div>

          {/* ── ขวา: ข้อมูลทั่วไป + แผนการดำเนินงาน ── */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3 h-fit">
              <h3 className="font-semibold text-gray-900 text-sm">ข้อมูลทั่วไป</h3>
              <InfoRow icon={ClipboardList} label="กอง/ฝ่าย" value={p.department?.nameTh || '-'} />
              <InfoRow icon={User} label="ผู้รับผิดชอบ" value={p.projectManager?.fullNameTh || '-'} />
              <InfoRow icon={User} label="สร้างโดย" value={p.createdBy?.fullNameTh || '-'} />
              {p.strategy && <InfoRow icon={ClipboardList} label="ยุทธศาสตร์/แผนงาน" value={p.strategy} />}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-blue-500" />
                <h3 className="font-semibold text-gray-900 text-sm">แผนการดำเนินงาน</h3>
              </div>

              {isAdmin && mode === 'none' && (
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => openEditor('update')}><Plus className="h-4 w-4" />อัปเดต</Button>
                  <Button size="sm" variant="outline" onClick={() => openEditor('new-plan')}><GitBranch className="h-4 w-4" />แผนใหม่</Button>
                </div>
              )}

              <div className="space-y-2">
                {plans.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีแผน</p>}
                {[...plans].reverse().map((pl) => {
                  const isViewing = pl.id === selected?.id;
                  const hasProposal = !!pl.proposal;
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      disabled={!hasProposal}
                      onClick={() => hasProposal && setSelId(pl.id)}
                      className={`w-full text-left rounded-lg border p-3 transition ${
                        isViewing ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                          : hasProposal ? 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                            : 'border-gray-100 opacity-70 cursor-default'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-gray-800">{verLabel(pl)}</span>
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${pl.changeType === 'แผนใหม่' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>{pl.changeType}</span>
                      </div>
                      {pl.description && <p className="mt-1 text-xs text-gray-600 whitespace-pre-wrap line-clamp-3">{pl.description}</p>}
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-gray-400">{pl.createdBy?.fullNameTh || '-'} • {formatThaiDateTime(pl.createdAt)}</span>
                        {isViewing ? <span className="text-[11px] font-semibold text-blue-600 shrink-0">● กำลังดูอยู่</span>
                          : hasProposal ? <span className="text-[11px] font-medium text-blue-600 shrink-0">ดูเวอร์ชันนี้ →</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        onConfirm={() => del.mutate()}
        loading={del.isPending}
        title="ลบโครงการ"
        description={`ต้องการลบโครงการ "${p.title}" ใช่หรือไม่?`}
        confirmText="ลบโครงการ"
      />
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-[11px] text-gray-400">{label}</p>
        <p className="text-sm text-gray-900">{value}</p>
      </div>
    </div>
  );
}
