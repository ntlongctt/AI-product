'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FolderOpen, LayoutTemplate, Image, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui-store';

const navItems = [
  { href: '/studio', label: 'Studio', icon: Home },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/templates', label: 'Templates', icon: LayoutTemplate },
  { href: '/assets', label: 'Assets', icon: Image },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen } = useUIStore();

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-background transition-transform lg:static lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}
    >
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="text-lg">AI Studio</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="rounded-md bg-muted p-3">
          <p className="text-xs font-medium">Free Plan</p>
          <p className="text-xs text-muted-foreground">3/10 generations used</p>
        </div>
      </div>
    </aside>
  );
}
