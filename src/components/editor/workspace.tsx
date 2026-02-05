'use client';

import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { useEditorStore } from '@/stores/editor-store';
import { Toolbar } from './toolbar';
import { WorkspaceCanvas } from './workspace-canvas';
import { LayersPanel } from './layers-panel';

interface WorkspaceProps {
  projectId: string;
}

export function Workspace({ projectId }: WorkspaceProps) {
  const { zoom, setZoom, setPan } = useEditorStore();

  return (
    <div className="flex h-full">
      {/* Main workspace area */}
      <div className="flex flex-1 flex-col">
        <Toolbar />

        <div className="relative flex-1 overflow-hidden bg-neutral-100 dark:bg-neutral-900">
          <TransformWrapper
            initialScale={zoom}
            minScale={0.1}
            maxScale={5}
            centerOnInit
            onTransformed={(ref) => {
              setZoom(ref.state.scale);
              setPan(ref.state.positionX, ref.state.positionY);
            }}
          >
            <TransformComponent
              wrapperClass="!w-full !h-full"
              contentClass="!w-full !h-full flex items-center justify-center"
            >
              <WorkspaceCanvas projectId={projectId} />
            </TransformComponent>
          </TransformWrapper>
        </div>
      </div>

      {/* Right panel */}
      <LayersPanel />
    </div>
  );
}
