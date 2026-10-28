import { api } from '@/lib/api';

export type NewsItem = {
  id: string;
  title: string;
  category: string;
  excerpt: string | null;
  content: string | null;
  coverUrl: string | null;
  status: string;
  pinned: boolean;
  publishedAt: string | null;
  createdAt: string;
};

export const NEWS_CATEGORIES = ['ข่าวประชาสัมพันธ์', 'ประกาศจัดซื้อจัดจ้าง', 'กิจกรรม', 'ประกาศทั่วไป'] as const;

/** โทนสีต่อหมวดข่าว */
export const NEWS_TONE: Record<string, string> = {
  'ข่าวประชาสัมพันธ์': 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  'ประกาศจัดซื้อจัดจ้าง': 'bg-amber-50 text-amber-700 ring-amber-200',
  'กิจกรรม': 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
  'ประกาศทั่วไป': 'bg-slate-100 text-slate-600 ring-slate-200',
};

/** origin ของ API — rewrite signed url แบบ relative ให้โหลดได้ทั้ง local/prod */
const apiOrigin = (() => {
  const b = api.defaults.baseURL || '';
  if (b.startsWith('http')) { try { return new URL(b).origin; } catch { /* noop */ } }
  return typeof window !== 'undefined' ? window.location.origin : '';
})();

export const normUrl = (u?: string | null) => {
  if (!u) return u || undefined;
  if (!u.includes('/v1/storage/files/')) return u;
  try { const p = new URL(u, apiOrigin || 'http://x'); return `${apiOrigin || p.origin}${p.pathname}${p.search}`; } catch { return u; }
};

export const thaiDate = (iso?: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
};
