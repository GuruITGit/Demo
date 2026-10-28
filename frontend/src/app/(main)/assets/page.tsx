'use client';
import { Header } from '@/components/layout/header';
import { Package, Clock } from 'lucide-react';

export default function AssetsComingSoonPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="ครุภัณฑ์" />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="mx-auto mb-5 w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center">
            <Package className="h-10 w-10 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ระบบครุภัณฑ์</h1>
          <p className="mt-2 inline-flex items-center gap-2 text-blue-600 font-medium">
            <Clock className="h-4 w-4" /> ระบบจะมาเร็วๆ นี้
          </p>
          <p className="mt-3 text-sm text-gray-500">
            ระบบบริหารจัดการครุภัณฑ์/พัสดุ กำลังอยู่ระหว่างการพัฒนา จะเปิดให้ใช้งานในเร็วๆ นี้
          </p>
        </div>
      </div>
    </div>
  );
}
