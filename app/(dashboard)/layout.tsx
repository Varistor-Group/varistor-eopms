import React from 'react';
import { Sidebar } from '@/components/shared/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Sidebar />
      <main className="md:ml-[220px] p-6 lg:p-10 transition-all duration-200">
        {children}
      </main>
    </div>
  );
}
