'use client';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';

export type Proposer = { name: string; position: string };
export type Proposal = {
  principle: string;
  objectives: string[];
  targets: string;
  methods: string[];
  responsible: string;
  durationLocation: string;
  budgetText: string;
  expectedResults: string[];
  proposers: Proposer[];
  approver: { name: string; position: string };
};

export const EMPTY_PROPOSAL: Proposal = {
  principle: '',
  objectives: [''],
  targets: '',
  methods: [''],
  responsible: '',
  durationLocation: '',
  budgetText: '',
  expectedResults: [''],
  proposers: [{ name: '', position: '' }],
  approver: { name: '', position: 'นายกองค์การบริหารส่วนตำบล' },
};

/** เติม field ที่ขาดให้ proposal ที่โหลดมาจาก DB (กันค่า undefined ตอน map) */
export function normalizeProposal(p?: Partial<Proposal> | null): Proposal {
  return {
    ...EMPTY_PROPOSAL,
    ...(p || {}),
    objectives: p?.objectives?.length ? p.objectives : [''],
    methods: p?.methods?.length ? p.methods : [''],
    expectedResults: p?.expectedResults?.length ? p.expectedResults : [''],
    proposers: p?.proposers?.length ? p.proposers : [{ name: '', position: '' }],
    approver: p?.approver || { name: '', position: 'นายกองค์การบริหารส่วนตำบล' },
  };
}

const ta = 'w-full border border-input bg-background px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none';

function StringList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const set = (i: number, v: string) => onChange(items.map((x, idx) => (idx === i ? v : x)));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 text-sm text-gray-400 w-5 text-right shrink-0">{i + 1}.</span>
          <textarea value={it} onChange={(e) => set(i, e.target.value)} rows={1} className={ta} placeholder={placeholder} />
          <button type="button" onClick={() => onChange(items.length > 1 ? items.filter((_, idx) => idx !== i) : [''])} className="mt-1.5 text-gray-400 hover:text-red-500" aria-label="ลบ">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
        <Plus className="h-4 w-4" />เพิ่มข้อ
      </button>
    </div>
  );
}

function Section({ no, title, children }: { no: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-800">{no}. {title}</label>
      {children}
    </div>
  );
}

/** ฟอร์มกรอกเนื้อหาโครงการ 10 หัวข้อ — ใช้ร่วมกันใน สร้าง/แก้ไข/อัปเดต */
export function ProposalForm({ value: p, onChange }: { value: Proposal; onChange: (v: Proposal) => void }) {
  const setProp = (k: keyof Proposal, v: any) => onChange({ ...p, [k]: v });
  return (
    <div className="space-y-6">
      <Section no={1} title="หลักการและเหตุผล">
        <textarea value={p.principle} onChange={(e) => setProp('principle', e.target.value)} rows={4} className={ta} />
      </Section>
      <Section no={2} title="วัตถุประสงค์">
        <StringList items={p.objectives} onChange={(v) => setProp('objectives', v)} placeholder="วัตถุประสงค์ข้อที่..." />
      </Section>
      <Section no={3} title="เป้าหมาย">
        <textarea value={p.targets} onChange={(e) => setProp('targets', e.target.value)} rows={3} className={ta} />
      </Section>
      <Section no={4} title="วิธีดำเนินงาน">
        <StringList items={p.methods} onChange={(v) => setProp('methods', v)} placeholder="ขั้นตอน/วิธีดำเนินงาน..." />
      </Section>
      <Section no={5} title="ผู้รับผิดชอบโครงการ">
        <textarea value={p.responsible} onChange={(e) => setProp('responsible', e.target.value)} rows={2} className={ta} />
      </Section>
      <Section no={6} title="ระยะเวลาและสถานที่ดำเนินงาน">
        <textarea value={p.durationLocation} onChange={(e) => setProp('durationLocation', e.target.value)} rows={3} className={ta} />
      </Section>
      <Section no={7} title="งบประมาณ">
        <textarea value={p.budgetText} onChange={(e) => setProp('budgetText', e.target.value)} rows={3} className={ta} placeholder="รายละเอียดงบประมาณ..." />
      </Section>
      <Section no={8} title="ผลที่คาดว่าจะได้รับ">
        <StringList items={p.expectedResults} onChange={(v) => setProp('expectedResults', v)} placeholder="ผลที่คาดว่าจะได้รับข้อที่..." />
      </Section>
      <Section no={9} title="ผู้เสนอโครงการ">
        <div className="space-y-2">
          {p.proposers.map((pr, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={pr.name} onChange={(e) => setProp('proposers', p.proposers.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} placeholder="ชื่อ-สกุล" />
              <Input value={pr.position} onChange={(e) => setProp('proposers', p.proposers.map((x, idx) => idx === i ? { ...x, position: e.target.value } : x))} placeholder="ตำแหน่ง" />
              <button type="button" onClick={() => setProp('proposers', p.proposers.length > 1 ? p.proposers.filter((_, idx) => idx !== i) : p.proposers)} className="text-gray-400 hover:text-red-500" aria-label="ลบ">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setProp('proposers', [...p.proposers, { name: '', position: '' }])} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
            <Plus className="h-4 w-4" />เพิ่มผู้เสนอ
          </button>
        </div>
      </Section>
      <Section no={10} title="ผู้อนุมัติโครงการ">
        <div className="flex items-center gap-2">
          <Input value={p.approver.name} onChange={(e) => setProp('approver', { ...p.approver, name: e.target.value })} placeholder="ชื่อ-สกุล" />
          <Input value={p.approver.position} onChange={(e) => setProp('approver', { ...p.approver, position: e.target.value })} placeholder="ตำแหน่ง" />
        </div>
      </Section>
    </div>
  );
}
