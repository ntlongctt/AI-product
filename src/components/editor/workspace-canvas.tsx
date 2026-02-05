'use client';

import { useEditorStore } from '@/stores/editor-store';
import { WorkspaceLayer } from './workspace-layer';

interface WorkspaceCanvasProps {
  projectId: string;
}

export function WorkspaceCanvas({ projectId }: WorkspaceCanvasProps) {
  const { layers } = useEditorStore();

  return (
    <div
      className="relative bg-white shadow-lg"
      style={{
        width: 1200,
        height: 1200,
      }}
    >
      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            'linear-gradient(to right, #000 1px, transparent 1px), linear-gradient(to bottom, #000 1px, transparent 1px)',
          backgroundSize: '100px 100px',
        }}
      />

      {/* Layers */}
      {layers
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((layer) => (
          <WorkspaceLayer key={layer.id} layer={layer} />
        ))}

      {/* Empty state */}
      {layers.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p className="text-lg font-medium">Drop an image here</p>
            <p className="text-sm">or use a template to get started</p>
          </div>
        </div>
      )}
    </div>
  );
}
