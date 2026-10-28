import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // self-host: build เป็น standalone server (.next/standalone/server.js) สำหรับรันใน Docker
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: '**' },
    ],
  },
  // dev เท่านั้น: เปิดผ่านอุโมงค์ (ngrok) พอร์ต 3000 พอร์ตเดียว โดยให้ Next ส่งต่อ /v1/* ไป backend
  // ใช้คู่กับ NEXT_PUBLIC_API_URL=/v1 ใน .env.local — บน prod ไม่มีผล (rewrites ว่างเหมือนเดิม)
  async rewrites() {
    // หน้าชำระเงินประชาชนแบบ static: ค่าแผง + ค่าขยะ → public/citizen-pay/<หน้า>/ (ซอร์ส TS อยู่ citizen-pay/ → npm run build:pay)
    const market = [
      { source: '/citizen/market', destination: '/citizen-pay/market/index.html' },
      { source: '/citizen/waste', destination: '/citizen-pay/waste/index.html' },
      { source: '/staff-demo/market', destination: '/citizen-pay/staff/market/index.html' },
      { source: '/staff-demo/waste', destination: '/citizen-pay/staff/waste/index.html' },
    ];
    if (process.env.NODE_ENV === 'production') return market;
    return [...market, { source: '/v1/:path*', destination: `${process.env.DEV_BACKEND_URL || 'http://localhost:4000'}/v1/:path*` }];
  },
  ...(process.env.NODE_ENV !== 'production' && {
    // เปิดให้เข้า dev server จาก IP วงแลน (ทดสอบบนมือถือ) ด้วย — ไม่งั้น Next บล็อก cross-origin request เงียบๆ (หน้าเด้ง/ค้าง)
    allowedDevOrigins: [
      '*.ngrok-free.app', '*.ngrok-free.dev', '*.ngrok.app', '*.ngrok.io', '*.trycloudflare.com',
      '192.168.1.130', 'localhost',
    ],
    experimental: { proxyClientMaxBodySize: '25mb' },
  }),
  // Rework 2.1 — โมดูลที่ตัดออก: เด้งกลับหน้าหลัก (กันจอขาว/เข้าหน้าเก่า)
  async redirects() {
    const dead = ['approvals', 'complaints', 'welfare', 'budget', 'tax', 'procurement', 'reports', 'ocr', 'search'];
    return [
      ...dead.flatMap((m) => [
        { source: `/${m}`, destination: '/dashboard', permanent: false },
        { source: `/${m}/:path*`, destination: '/dashboard', permanent: false },
      ]),
      // สารบรรณเดิม (หนังสือรับ/ส่ง) → สารบรรณใหม่
      { source: '/correspondence', destination: '/correspondence/tickets', permanent: false },
      { source: '/correspondence/new', destination: '/correspondence/tickets/new', permanent: false },
      { source: '/correspondence/outgoing/:path*', destination: '/correspondence/tickets', permanent: false },
    ];
  },
};

export default nextConfig;
