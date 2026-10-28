'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Newspaper, Calendar, Pin } from 'lucide-react';
import { api } from '@/lib/api';
import { NewsItem, NEWS_CATEGORIES, NEWS_TONE, normUrl, thaiDate } from './news-shared';
import { BackLink } from '../cz-ui';

export default function CitizenNewsList() {
  const [cat, setCat] = useState<string>('');
  const { data, isLoading } = useQuery<NewsItem[]>({
    queryKey: ['citizen-news'],
    queryFn: async () => (await api.get('/citizen/news', { params: { limit: 50 } })).data.data,
  });
  const items = useMemo(() => (cat ? (data || []).filter((n) => n.category === cat) : (data || [])), [data, cat]);

  return (
    <div className="cz-anim-in">
      <BackLink href="/citizen">กลับหน้าแรก</BackLink>

      <div className="mb-6 text-center">
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-slate-800">
          <Newspaper className="h-7 w-7 text-cyan-500" /> ข่าว / ประกาศ
        </h1>
        <p className="mt-1 text-sm text-slate-500">ข่าวประชาสัมพันธ์ ประกาศ และกิจกรรมของ อบต.</p>
      </div>

      {/* ตัวกรองหมวด */}
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        <Chip active={!cat} onClick={() => setCat('')}>ทั้งหมด</Chip>
        {NEWS_CATEGORIES.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse overflow-hidden rounded-2xl border border-slate-100 bg-white">
              <div className="aspect-[16/10] bg-slate-100" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-20 rounded-full bg-slate-100" />
                <div className="h-4 w-3/4 rounded bg-slate-100" />
                <div className="h-3 w-1/2 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-cyan-100 bg-white py-16 text-center shadow-sm">
          <Megaphone className="mx-auto mb-2 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400">ยังไม่มีข่าว/ประกาศในหมวดนี้</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((n) => <NewsCard key={n.id} n={n} />)}
        </div>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-4 py-1.5 text-sm transition ${active ? 'border-cyan-500 bg-cyan-50 font-semibold text-cyan-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
      {children}
    </button>
  );
}

function NewsCard({ n }: { n: NewsItem }) {
  const tone = NEWS_TONE[n.category] || NEWS_TONE['ประกาศทั่วไป'];
  return (
    <Link href={`/citizen/news/${n.id}`}
      className="cz-anim-up group flex flex-col overflow-hidden rounded-2xl border border-cyan-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        {n.coverUrl
          ? <img src={normUrl(n.coverUrl)} alt={n.title} className="h-full w-full object-cover transition group-hover:scale-105" />
          : <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-cyan-50 to-sky-100"><Newspaper className="h-10 w-10 text-cyan-300" /></div>}
        {n.pinned && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow"><Pin className="h-3 w-3" /> ปักหมุด</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <span className={`mb-2 inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${tone}`}>{n.category}</span>
        <h2 className="line-clamp-2 font-bold leading-snug text-slate-800 group-hover:text-cyan-700">{n.title}</h2>
        {n.excerpt && <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">{n.excerpt}</p>}
        <span className="mt-auto flex items-center gap-1.5 pt-3 text-xs text-slate-400"><Calendar className="h-3.5 w-3.5" /> {thaiDate(n.publishedAt || n.createdAt)}</span>
      </div>
    </Link>
  );
}
