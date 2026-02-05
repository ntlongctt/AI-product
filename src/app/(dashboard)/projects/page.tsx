import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ProjectsPage() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage your product image projects</p>
        </div>
        <Button asChild>
          <Link href="/studio/new">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      </div>

      {/* Empty state */}
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed">
        <p className="mb-4 text-muted-foreground">No projects yet</p>
        <Button asChild variant="outline">
          <Link href="/studio/new">Create your first project</Link>
        </Button>
      </div>
    </div>
  );
}
