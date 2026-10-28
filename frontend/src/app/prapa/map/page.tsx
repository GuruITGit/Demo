'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import 'leaflet/dist/leaflet.css';
import { api } from '@/lib/water-api';
import { Map as MapIcon, FileSpreadsheet, MapPin } from 'lucide-react';
import { PageHeader, SearchInput, MobileList, controlBase, btn } from '../ui';
import { TableCard, Table, THead, Th, Td, Tr, TableMessage, CodeChip, Dash } from '@/components/shared/table';
import { Pagination, usePaged } from '@/components/shared/pagination';
import { cn } from '@/lib/utils';
import type * as Leaflet from 'leaflet';

type MapPoint = { id: string; customerCode: string; fullName: string; villageNo: number | null; phone: string | null; address: string | null; gps: string; lat: number; lng: number };
type Village = { villageNo: number };

/**
 * แผนที่มาตรวัดน้ำ (GIS) — Leaflet bundle จาก npm (ไม่ใช้ CDN เพราะ CSP prod บล็อก script ภายนอก)
 * tiles (Esri/OSM) โหลดผ่าน img-src https: (CSP อนุญาต) · dynamic import กัน SSR (leaflet ใช้ window)
 * จอกว้าง: ซ้าย = รายชื่อ · ขวา = แผนที่ (กดรายชื่อ → แผนที่บินไปหมุดนั้น) · มือถือ: แผนที่อยู่บน รายชื่ออยู่ล่าง
 */
export default function PrapaMapPage() {
  const [villageNo, setVillageNo] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const layerRef = useRef<Leaflet.LayerGroup | null>(null);
  const LRef = useRef<typeof Leaflet | null>(null);
  const markerOf = useRef(new Map<string, Leaflet.Layer>()); // customerId → marker (หมุดรวมหลายบ้านใช้ marker เดียวกัน)
  const ringRef = useRef<Leaflet.CircleMarker | null>(null);

  const { data: villages } = useQuery({
    queryKey: ['water-villages'],
    queryFn: async () => (await api.get('/water/customers/villages')).data.data as Village[],
  });
  const { data: points, isLoading } = useQuery({
    queryKey: ['water-map', villageNo],
    queryFn: async () => (await api.get('/water/customers/map', { params: { villageNo: villageNo || undefined } })).data.data as MapPoint[],
  });

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return points || [];
    return (points || []).filter((p) => [p.customerCode, p.fullName, p.address, p.phone].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [points, search]);
  const { rows, pager } = usePaged(list, 50, `${villageNo}|${search}`);

  // โหลด leaflet (client) + init map
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapEl.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(mapEl.current, { preferCanvas: true }).setView([14.6, 102.6], 12);
      // แผนที่พื้นหลังเลือกได้ (มุมขวาบน) — Esri ไม่ต้องใช้ API key (CARTO ต้องใช้แล้ว)
      const esri = (svc: string, maxNativeZoom = 19) =>
        L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/${svc}/MapServer/tile/{z}/{y}/{x}`, { maxNativeZoom, maxZoom: 20, attribution: '© Esri' });
      const bases: Record<string, Leaflet.Layer> = {
        'แผนที่ (สีอ่อน)': esri('World_Topo_Map'),
        'ดาวเทียม': L.layerGroup([esri('World_Imagery', 18), esri('Reference/World_Transportation'), esri('Reference/World_Boundaries_and_Places')]),
        'แผนที่ถนน': esri('World_Street_Map'),
        'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }),
      };
      bases['แผนที่ (สีอ่อน)'].addTo(map);
      L.control.layers(bases, undefined, { position: 'topright' }).addTo(map);
      mapRef.current = map;
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // วาดจุดเมื่อข้อมูล/แผนที่พร้อม
  useEffect(() => {
    const L = LRef.current, map = mapRef.current;
    if (!ready || !L || !map || !points) return;
    if (layerRef.current) map.removeLayer(layerRef.current);
    if (ringRef.current) { map.removeLayer(ringRef.current); ringRef.current = null; }
    markerOf.current.clear();
    const group = L.layerGroup();
    const latlngs: [number, number][] = [];
    // ยุบจุดที่พิกัดเดียวกัน (ข้อมูลนำเข้าหยาบซ้อนกัน) เป็น marker เดียว + จำนวน
    const groups = new Map<string, { lat: number; lng: number; items: MapPoint[] }>();
    for (const p of points) {
      if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
      const key = `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
      if (!groups.has(key)) groups.set(key, { lat: p.lat, lng: p.lng, items: [] });
      groups.get(key)!.items.push(p);
    }
    for (const g of groups.values()) {
      latlngs.push([g.lat, g.lng]);
      const n = g.items.length;
      let m: Leaflet.CircleMarker | Leaflet.Marker;
      if (n === 1) {
        const p = g.items[0];
        m = L.circleMarker([g.lat, g.lng], { radius: 6, color: '#fff', weight: 2, fillColor: '#0369a1', fillOpacity: 1 })
          .bindPopup(`<b>${p.customerCode}</b> ${p.fullName || ''}<br>หมู่ ${p.villageNo ?? '-'}${p.phone ? '<br>โทร ' + p.phone : ''}<br><a href="https://www.google.com/maps?q=${p.lat},${p.lng}" target="_blank">นำทาง Google Maps</a>`);
      } else {
        const size = Math.min(48, 24 + Math.round(Math.log2(n) * 6));
        const icon = L.divIcon({
          html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#0369a1;color:#fff;display:flex;align-items:center;justify-content:center;font:600 12px/1 system-ui;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)">${n}</div>`,
          className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
        });
        const names = g.items.slice(0, 8).map((p) => `${p.customerCode} ${p.fullName || ''}`).join('<br>');
        m = L.marker([g.lat, g.lng], { icon })
          .bindPopup(`<b>${n} ราย</b> ณ พิกัดนี้<br><span style="color:#888">พิกัดนำเข้าหยาบ (ยังไม่ปักรายบ้าน)</span><br>${names}${n > 8 ? `<br>…อีก ${n - 8} ราย` : ''}`);
      }
      m.on('click', () => { if (n === 1) setSelected(g.items[0].id); });
      m.addTo(group);
      for (const p of g.items) markerOf.current.set(p.id, m);
    }
    group.addTo(map);
    layerRef.current = group;
    if (latlngs.length) map.fitBounds(latlngs, { padding: [30, 30], maxZoom: 16 });
  }, [ready, points]);

  // กดรายชื่อ → บินไปหมุด + เปิด popup + วงสีส้มรอบหมุดที่เลือก
  const focus = (p: MapPoint) => {
    setSelected(p.id);
    const L = LRef.current, map = mapRef.current;
    if (!L || !map) return;
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 17), { duration: 0.6 });
    if (ringRef.current) map.removeLayer(ringRef.current);
    ringRef.current = L.circleMarker([p.lat, p.lng], { radius: 12, color: '#f59e0b', weight: 3, fill: false, interactive: false }).addTo(map);
    markerOf.current.get(p.id)?.openPopup();
    // มือถือ: แผนที่อยู่ด้านบน — เลื่อนขึ้นไปให้เห็นหมุด
    if (window.matchMedia('(max-width: 1023px)').matches) mapEl.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const downloadExcel = async () => {
    const res = await api.get('/water/customers/map/excel', { params: { villageNo: villageNo || undefined }, responseType: 'blob' });
    const u = URL.createObjectURL(res.data as Blob); const a = document.createElement('a');
    a.href = u; a.download = `พิกัดมาตรวัดน้ำ${villageNo ? '-หมู่' + villageNo : ''}.xlsx`; a.click(); setTimeout(() => URL.revokeObjectURL(u), 60000);
  };

  return (
    <div className="space-y-3">
      <PageHeader icon={MapIcon} iconClass="text-emerald-500" title="แผนที่มาตรวัดน้ำ (GIS)" desc="กดรายชื่อเพื่อดูตำแหน่งบนแผนที่ · แตะจุดเพื่อดูข้อมูลหรือนำทาง" />

      <div className="flex flex-wrap items-center gap-2">
        <select value={villageNo} onChange={(e) => { setVillageNo(e.target.value); setSelected(null); }} className={`${controlBase} min-w-0 flex-1 px-3 sm:w-40 sm:flex-none`}>
          <option value="">ทุกหมู่</option>
          {villages?.map((v) => <option key={v.villageNo} value={v.villageNo}>หมู่ {v.villageNo}</option>)}
        </select>
        <span className="shrink-0 text-sm text-slate-400">{points?.length ?? 0} จุด</span>
        <button onClick={downloadExcel} className={`${btn('secondary')} ml-auto shrink-0`}><FileSpreadsheet className="h-4 w-4" /> Excel</button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* แผนที่ — มือถืออยู่บน · จอกว้างอยู่ขวาและติดจอเวลาเลื่อนรายชื่อ */}
        <div className="order-first lg:order-last">
          <div className="lg:sticky lg:top-4">
            {!ready && <p className="py-4 text-center text-sm text-slate-400">กำลังโหลดแผนที่...</p>}
            <div ref={mapEl} className="h-[45vh] w-full scroll-mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm lg:h-[calc(100vh-12rem)]" />
            <p className="mt-2 text-xs text-slate-400">พิกัดเก็บสะสมตอนจดมิเตอร์ · แผนที่ OpenStreetMap</p>
          </div>
        </div>

        {/* รายชื่อ */}
        <div className="min-w-0 space-y-2">
          <SearchInput value={search} onChange={setSearch} placeholder="ค้นชื่อ / รหัส / บ้านเลขที่ / เบอร์" />

          <MobileList className="sm:hidden">
            {isLoading ? <p className="py-6 text-center text-sm text-slate-400">กำลังโหลด...</p>
              : rows.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">ไม่พบผู้ใช้น้ำที่มีพิกัด</p>
              : rows.map((p) => (
                <button key={p.id} onClick={() => focus(p)}
                  className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left', selected === p.id ? 'bg-sky-50' : 'active:bg-slate-50')}>
                  <MapPin className={cn('h-4 w-4 shrink-0', selected === p.id ? 'text-amber-500' : 'text-slate-300')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{p.fullName}</span>
                    <span className="block truncate text-xs text-slate-500">{p.customerCode} · {p.address || '-'} · หมู่ {p.villageNo ?? '-'}</span>
                  </span>
                </button>
              ))}
          </MobileList>

          <TableCard className="hidden sm:block">
            <Table>
              <THead><Th>รหัส</Th><Th>ชื่อ-สกุล</Th><Th>บ้านเลขที่</Th><Th align="center">หมู่</Th></THead>
              <tbody>
                {isLoading ? <TableMessage colSpan={4}>กำลังโหลด...</TableMessage>
                  : rows.length === 0 ? <TableMessage colSpan={4}>ไม่พบผู้ใช้น้ำที่มีพิกัด</TableMessage>
                  : rows.map((p) => (
                    <Tr key={p.id} onClick={() => focus(p)} className={selected === p.id ? 'bg-sky-50' : undefined}>
                      <Td className="whitespace-nowrap"><CodeChip>{p.customerCode}</CodeChip></Td>
                      <Td className="font-medium text-slate-800">{p.fullName}</Td>
                      <Td className="whitespace-nowrap">{p.address || <Dash />}</Td>
                      <Td align="center">{p.villageNo ?? <Dash />}</Td>
                    </Tr>
                  ))}
              </tbody>
            </Table>
            <Pagination {...pager} unit="ราย" />
          </TableCard>
          <Pagination {...pager} unit="ราย" className="flex items-center justify-center gap-3 py-2 text-sm sm:hidden" />
        </div>
      </div>
    </div>
  );
}
