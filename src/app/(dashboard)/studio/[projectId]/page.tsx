import { Workspace } from '@/components/editor/workspace';

interface StudioEditorPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function StudioEditorPage({ params }: StudioEditorPageProps) {
  const { projectId } = await params;

  return (
    <div className="h-[calc(100vh-3.5rem)]">
      <Workspace projectId={projectId} />
    </div>
  );
}
