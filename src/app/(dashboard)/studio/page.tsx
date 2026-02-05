import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function StudioPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome to AI Studio</h1>
        <p className="mt-2 text-muted-foreground">
          Create professional product images in seconds
        </p>
      </div>

      <div className="flex gap-4">
        <Button asChild>
          <Link href="/studio/new">
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/templates">Browse Templates</Link>
        </Button>
      </div>
    </div>
  );
}
