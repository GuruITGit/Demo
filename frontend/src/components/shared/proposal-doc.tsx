'use client';
import type { Proposal } from './proposal-form';

// ── diff ระดับอักขระ (LCS) — รองรับภาษาไทยที่ไม่มีช่องว่างระหว่างคำ ──
type Seg = { t: 'same' | 'add' | 'del'; v: string };
function charDiff(a: string, b: string): Seg[] {
  a = a || ''; b = b || '';
  const n = a.length, m = b.length;
  // กันข้อความยาวเกิน (DP O(n*m)) — ถ้ายาวมากถือว่าเปลี่ยนทั้งก้อน
  if (n > 4000 || m > 4000) {
    return a === b ? [{ t: 'same', v: b }] : [{ t: 'del', v: a }, { t: 'add', v: b }];
  }
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const segs: Seg[] = [];
  const push = (t: Seg['t'], v: string) => {
    const last = segs[segs.length - 1];
    if (last && last.t === t) last.v += v; else segs.push({ t, v });
  };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push('same', a[i]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { push('del', a[i]); i++; }
    else { push('add', b[j]); j++; }
  }
  while (i < n) { push('del', a[i]); i++; }
  while (j < m) { push('add', b[j]); j++; }
  return segs;
}

function DocText({ v }: { v?: string }) {
  return v?.trim() ? <p className="whitespace-pre-wrap">{v}</p> : <p className="text-gray-300">—</p>;
}

/** แสดงข้อความ — ถ้ามี prev จะไฮไลต์ส่วนที่เพิ่ม (เขียว) / ลบ (แดงขีดฆ่า) */
function DiffText({ prev, cur }: { prev?: string; cur?: string }) {
  if (prev === undefined) return <DocText v={cur} />;
  const segs = charDiff(prev || '', cur || '');
  if (!segs.some((s) => s.t !== 'same')) return <DocText v={cur} />;
  return (
    <p className="whitespace-pre-wrap">
      {segs.map((s, i) =>
        s.t === 'same' ? <span key={i}>{s.v}</span>
          : s.t === 'add' ? <span key={i} className="bg-green-100 text-green-800 rounded px-0.5">{s.v}</span>
            : <span key={i} className="bg-red-100 text-red-700 line-through rounded px-0.5">{s.v}</span>
      )}
    </p>
  );
}

function joinList(items?: string[]) {
  return (items || []).filter((x) => x?.trim()).map((x, i) => `${i + 1}. ${x}`).join('\n');
}

function DocList({ items }: { items?: string[] }) {
  const list = (items || []).filter((x) => x?.trim());
  if (!list.length) return <p className="text-gray-300">—</p>;
  return <ol className="list-decimal pl-5 space-y-1">{list.map((it, i) => <li key={i} className="whitespace-pre-wrap">{it}</li>)}</ol>;
}

function Section({ no, title, children }: { no: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="font-semibold text-gray-800">{no}. {title}</p>
      <div className="text-sm text-gray-700 pl-4 leading-relaxed">{children}</div>
    </div>
  );
}

function SignBlock({ name, position }: { name?: string; position?: string }) {
  return (
    <div className="text-center text-sm text-gray-700 py-2">
      <p>ลงชื่อ .....................................................</p>
      <p className="mt-1">( {name?.trim() || '..........................................'} )</p>
      <p className="mt-1">ตำแหน่ง {position?.trim() || '.....................................'}</p>
    </div>
  );
}

/**
 * แสดงเอกสารโครงการแบบฟอร์มราชการ
 * ถ้าส่ง prev มาด้วย จะไฮไลต์ความเปลี่ยนแปลงระดับคำเทียบกับเวอร์ชันก่อนหน้า
 */
export function ProposalDoc({ proposal: pr, prev, title }: { proposal: Proposal; prev?: Proposal | null; title: string }) {
  const proposers = (pr.proposers || []).filter((x) => x?.name?.trim() || x?.position?.trim());
  const diff = !!prev;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
      <div className="text-center border-b border-gray-200 pb-3">
        <p className="font-bold text-gray-900">โครงการ {title}</p>
        {diff && (
          <p className="mt-1 text-xs text-gray-500">
            <span className="bg-green-100 text-green-800 rounded px-1">เพิ่ม</span>{' '}
            <span className="bg-red-100 text-red-700 line-through rounded px-1">ลบ</span> เทียบกับเวอร์ชันก่อนหน้า
          </p>
        )}
      </div>
      <Section no={1} title="หลักการและเหตุผล"><DiffText prev={diff ? prev!.principle : undefined} cur={pr.principle} /></Section>
      <Section no={2} title="วัตถุประสงค์">{diff ? <DiffText prev={joinList(prev!.objectives)} cur={joinList(pr.objectives)} /> : <DocList items={pr.objectives} />}</Section>
      <Section no={3} title="เป้าหมาย"><DiffText prev={diff ? prev!.targets : undefined} cur={pr.targets} /></Section>
      <Section no={4} title="วิธีดำเนินงาน">{diff ? <DiffText prev={joinList(prev!.methods)} cur={joinList(pr.methods)} /> : <DocList items={pr.methods} />}</Section>
      <Section no={5} title="ผู้รับผิดชอบโครงการ"><DiffText prev={diff ? prev!.responsible : undefined} cur={pr.responsible} /></Section>
      <Section no={6} title="ระยะเวลาและสถานที่ดำเนินงาน"><DiffText prev={diff ? prev!.durationLocation : undefined} cur={pr.durationLocation} /></Section>
      <Section no={7} title="งบประมาณ"><DiffText prev={diff ? prev!.budgetText : undefined} cur={pr.budgetText} /></Section>
      <Section no={8} title="ผลที่คาดว่าจะได้รับ">{diff ? <DiffText prev={joinList(prev!.expectedResults)} cur={joinList(pr.expectedResults)} /> : <DocList items={pr.expectedResults} />}</Section>
      <Section no={9} title="ผู้เสนอโครงการ">
        <div className="grid sm:grid-cols-2 gap-3 pt-1">
          {proposers.length ? proposers.map((pp, i) => <SignBlock key={i} name={pp.name} position={pp.position} />) : <SignBlock />}
        </div>
      </Section>
      <Section no={10} title="ผู้อนุมัติโครงการ">
        <div className="pt-1 max-w-xs mx-auto"><SignBlock name={pr.approver?.name} position={pr.approver?.position} /></div>
      </Section>
    </div>
  );
}
