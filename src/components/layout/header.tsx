'use client';

import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/ui-store';

export function Header() {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle navigation</span>
      </Button>

      <Link href="/" className="flex items-center gap-2 font-semibold">
        <span className="text-lg">Product Image AI</span>
      </Link>

      <div className="ml-auto flex items-center gap-4">
        {/* User menu will go here */}
      </div>
    </header>
  );
}
