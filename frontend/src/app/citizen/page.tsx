'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Phone, Clock, ArrowRight, LayoutGrid, FileSearch,
  FileEdit, UserCheck, Search, Newspaper, Calendar,
  Pin, ChevronLeft, ChevronRight, Copy, Check, MessageSquareText,
} from 'lucide-react';
import { api } from '@/lib/api';
import { NewsItem, NEWS_TONE, normUrl, thaiDate } from './news/news-shared';
import { SERVICE_GROUPS, ServiceTiles } from './service-grid';
import { BOX, SectionHead } from './cz-ui';
import { LineIcon, FacebookIcon, MapPinIcon } from './brand-icons';

type Contact = { lineId?: string | null; lineUrl?: string | null; facebookUrl?: string | null; mapUrl?: string | null; hours?: string | null };
type Brand = { nameTh?: string; phone?: string | null; address?: string | null; province?: string | null; contact?: Contact } | null;

const DEFAULT_HOURS = 'จันทร์–ศุกร์ 08:30–16:30 น.';

/** ขั้นตอนใช้บริการ (One Stop Service) */
const STEPS = [
  { icon: LayoutGrid, title: 'เลือกบริการ', sub: 'จากรายการบริการออนไลน์' },
  { icon: FileEdit, title: 'กรอกแบบฟอร์ม', sub: 'แนบรูป/ปักหมุดตำแหน่งได้' },
  { icon: UserCheck, title: 'เจ้าหน้าที่รับเรื่อง', sub: 'พิจารณาและดำเนินการ' },
  { icon: Search, title: 'ติดตามสถานะ', sub: 'ด้วยชื่อและเบอร์โทร' },
];

/** แบบประเมินความพึงพอใจ — กดแล้วไปที่แบบฟอร์มความเห็นจริง (k24) */
const MOODS = [
  { n: 1, label: 'ปรับปรุง' },
  { n: 2, label: 'พอใช้' },
  { n: 3, label: 'ดี' },
  { n: 4, label: 'ดีมาก' },
  { n: 5, label: 'ดีเยี่ยม' },
];

export default function CitizenHome() {
  const [brand, setBrand] = useState<Brand>(null);
  useEffect(() => {
    api.get('/organizations/by-host').then((r) => { if (r.data?.data?.found) setBrand(r.data.data); }).catch(() => {});
  }, []);

  return (
    <div>
      {/* HERO — ภาพจริงเป็นพื้นหลังเต็มกล่อง + ม่านฟ้าอ่อน (จอใหญ่ไล่สีฝั่งซ้าย · มือถือทั้งกล่อง) ให้ตัวอักษรเข้มอ่านออก */}
      <section id="top" className="relative mx-auto max-w-6xl overflow-hidden rounded-[24px] border border-[#DCEBF8] bg-[#EAF5FE] max-[720px]:rounded-2xl">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/citizen/hero.jpg')" }} aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#EAF5FE] via-[#EAF5FE]/90 to-[#EAF5FE]/0 max-[720px]:bg-[#EAF5FE]/88" aria-hidden="true" />
        <div className="relative flex max-w-xl flex-col gap-5 px-12 py-16 max-[720px]:gap-4 max-[720px]:px-5 max-[720px]:py-8">
          <h1 className="text-[46px] font-bold leading-[1.18] tracking-[-0.01em] text-[#0F2A44] max-[720px]:text-[30px]">
            ทำธุระกับ อบต.<br />ได้เอง <span className="text-sky-600">ทุกที่ 24 ชม.</span>
          </h1>
          <p className="text-lg leading-relaxed text-[#475569] max-[720px]:text-[15px]">
            ชำระค่าน้ำ แจ้งเรื่อง และติดตามสถานะได้ในที่เดียว ไม่ต้องเดินทาง
          </p>
          <div className="mt-2 flex flex-wrap gap-3 max-[720px]:mt-1 max-[720px]:grid max-[720px]:grid-cols-2 max-[720px]:gap-2">
            <Link href="#services"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-sky-600 px-7 text-lg font-semibold text-white transition hover:bg-sky-700 max-[720px]:min-h-[48px] max-[720px]:px-3 max-[720px]:text-[15px]">
              <LayoutGrid className="h-5 w-5" /> เลือกบริการ
            </Link>
            <Link href="/citizen/track"
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-[#CFE4F6] bg-white px-7 text-lg font-semibold text-[#0F2A44] transition hover:border-sky-400 max-[720px]:min-h-[48px] max-[720px]:px-3 max-[720px]:text-[15px]">
              <FileSearch className="h-5 w-5 text-sky-600" /> ติดตามสถานะ
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl">
        <div className="mt-8 flex flex-col gap-6 max-[720px]:mt-5 max-[720px]:gap-4">
          <Services />

          {/* 4 ขั้นตอน — จอใหญ่เป็นเส้นเวลาแนวนอน · มือถือเป็นเส้นเวลาแนวตั้ง */}
          <section className={BOX}>
            <SectionHead title="ใช้บริการง่าย ๆ ใน 4 ขั้นตอน" />
            <ol className="relative grid grid-cols-4 gap-6 max-[720px]:grid-cols-1 max-[720px]:gap-0">
              {/* เส้นเชื่อมระหว่างขั้น */}
              <span className="absolute left-[12.5%] right-[12.5%] top-7 h-0.5 bg-[#DCEBF8] max-[720px]:hidden" aria-hidden="true" />
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <li key={i} className="relative flex flex-col items-center gap-3 text-center max-[720px]:flex-row max-[720px]:items-start max-[720px]:gap-3.5 max-[720px]:pb-5 max-[720px]:text-left max-[720px]:last:pb-0">
                    {i < STEPS.length - 1 && <span className="absolute left-6 top-12 hidden h-[calc(100%-3rem)] w-0.5 bg-[#DCEBF8] max-[720px]:block" aria-hidden="true" />}
                    <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-white bg-sky-50 text-sky-600 ring-1 ring-[#CFE4F6] max-[720px]:h-12 max-[720px]:w-12 max-[720px]:border-2">
                      <Icon className="h-6 w-6 max-[720px]:h-5 max-[720px]:w-5" />
                      <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white ring-2 ring-white max-[720px]:h-5 max-[720px]:w-5 max-[720px]:text-[11px]" aria-hidden="true">{i + 1}</span>
                      <span className="sr-only">ขั้นตอนที่ {i + 1}</span>
                    </span>
                    <span className="flex min-w-0 flex-col leading-snug max-[720px]:pt-1.5">
                      <strong className="text-[18px] font-semibold text-[#0F2A44] max-[720px]:text-[16px]">{s.title}</strong>
                      <small className="text-[15px] text-[#64748B] max-[720px]:text-[13px]">{s.sub}</small>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* ข่าวประชาสัมพันธ์ */}
          <section id="news" className={`scroll-mt-4 ${BOX}`}>
            <SectionHead title="ข่าวประชาสัมพันธ์"
              aside={<Link href="/citizen/news" className="flex min-h-11 items-center gap-1 whitespace-nowrap font-semibold text-sky-600 hover:underline max-[720px]:text-[14px]">ดูทั้งหมด <ArrowRight className="h-4 w-4" /></Link>} />
            <NewsPreview />
          </section>

          {/* ติดต่อ + แบบประเมิน — จอใหญ่ 2 กล่องคู่กัน สูงเท่ากัน · มือถือเรียงลง */}
          <div id="contact" className="grid scroll-mt-4 grid-cols-[1.25fr_1fr] gap-6 max-[900px]:grid-cols-1 max-[720px]:gap-4">
            <ContactCard brand={brand} />

            <section className={`flex flex-col ${BOX}`}>
              <SectionHead title="วันนี้ใช้บริการเป็นอย่างไรบ้าง" sub="ให้คะแนนสั้น ๆ เพื่อช่วยเราปรับปรุงบริการ" />
              <div className="grid grid-cols-5 gap-2 max-[720px]:gap-1.5" role="group" aria-label="ให้คะแนนความพึงพอใจ">
                {MOODS.map((m) => (
                  <Link key={m.n} href={`/citizen/forms/k24?score=${m.n}`}
                    className="group flex min-h-[108px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-[#DCEBF8] bg-[#F7FBFF] p-1.5 text-center text-[#0F2A44] transition hover:-translate-y-0.5 hover:border-sky-600 hover:bg-sky-600 hover:text-white max-[720px]:min-h-[68px] max-[720px]:rounded-lg max-[720px]:p-1">
                    <b className="text-[26px] font-bold leading-none max-[720px]:text-xl">{m.n}</b>
                    <span className="text-[13px] font-medium leading-tight text-[#64748B] group-hover:text-white/90 max-[720px]:text-[11px]">{m.label}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-auto pt-5 max-[720px]:pt-4">
                <Link href="/citizen/forms/k24"
                  className="flex items-center justify-between gap-3 rounded-xl bg-[#F5FAFF] px-4 py-3.5 transition hover:bg-[#EAF5FE]">
                  <span className="flex items-center gap-3">
                    <MessageSquareText className="h-5 w-5 shrink-0 text-sky-600" />
                    <span className="leading-snug">
                      <strong className="block font-semibold text-[#0F2A44] max-[720px]:text-[15px]">มีข้อเสนอแนะเพิ่มเติม?</strong>
                      <small className="block text-[13px] text-[#64748B]">เขียนถึง อบต. ได้โดยตรง</small>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-sky-600" />
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/** บริการออนไลน์ — การ์ด 2×2 + ลิงก์ "ดูทั้งหมด" ไปหน้ารวมบริการ */
function Services() {
  // ปัดทีละหน้า — 1 หน้า = 1 หมวด (การ์ด 2×2) เห็นทีละ 4 ก้อน · จุดด้านล่างบอกหน้า/กดข้ามหน้าได้ · จอใหญ่มีปุ่มลูกศรด้วย
  const scroller = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const last = SERVICE_GROUPS.length - 1;
  const onScroll = () => {
    const el = scroller.current;
    if (el) setPage(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goTo = (i: number) => {
    const el = scroller.current;
    if (el) el.scrollTo({ left: Math.max(0, Math.min(last, i)) * el.clientWidth, behavior: 'smooth' });
  };
  const arrow = 'flex h-10 w-10 items-center justify-center rounded-full border border-[#DCEBF8] bg-white text-sky-700 transition hover:border-sky-400 disabled:opacity-35 max-[720px]:hidden';

  return (
    <section id="services" className={`scroll-mt-4 ${BOX}`}>
      <SectionHead title="บริการออนไลน์"
        aside={<Link href="/citizen/all" className="flex min-h-11 items-center gap-1 whitespace-nowrap font-semibold text-sky-600 hover:underline max-[720px]:text-[14px]">ดูทั้งหมด <ArrowRight className="h-4 w-4" /></Link>} />
      <div ref={scroller} onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SERVICE_GROUPS.map((g) => (
          <div key={g.title} className="w-full shrink-0 snap-start">
            <h3 className="mb-3 text-[17px] font-semibold text-[#334155] max-[720px]:mb-2 max-[720px]:text-[14px]">{g.title}</h3>
            <ServiceTiles items={g.items} />
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-3 max-[720px]:mt-3">
        <button type="button" onClick={() => goTo(page - 1)} disabled={page === 0} aria-label="หน้าก่อน" className={arrow}><ChevronLeft className="h-5 w-5" /></button>
        <div className="flex gap-1.5">
          {SERVICE_GROUPS.map((g, i) => (
            <button key={g.title} type="button" onClick={() => goTo(i)} aria-label={g.title}
              className={`h-2 rounded-full transition-all ${i === page ? 'w-6 bg-sky-600' : 'w-2 bg-[#CFE4F6]'}`} />
          ))}
        </div>
        <button type="button" onClick={() => goTo(page + 1)} disabled={page === last} aria-label="หน้าถัดไป" className={arrow}><ChevronRight className="h-5 w-5" /></button>
      </div>
    </section>
  );
}

/** ติดต่อ อบต. — โลโก้จริงของแต่ละช่องทาง · ปุ่มเดียวคือ "คัดลอก" (เบอร์ / ไอดี LINE / ที่อยู่) · ช่องที่ อบต. ยังไม่ได้ตั้งจะไม่แสดง */
function ContactCard({ brand }: { brand: Brand }) {
  const c = brand?.contact || {};
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setCopied(key); setTimeout(() => setCopied((k) => (k === key ? null : k)), 1800);
  };
  const address = [brand?.address, brand?.province && !brand?.address?.includes(brand.province) ? brand.province : null].filter(Boolean).join(' ');
  const lineId = c.lineId ? (c.lineId.startsWith('@') ? c.lineId : `@${c.lineId}`) : null;
  const copyBtn = (key: string, text: string, label: string) => (
    <button type="button" onClick={() => copy(key, text)} aria-label={label}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold transition ${copied === key ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-[#CFE4F6] bg-white text-[#475569] hover:border-sky-500 hover:text-sky-700'}`}>
      {copied === key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      <span className="max-[400px]:hidden">{copied === key ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
    </button>
  );

  return (
    <section className={BOX}>
      <SectionHead title="ติดต่อ อบต." sub="เจ้าหน้าที่ตอบในวันและเวลาราชการ" />
      <ul className="divide-y divide-[#EEF5FC]">
        <Row icon={<Clock className="h-[22px] w-[22px] text-sky-600" />} label="เวลาทำการ" value={c.hours || DEFAULT_HOURS} />
        {brand?.phone && (
          <Row icon={<Phone className="h-[21px] w-[21px] text-emerald-600" />} label="โทรศัพท์" value={brand.phone} mono
            extra={copyBtn('phone', brand.phone, 'คัดลอกเบอร์โทร')} />
        )}
        {lineId && (
          <Row icon={<LineIcon className="h-7 w-7" />} label="LINE Official" value={lineId}
            extra={copyBtn('line', lineId, 'คัดลอกไอดี LINE')} />
        )}
        {c.facebookUrl && (
          <Row icon={<FacebookIcon className="h-[26px] w-[26px]" />} label="Facebook"
            value={<a href={c.facebookUrl} target="_blank" rel="noopener noreferrer" className="hover:text-sky-700 hover:underline">เพจทางการของ อบต.</a>} />
        )}
        {address && (
          <Row icon={<MapPinIcon className="h-7 w-7" />} label="ที่ทำการ" value={address} wrap
            extra={copyBtn('address', address, 'คัดลอกที่อยู่')} />
        )}
      </ul>
      <p className="sr-only" aria-live="polite">{copied ? 'คัดลอกแล้ว' : ''}</p>
    </section>
  );
}

function Row({ icon, label, value, extra, mono, wrap }: { icon: React.ReactNode; label: string; value: React.ReactNode; extra?: React.ReactNode; mono?: boolean; wrap?: boolean }) {
  return (
    <li className={`flex gap-3.5 py-4 first:pt-0 last:pb-0 max-[720px]:gap-3 max-[720px]:py-3.5 ${wrap ? 'items-start' : 'items-center'}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-[#DCEBF8]">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col leading-snug">
        <small className="text-[13px] text-[#64748B]">{label}</small>
        <strong className={`font-semibold text-[#0F2A44] ${mono ? 'text-[17px] tabular-nums tracking-wide' : ''}`}>{value}</strong>
      </span>
      {extra}
    </li>
  );
}

/** ภาพปกข่าว — ไม่มีรูป = พื้นฟ้าอ่อน + ไอคอน */
function NewsCover({ n, className }: { n: NewsItem; className: string }) {
  return n.coverUrl
    ? <img src={normUrl(n.coverUrl)} alt="" className={`object-cover ${className}`} />
    : <div className={`flex items-center justify-center bg-[#EAF5FE] text-sky-300 ${className}`}><Newspaper className="h-10 w-10" /></div>;
}

function NewsMeta({ n }: { n: NewsItem }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#64748B]">
      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${NEWS_TONE[n.category] || NEWS_TONE['ประกาศทั่วไป']}`}>{n.category}</span>
      <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {thaiDate(n.publishedAt || n.createdAt)}</span>
    </span>
  );
}

const SLIDE_MS = 5500;

/**
 * ข่าวล่าสุดบนหน้าแรก — สไลด์เลื่อนเองทุก ~5 วินาที (ปัดเองได้ / กดจุด / ลูกศร)
 * หยุดเลื่อนเมื่อเอาเมาส์ชี้ แตะ หรือโฟกัส · ไม่เลื่อนเองถ้าผู้ใช้ตั้งลดการเคลื่อนไหว (prefers-reduced-motion)
 */
function NewsPreview() {
  const { data, isLoading } = useQuery<NewsItem[]>({
    queryKey: ['citizen-news-preview'],
    queryFn: async () => (await api.get('/citizen/news', { params: { limit: 6 } })).data.data,
  });
  const news = (data || []).slice(0, 6);
  const track = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  const paused = useRef(false);

  const goTo = (i: number) => {
    const el = track.current;
    if (!el || !news.length) return;
    const n = (i + news.length) % news.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
  };
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    idxRef.current = i;
    setIdx(i);
  };

  useEffect(() => {
    if (news.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      if (!paused.current && document.visibilityState === 'visible') goTo(idxRef.current + 1);
    }, SLIDE_MS);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [news.length]);

  if (isLoading) return <div className="h-[320px] animate-pulse rounded-2xl bg-[#F5FAFF] max-[720px]:h-[360px]" />;
  if (!news.length) return (
    <div className="rounded-xl bg-[#F5FAFF] py-10 text-center text-[#64748B] max-[720px]:py-8 max-[720px]:text-[14px]">
      ยังไม่มีข่าวประกาศ — จะแสดงข่าว/ประกาศจาก อบต. ที่นี่
    </div>
  );

  const arrow = 'flex h-10 w-10 items-center justify-center rounded-full border border-[#DCEBF8] bg-white text-sky-700 transition hover:border-sky-400 max-[720px]:hidden';
  return (
    <div
      onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}
      onFocusCapture={() => { paused.current = true; }} onBlurCapture={() => { paused.current = false; }}
      onTouchStart={() => { paused.current = true; }} onTouchEnd={() => { setTimeout(() => { paused.current = false; }, 4000); }}
      aria-roledescription="carousel" aria-label="ข่าวประชาสัมพันธ์ล่าสุด">
      <div ref={track} onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {news.map((n, i) => (
          <Link key={n.id} href={`/citizen/news/${n.id}`} aria-label={`ข่าวที่ ${i + 1} จาก ${news.length}: ${n.title}`}
            className="group grid w-full shrink-0 snap-start grid-cols-[1.15fr_1fr] overflow-hidden rounded-2xl border border-[#DCEBF8] bg-white max-[720px]:grid-cols-1">
            <div className="relative overflow-hidden">
              <NewsCover n={n} className="h-[320px] w-full transition duration-500 group-hover:scale-[1.03] max-[720px]:h-[190px]" />
              {n.pinned && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-semibold text-sky-700"><Pin className="h-3.5 w-3.5" /> ข่าวเด่น</span>}
            </div>
            <div className="flex min-w-0 flex-col gap-3 p-7 max-[720px]:gap-2 max-[720px]:p-4">
              <NewsMeta n={n} />
              <strong className="line-clamp-3 text-[23px] font-semibold leading-snug text-[#0F2A44] group-hover:text-sky-700 max-[720px]:line-clamp-2 max-[720px]:text-[17px]">{n.title}</strong>
              {n.excerpt && <p className="line-clamp-3 text-[15px] leading-relaxed text-[#64748B] max-[720px]:line-clamp-2 max-[720px]:text-[13.5px]">{n.excerpt}</p>}
              <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[15px] font-semibold text-sky-700 max-[720px]:pt-0 max-[720px]:text-[14px]">
                อ่านต่อ <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
      {news.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 max-[720px]:mt-3">
          <button type="button" onClick={() => goTo(idx - 1)} aria-label="ข่าวก่อนหน้า" className={arrow}><ChevronLeft className="h-5 w-5" /></button>
          <div className="flex gap-1.5">
            {news.map((n, i) => (
              <button key={n.id} type="button" onClick={() => goTo(i)} aria-label={`ไปข่าวที่ ${i + 1}`} aria-current={i === idx}
                className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-sky-600' : 'w-2 bg-[#CFE4F6] hover:bg-sky-300'}`} />
            ))}
          </div>
          <button type="button" onClick={() => goTo(idx + 1)} aria-label="ข่าวถัดไป" className={arrow}><ChevronRight className="h-5 w-5" /></button>
        </div>
      )}
    </div>
  );
}
