'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Newspaper } from 'lucide-react';
import { api } from '@/lib/api';
import { NewsItem, NEWS_TONE, normUrl, thaiDate } from '../news-shared';
import { BackLink } from '../../cz-ui';

export default function CitizenNewsDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: n, isLoading, isError } = useQuery<NewsItem>({
    queryKey: ['citizen-news', id],
    queryFn: async () => (await api.get(`/citizen/news/${id}`)).data.data,
    enabled: !!id,
  });

  return (
    <div className="cz-anim-in mx-auto max-w-3xl">
      <BackLink href="/citizen/news">กลับหน้าข่าว</BackLink>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-slate-400">กำลังโหลด…</p>
      ) : isError || !n ? (
        <div className="rounded-3xl border border-cyan-100 bg-white py-16 text-center shadow-sm">
          <Newspaper className="mx-auto mb-2 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-400">ไม่พบข่าวนี้ หรือยังไม่เผยแพร่</p>
        </div>
      ) : (
        <article className="overflow-hidden rounded-3xl border border-cyan-100 bg-white shadow-sm">
          {n.coverUrl && (
            <img src={normUrl(n.coverUrl)} alt={n.title} className="max-h-[420px] w-full object-cover" />
          )}
          <div className="p-6 sm:p-8">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${NEWS_TONE[n.category] || NEWS_TONE['ประกาศทั่วไป']}`}>{n.category}</span>
            <h1 className="mt-3 text-2xl font-bold leading-snug text-slate-800 sm:text-3xl">{n.title}</h1>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-400"><Calendar className="h-4 w-4" /> {thaiDate(n.publishedAt || n.createdAt)}</p>
            {n.excerpt && <p className="mt-4 rounded-2xl bg-cyan-50/60 p-4 text-slate-600">{n.excerpt}</p>}
            {n.content && <div className="mt-5 whitespace-pre-wrap leading-relaxed text-slate-700">{n.content}</div>}
          </div>
        </article>
      )}
    </div>
  );
}
