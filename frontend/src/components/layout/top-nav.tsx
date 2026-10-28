'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import {
  Bell, LogOut, Building2, Search, Type, Sun, Moon, Palette, Volume2, VolumeX, Menu,
  CheckCheck, Trash2, FileCheck, CalendarClock, MessageSquareWarning, CalendarDays, Mail,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn, formatThaiDateTime } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthStore, logoutAction } from '@/stores/auth.store';
import { useNotificationStore } from '@/stores/notification.store';
import { useCommandPaletteStore } from '@/stores/command-palette.store';
import { useAccessibility, THEMES, FONTS } from '@/contexts/accessibility.context';

const FONT_SIZES = [
  { key: 'normal' as const, label: 'ก', title: 'ขนาดปกติ', size: 'text-xs' },
  { key: 'large' as const, label: 'ก', title: 'ขนาดใหญ่', size: 'text-sm' },
  { key: 'xlarge' as const, label: 'ก', title: 'ขนาดใหญ่มาก', size: 'text-base' },
];

/** เสียงแจ้งเตือน "ติ๊ง-ต่อง" (Web Audio) */
function playNotifyBeep() {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(g); g.connect(master);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.02);
    };
    beep(988, 0, 0.18);
    beep(1319, 0.18, 0.32);
    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch { /* ไม่รองรับ */ }
}

// หมวดหมู่การแจ้งเตือน — แยกสีชัดเจนต่อหมวด (แถบสีซ้าย + ไอคอนวงกลม + ป้ายหมวด)
type NotifCat = 'approval' | 'meeting' | 'complaint' | 'leave' | 'correspondence' | 'default';
const NOTIF_CATEGORY: Record<NotifCat, { icon: any; bar: string; iconBg: string; iconColor: string; chip: string; label: string }> = {
  approval:       { icon: FileCheck,             bar: 'bg-violet-500', iconBg: 'bg-violet-100', iconColor: 'text-violet-600', chip: 'bg-violet-100 text-violet-700', label: 'อนุมัติ' },
  meeting:        { icon: CalendarClock,         bar: 'bg-sky-500',    iconBg: 'bg-sky-100',    iconColor: 'text-sky-600',    chip: 'bg-sky-100 text-sky-700',       label: 'ประชุม' },
  complaint:      { icon: MessageSquareWarning,  bar: 'bg-orange-500', iconBg: 'bg-orange-100', iconColor: 'text-orange-600', chip: 'bg-orange-100 text-orange-700', label: 'ร้องเรียน' },
  leave:          { icon: CalendarDays,          bar: 'bg-green-500',  iconBg: 'bg-green-100',  iconColor: 'text-green-600',  chip: 'bg-green-100 text-green-700',   label: 'การลา' },
  correspondence: { icon: Mail,                  bar: 'bg-indigo-500', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', chip: 'bg-indigo-100 text-indigo-700', label: 'สารบรรณ' },
  default:        { icon: Bell,                  bar: 'bg-gray-400',   iconBg: 'bg-gray-100',   iconColor: 'text-gray-500',   chip: 'bg-gray-100 text-gray-600',     label: 'ทั่วไป' },
};
function notifCategoryOf(type?: string): NotifCat {
  const head = type?.split(':')[0];
  if (head === 'approval' || head === 'meeting' || head === 'complaint' || head === 'leave' || head === 'correspondence') return head;
  return 'default';
}

/** แถบบนสุด (gradient) — โลโก้ + ค้นหา + เครื่องมือ + แจ้งเตือน + โปรไฟล์ (เมนูหลักอยู่ที่ Sidebar ด้านข้าง) */
export function TopNav({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const openPalette = useCommandPaletteStore((s) => s.open);
  const { unreadCount, setUnreadCount } = useNotificationStore();
  const { fontSize, mode, theme, font, setFontSize, setMode, setTheme, setFont } = useAccessibility();
  const qc = useQueryClient();

  const [themeOpen, setThemeOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const prevCountRef = useRef<number | null>(null);

  // กระดิ่งสั่นต่อเนื่องตราบใดที่ยังมีแจ้งเตือนที่ยังไม่อ่าน (หยุดเมื่อเปิดป๊อปอัปอ่าน)
  const bellRinging = unreadCount > 0 && !notifOpen;

  // โลโก้หน่วยงาน (ถ้าอัปโหลดไว้ในตั้งค่า)
  const { data: org } = useQuery({
    queryKey: ['organization', user?.organizationId],
    queryFn: async () => (await api.get(`/organizations/${user?.organizationId}`)).data.data,
    enabled: !!user?.organizationId,
    staleTime: 5 * 60_000,
  });

  useEffect(() => { setSoundOn(localStorage.getItem('sg-notif-sound') !== 'off'); }, []);

  // ── นับแจ้งเตือนที่ยังไม่อ่าน + เล่นเสียงเมื่อมีใหม่ ──
  useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const { data } = await api.get('/notifications/unread-count');
      const count = data.data.count as number;
      if (prevCountRef.current !== null && count > prevCountRef.current && soundOn) playNotifyBeep();
      prevCountRef.current = count;
      setUnreadCount(count);
      return count;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  // ── แจ้งเตือน real-time ผ่าน WebSocket ──
  useEffect(() => {
    if (!user || !accessToken) return;
    // เหมือน use-socket.ts — ห้าม fallback เป็น localhost เด็ดขาด ไม่งั้นโดน CSP บล็อกบน prod จริง
    const wsUrlEnv = process.env.NEXT_PUBLIC_API_URL || '/v1';
    const base = wsUrlEnv.startsWith('http')
      ? wsUrlEnv.replace(/\/v1\/?$/, '')
      : window.location.origin;
    let socket: Socket | null = null;
    try {
      socket = io(`${base}/ws`, { auth: { token: accessToken }, transports: ['websocket'], reconnection: true });
      socket.on('notification:new', () => {
        qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
        qc.invalidateQueries({ queryKey: ['notifications', 'popup'] });
        qc.invalidateQueries({ queryKey: ['my-tasks'] });
        if (localStorage.getItem('sg-notif-sound') !== 'off') playNotifyBeep();
      });
    } catch { /* ws ไม่พร้อม */ }
    return () => { socket?.disconnect(); };
  }, [user, accessToken, qc]);

  // ── รายการแจ้งเตือนสำหรับป๊อปอัป (ดึงเมื่อเปิดเท่านั้น) ──
  const { data: notifList, isLoading: notifLoading } = useQuery({
    queryKey: ['notifications', 'popup'],
    queryFn: async () => {
      const { data } = await api.get('/notifications', { params: { limit: 20 } });
      return (data.data ?? []) as any[];
    },
    enabled: !!user && notifOpen,
    refetchInterval: notifOpen ? 30_000 : false,
  });

  const invalidateNotif = () => {
    qc.invalidateQueries({ queryKey: ['notifications', 'popup'] });
    qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
  };
  const markAllRead = useMutation({ mutationFn: () => api.put('/notifications/read-all'), onSuccess: invalidateNotif });
  const markRead = useMutation({ mutationFn: (id: string) => api.put(`/notifications/${id}/read`), onSuccess: invalidateNotif });
  const deleteNotif = useMutation({ mutationFn: (id: string) => api.delete(`/notifications/${id}`), onSuccess: invalidateNotif });

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    localStorage.setItem('sg-notif-sound', next ? 'on' : 'off');
    if (next) playNotifyBeep();
  };

  async function handleLogout() { await logoutAction(); router.push('/login?staff=1'); }

  return (
    <div className="no-print shrink-0 z-30 bg-blue-700">
      <div className="flex items-center gap-3 px-4 h-16">
        {/* ปุ่มเมนู (เฉพาะมือถือ/แท็บเล็ต) */}
        <button onClick={onMenuClick} aria-label="เปิดเมนู"
          className="lg:hidden p-2 -ml-1 rounded-full text-white/90 hover:bg-white/15 transition-colors shrink-0">
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        {/* โลโก้ + แบรนด์ระบบ */}
        <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0">
          {/* ตรา อบต. (ส่วนใหญ่วงกลม) → วงกลมเต็มกรอบ (ไม่มีขอบขาว) · ไม่มีโลโก้ = ไอคอนในกรอบโปร่งเดิม */}
          <div className={org?.logoUrl
            ? 'w-11 h-11 rounded-full flex items-center justify-center overflow-hidden shrink-0'
            : 'w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center overflow-hidden shrink-0'} aria-hidden>
            {org?.logoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={org.logoUrl} alt="โลโก้หน่วยงาน" className="w-full h-full rounded-full object-cover" />
              : <Building2 className="h-6 w-6 text-white" />}
          </div>
          <div className="hidden sm:block min-w-0">
            {/* ชื่อย่อ อบต. จากข้อมูลองค์กร (ตั้งที่ /hub หรือ /settings) — ยังไม่มีข้อมูลใช้ชื่อระบบ */}
            <p className="text-sm font-bold text-white leading-tight">{org?.nameTh ? org.nameTh.replace(/^องค์การบริหารส่วนตำบล\s*/, 'อบต.') : 'Smart SAO'}</p>
            <p className="text-[11px] text-white/80 leading-tight">ระบบบริหารงานภายใน</p>
          </div>
        </Link>

        {/* ชื่อหน่วยงาน + กระดิ่งแจ้งเตือน — กลาง top bar */}
        <div className="flex-1 flex justify-center items-center gap-4 sm:gap-6 px-2 min-w-0">
          {org?.nameTh && (
            <span className="truncate text-lg sm:text-2xl font-bold text-white tracking-tight">{org.nameTh}</span>
          )}
          {/* กระดิ่ง (สีเหลือง ใหญ่) + ป๊อปอัปแจ้งเตือน */}
          <div className="relative shrink-0">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              aria-label={`การแจ้งเตือน${unreadCount > 0 ? ` (${unreadCount} ยังไม่อ่าน)` : ''}`}
              aria-expanded={notifOpen}
              className="relative p-2.5 rounded-full transition-colors"
            >
              <Bell className={cn('h-8 w-8 text-yellow-300 fill-yellow-300/30 drop-shadow', bellRinging && 'bell-ring')} aria-hidden />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white/70" aria-hidden>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} aria-hidden />
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-1.5rem)] max-w-md bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden text-left">
                  {/* หัวป๊อปอัป */}
                  <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-blue-600" aria-hidden />
                      <p className="font-bold text-gray-900 text-base">
                        การแจ้งเตือน
                        {unreadCount > 0 && <span className="ml-2 align-middle text-xs font-bold bg-red-500 text-white rounded-full px-2 py-0.5">{unreadCount}</span>}
                      </p>
                    </div>
                    {unreadCount > 0 && (
                      <button onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50">
                        <CheckCheck className="h-4 w-4" /> อ่านทั้งหมด
                      </button>
                    )}
                  </div>

                  {/* รายการ */}
                  <div className="max-h-[75vh] sm:max-h-[28rem] overflow-y-auto">
                    {notifLoading ? (
                      <div className="p-3 space-y-2">
                        {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
                      </div>
                    ) : !notifList?.length ? (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <Bell className="h-10 w-10 mb-2 opacity-30" aria-hidden />
                        <p className="text-sm">ไม่มีการแจ้งเตือน</p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-100">
                        {notifList.map((n: any) => {
                          const cat = NOTIF_CATEGORY[notifCategoryOf(n.type)];
                          const CatIcon = cat.icon;
                          return (
                            <li key={n.id} className="relative flex items-start gap-3 px-5 py-4 bg-white hover:bg-gray-50 transition-colors">
                              {/* แถบสีหมวดด้านซ้าย */}
                              <span className={cn('absolute left-0 top-0 bottom-0 w-1.5', cat.bar)} aria-hidden />
                              {/* ไอคอนวงกลมสีหมวด */}
                              <div className={cn('mt-0.5 shrink-0 w-10 h-10 rounded-full flex items-center justify-center', cat.iconBg)}>
                                <CatIcon className={cn('h-5 w-5', cat.iconColor)} aria-hidden />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', cat.chip)}>{cat.label}</span>
                                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden />}
                                </div>
                                <p className={cn('text-sm leading-snug mt-1', n.isRead ? 'text-gray-600' : 'font-semibold text-gray-900')}>{n.title}</p>
                                {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                                {n.actionUrl && (
                                  <Link href={n.actionUrl} onClick={() => { if (!n.isRead) markRead.mutate(n.id); setNotifOpen(false); }}
                                    className="text-xs font-medium text-blue-600 hover:underline mt-1 inline-block">ดูรายละเอียด →</Link>
                                )}
                                <p className="text-[11px] text-gray-400 mt-1">{formatThaiDateTime(n.createdAt)}</p>
                              </div>
                              <div className="flex flex-col gap-1 shrink-0">
                                {!n.isRead && (
                                  <button onClick={() => markRead.mutate(n.id)} title="ทำเครื่องหมายว่าอ่านแล้ว"
                                    className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-500"><CheckCheck className="h-3.5 w-3.5" /></button>
                                )}
                                <button onClick={() => deleteNotif.mutate(n.id)} title="ลบ"
                                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* ขนาดตัวอักษร */}
          <div className="hidden lg:flex items-center gap-0.5 rounded-full p-0.5 bg-white/15" title="ขนาดตัวอักษร">
            <Type className="h-3 w-3 text-white/80 mx-1 shrink-0" />
            {FONT_SIZES.map((f) => (
              <button
                key={f.key}
                onClick={() => setFontSize(f.key)}
                title={f.title}
                aria-pressed={fontSize === f.key}
                className={cn('px-2 py-0.5 rounded-full font-bold transition-colors', f.size,
                  fontSize === f.key ? 'bg-white text-blue-700' : 'text-white/90 hover:bg-white/15')}
              >{f.label}</button>
            ))}
          </div>

          {/* ค้นหาด่วน Ctrl+K */}
          <button onClick={openPalette} title="ค้นหาด่วน (Ctrl+K)" aria-label="ค้นหาด่วน"
            className="p-2 rounded-full text-white/90 hover:bg-white/15 transition-colors">
            <Search className="h-4 w-4" aria-hidden />
          </button>

          {/* ธีมสี */}
          <div className="relative">
            <button onClick={() => setThemeOpen((v) => !v)} title="เปลี่ยนสีธีม" aria-label="เปลี่ยนสีธีม"
              className="p-2 rounded-full text-white/90 hover:bg-white/15 transition-colors">
              <Palette className="h-4 w-4" aria-hidden />
            </button>
            {themeOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setThemeOpen(false)} aria-hidden />
                <div className="absolute right-0 top-full mt-2 z-50 w-52 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 max-h-[80vh] overflow-y-auto">
                  <p className="text-xs text-gray-400 px-2 py-1">โหมดการแสดงผล</p>
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    {([{ key: 'light' as const, label: 'สว่าง', Icon: Sun }, { key: 'dark' as const, label: 'มืด', Icon: Moon }]).map(({ key, label, Icon }) => (
                      <button key={key} onClick={() => setMode(key)} aria-pressed={mode === key}
                        className={cn('flex items-center justify-center gap-1.5 px-2 py-2 rounded-xl text-sm transition-colors border',
                          mode === key ? 'bg-blue-600 text-white border-blue-600 font-semibold' : 'text-gray-600 border-gray-200 hover:bg-gray-50')}
                      ><Icon className="h-4 w-4" aria-hidden />{label}</button>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 px-2 py-1">เลือกสีธีม</p>
                  {THEMES.map((t) => (
                    <button key={t.key} onClick={() => { setTheme(t.key); }}
                      className={cn('w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm transition-colors',
                        theme === t.key ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-600 hover:bg-gray-50')}
                    >
                      <span className="h-4 w-4 rounded-full border border-black/10 shrink-0" style={{ backgroundColor: t.swatch }} aria-hidden />
                      {t.label}
                      {theme === t.key && <span className="ml-auto font-bold" style={{ color: t.swatch }} aria-hidden>✓</span>}
                    </button>
                  ))}

                  {/* เลือกฟอนต์ (preview ด้วยฟอนต์ตัวเอง) */}
                  <p className="text-xs text-gray-400 px-2 py-1 mt-1 border-t border-gray-100 pt-2">ฟอนต์ตัวอักษร</p>
                  {FONTS.map((ft) => (
                    <button key={ft.key} onClick={() => { setFont(ft.key); }}
                      style={{ fontFamily: ft.cssVar }}
                      className={cn('w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-sm transition-colors',
                        font === ft.key ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-600 hover:bg-gray-50')}
                    >
                      <span className="flex-1 text-left leading-snug">
                        {ft.label}
                        <span className="block text-xs text-gray-400">กขคง 0123 สารบรรณ</span>
                      </span>
                      {font === ft.key && <span className="ml-auto font-bold text-blue-600" aria-hidden>✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* สลับสว่าง/มืด */}
          <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} aria-label="สลับโหมดสว่าง/มืด"
            title={mode === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
            className="p-2 rounded-full text-white/90 hover:bg-white/15 transition-colors">
            {mode === 'dark' ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
          </button>

          {/* เสียงแจ้งเตือน */}
          <button onClick={toggleSound} aria-pressed={soundOn} aria-label={soundOn ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน'}
            title={soundOn ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน'}
            className="p-2 rounded-full text-white/90 hover:bg-white/15 transition-colors">
            {soundOn ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
          </button>

          {/* โปรไฟล์ */}
          <Link href="/profile" className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-white/15 transition-colors" aria-label="โปรไฟล์ของฉัน">
            <div className="w-8 h-8 rounded-full bg-white text-blue-700 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden" aria-hidden>
              {user?.avatarUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={user.avatarUrl} alt="รูปโปรไฟล์" className="w-full h-full object-cover" />
                : (user?.fullNameTh?.charAt(0) ?? '?')}
            </div>
            <div className="hidden xl:block text-left">
              <p className="text-xs font-semibold text-white leading-tight">{user?.fullNameTh}</p>
              <p className="text-[11px] text-white/80 leading-tight">{user?.positionName || ''}</p>
            </div>
          </Link>

          {/* ออกจากระบบ */}
          <button onClick={handleLogout} title="ออกจากระบบ" aria-label="ออกจากระบบ"
            className="p-2 rounded-full text-white/90 hover:bg-white/15 transition-colors">
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
