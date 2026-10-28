'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Sparkles, KeyRound, Check, AlertTriangle } from 'lucide-react';

type KeyInfo = { configured: boolean; source: 'hub' | 'env' | null; hint: string | null; updatedAt: string | null };
type AiStatus = { provider: 'anthropic' | 'gemini'; model: string; geminiModel: string; anthropic: KeyInfo; gemini: KeyInfo };

const SOURCE: Record<string, string> = { hub: 'ตั้งจากหน้านี้', env: 'ตั้งในไฟล์ .env บนเซิร์ฟเวอร์' };
// รุ่น Claude ที่ใช้อ่านหนังสือได้ (ราคาต่อ 1 ล้าน token เข้า/ออก)
const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Opus 5.5 — อ่านแม่นที่สุด ($4 / $20)' },
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 — สมดุล ($2 / $10)' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5 — ถูกที่สุด ($0.10 / $0.50)' },
];

/** ตั้งค่า AI อ่านหนังสือ (ใช้ร่วมทุก อบต.) — key ไม่ถูกส่งกลับมาที่หน้าเว็บ เห็นแค่ 4 ตัวท้าย */
export function AiSettingsCard() {
  const qc = useQueryClient();
  const { data: st } = useQuery<AiStatus>({
    queryKey: ['hub-ai-settings'],
    queryFn: () => api.get('/hub/ai-settings').then((r) => r.data.data),
  });
  const [provider, setProvider] = useState<'anthropic' | 'gemini' | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [testMsg, setTestMsg] = useState<{ ok: boolean; message: string } | null>(null);

  const current = provider ?? st?.provider ?? 'anthropic';
  const info = current === 'anthropic' ? st?.anthropic : st?.gemini;
  const keyValue = current === 'anthropic' ? anthropicKey : geminiKey;
  const setKeyValue = current === 'anthropic' ? setAnthropicKey : setGeminiKey;

  const save = useMutation({
    mutationFn: (body: Record<string, string>) => api.put('/hub/ai-settings', body).then((r) => r.data.data),
    onSuccess: (data) => {
      qc.setQueryData(['hub-ai-settings'], data);
      setAnthropicKey(''); setGeminiKey(''); setProvider(null); setModel(null); setTestMsg(null);
      toast.success('บันทึกแล้ว');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'บันทึกไม่สำเร็จ')),
  });
  const test = useMutation({
    mutationFn: () => api.post('/hub/ai-settings/test', { provider: current }).then((r) => r.data.data),
    onSuccess: (r) => setTestMsg(r),
    onError: (e) => setTestMsg({ ok: false, message: getErrorMessage(e, 'ทดสอบไม่สำเร็จ') }),
  });

  const onSave = () => {
    const body: Record<string, string> = {};
    if (provider && provider !== st?.provider) body.provider = provider;
    if (model && model !== st?.model) body.model = model;
    if (anthropicKey.trim()) body.anthropicKey = anthropicKey.trim();
    if (geminiKey.trim()) body.geminiKey = geminiKey.trim();
    if (!Object.keys(body).length) { toast.error('ยังไม่ได้เปลี่ยนอะไร'); return; }
    save.mutate(body);
  };
  const onRemove = () => {
    if (!confirm('ลบ key ที่ตั้งไว้ในหน้านี้? (ถ้ามีค่าในไฟล์ .env ระบบจะกลับไปใช้ค่านั้น)')) return;
    save.mutate(current === 'anthropic' ? { anthropicKey: '' } : { geminiKey: '' });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Sparkles className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold text-slate-900">AI อ่านหนังสือ (หน้าลงรับสารบรรณ)</h2>
            <p className="text-sm text-slate-500">ใช้ร่วมทุกหน่วยงาน · ค่าใช้จ่าย AI คิดกับบัญชีของ key นี้</p>
          </div>
        </div>
        {st && (info?.configured
          ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><Check className="h-3.5 w-3.5" /> พร้อมใช้</span>
          : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> ยังไม่ได้ตั้ง key — เจ้าหน้าที่ต้องกรอกเอง</span>)}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]">
        <div>
          <Label>ผู้ให้บริการ</Label>
          <select value={current} onChange={(e) => { setProvider(e.target.value as 'anthropic' | 'gemini'); setTestMsg(null); }}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="anthropic">Claude (Anthropic)</option>
            <option value="gemini">Gemini (Google)</option>
          </select>
          {current === 'anthropic' ? (
            <>
              <Label className="mt-3 block">รุ่น</Label>
              <select value={model ?? st?.model ?? 'claude-opus-5-5'} onChange={(e) => { setModel(e.target.value); setTestMsg(null); }}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {CLAUDE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                {st?.model && !CLAUDE_MODELS.some((m) => m.id === st.model) && <option value={st.model}>{st.model}</option>}
              </select>
            </>
          ) : (
            <p className="mt-1 text-xs text-slate-500">รุ่น: {st?.geminiModel}</p>
          )}
        </div>
        <div>
          <Label htmlFor="ai-key">API key {current === 'anthropic' ? '(ขึ้นต้นด้วย sk-ant-)' : ''}</Label>
          <div className="mt-1 flex gap-2">
            <div className="relative flex-1">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input id="ai-key" type="password" autoComplete="off" value={keyValue} onChange={(e) => setKeyValue(e.target.value)}
                placeholder={info?.configured ? `ตั้งไว้แล้ว ${info.hint ?? ''} · พิมพ์ใหม่เพื่อเปลี่ยน` : 'วาง API key ที่นี่'} className="pl-9" />
            </div>
          </div>
          {info?.configured && (
            <p className="mt-1 text-xs text-slate-500">
              key ที่ใช้อยู่ {info.hint} · {SOURCE[info.source || ''] || ''}
              {info.updatedAt ? ` · แก้ล่าสุด ${new Date(info.updatedAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={onSave} disabled={save.isPending}>{save.isPending ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
        <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending || !info?.configured || !!keyValue.trim()}
          title={keyValue.trim() ? 'บันทึกก่อนแล้วค่อยทดสอบ' : ''}>
          {test.isPending ? 'กำลังทดสอบ…' : 'ทดสอบ key'}
        </Button>
        {info?.source === 'hub' && (
          <Button variant="ghost" onClick={onRemove} disabled={save.isPending} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">ลบ key</Button>
        )}
        {testMsg && (
          <span className={`text-sm ${testMsg.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{testMsg.ok ? '✓ ' : '✗ '}{testMsg.message}</span>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500">key ถูกเข้ารหัสก่อนเก็บ และไม่ถูกส่งกลับมาที่หน้าเว็บ · ตั้งได้เฉพาะบัญชีเจ้าของระบบ · ทุกครั้งที่เปลี่ยนจะถูกบันทึกในประวัติกิจกรรม</p>
    </div>
  );
}
