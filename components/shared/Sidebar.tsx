'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Building2, GraduationCap, DollarSign, FileText, Database } from 'lucide-react';

export const Sidebar = () => {
  const pathname = usePathname();

  const navItems = [
    { label: 'Employees', href: '/admin', icon: Users },
    { label: 'Departments', href: '/admin/departments', icon: Building2 },
    { label: 'Training modules', href: '/admin/training', icon: GraduationCap },
    { label: 'Payroll setup', href: '/admin/payroll', icon: DollarSign },
    { label: 'Document Vault', href: '/vault', icon: Database },
    { label: 'Audit log', href: '/admin/audit', icon: FileText },
  ];

  return (
    <aside className="fixed left-0 top-0 h-screen w-[220px] bg-[#fafafa] border-r border-gray-100 hidden md:flex flex-col">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <img src="/logo.svg" alt="Varistor Logo" className="h-8 w-auto object-contain" />
          <span className="font-bold text-sm text-brand-ink">Varistor EOPMS</span>
        </div>

        <nav className="flex flex-col gap-1">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-3">
            ADMIN
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-brand-lime-tint text-brand-ink' 
                    : 'text-gray-500 hover:bg-gray-100 hover:text-brand-ink'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 bg-brand-lime rounded-r-full" />
                )}
                <Icon size={18} strokeWidth={isActive ? 2 : 1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
