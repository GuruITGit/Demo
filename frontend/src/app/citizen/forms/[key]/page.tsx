'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { FileQuestion } from 'lucide-react';
import { getForm } from '../form-config';
import { FormEngine } from '../form-engine';
import { FeedbackForm } from '../feedback-form';

export default function FormPage() {
  const params = useParams();
  const key = String(params?.key || '');
  const def = getForm(key);

  if (!def) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <FileQuestion className="mx-auto h-12 w-12 text-slate-300" />
        <p className="mt-3 font-medium text-slate-600">ยังไม่เปิดให้บริการฟอร์มนี้</p>
        <Link href="/citizen/all" className="mt-4 inline-block rounded-xl border border-cyan-200 bg-white px-5 py-2.5 text-sm font-semibold text-cyan-700 hover:bg-cyan-50">กลับรวมบริการ</Link>
      </div>
    );
  }
  // แบบประเมินความพึงพอใจ — ใช้ฟอร์มสั้นแทนแบบสอบถามยาวจากต้นฉบับ (ส่งเข้าช่องทางเดิม formKey เดิม)
  if (key === 'k24') return <FeedbackForm formKey={def.key} title={def.title} />;
  return <FormEngine def={def} />;
}
