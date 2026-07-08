'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PageHeader from '@/components/PageHeader';
import { getBackNavigation, getBreadcrumbsForPath } from '@/lib/navigation';
import { SM_PAGE } from '@/lib/serviceManagerUi';

const TABS = [
  { href: '/service-manager', label: 'Work Queue', exact: true },
  { href: '/service-manager/customers', label: 'Customers' },
  { href: '/service-manager/vehicles', label: 'Vehicles' },
  { href: '/service-manager/analytics', label: 'Analytics' },
];

interface Props {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function ServiceManagerShell({ title, description, actions, children }: Props) {
  const pathname = usePathname() || '/service-manager';

  return (
    <div className={SM_PAGE}>
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <PageHeader
          variant="dark"
          className="mb-0 flex-1"
          title={title}
          description={description}
          backHref={getBackNavigation(pathname)?.href}
          backLabel={
            getBackNavigation(pathname)
              ? `Back to ${getBackNavigation(pathname)!.label}`
              : undefined
          }
          breadcrumbs={getBreadcrumbsForPath(pathname)}
        />
        {actions && <div className="flex gap-2 items-center shrink-0 flex-wrap">{actions}</div>}
      </div>

      <nav className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {TABS.map(tab => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-shrink-0 border rounded-lg px-[14px] py-[7px] text-[12px] transition-all duration-150 ${
                active
                  ? 'bg-[#0e3a42] border-cyan-400/40 text-cyan-400 font-semibold'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-[#444] hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
