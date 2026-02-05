'use client';

import { Resizable } from 're-resizable';
import { useEditorStore } from '@/stores/editor-store';
import { cn } from '@/lib/utils';
import type { Layer } from '@/types';

interface WorkspaceLayerProps {
  layer: Layer;
}

export function WorkspaceLayer({ layer }: WorkspaceLayerProps) {
  const { selectedLayerId, selectLayer, updateLayer } = useEditorStore();
  const isSelected = selectedLayerId === layer.id;

  if (!layer.visible) return null;

  return (
    <Resizable
      size={{ width: layer.width, height: layer.height }}
      onResizeStop={(e, direction, ref, d) => {
        updateLayer(layer.id, {
          width: layer.width + d.width,
          height: layer.height + d.height,
        });
      }}
      enable={isSelected && !layer.locked ? undefined : false}
      className={cn(
        'absolute cursor-move',
        isSelected && 'ring-2 ring-primary ring-offset-2',
        layer.locked && 'cursor-not-allowed opacity-75'
      )}
      style={{
        left: layer.x,
        top: layer.y,
        transform: `rotate(${layer.rotation}deg) scale(${layer.scale})`,
        opacity: layer.opacity,
        zIndex: layer.zIndex,
      }}
    >
      <div
        className="h-full w-full"
        onClick={() => selectLayer(layer.id)}
        onDragStart={(e) => e.preventDefault()}
      >
        {layer.type === 'image' && layer.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={layer.url}
            alt={layer.name}
            className="h-full w-full object-contain"
            draggable={false}
          />
        )}

        {layer.type === 'background' && (
          <div
            className="h-full w-full"
            style={{ backgroundColor: layer.url || '#ffffff' }}
          />
        )}

        {layer.type === 'text' && (
          <div className="flex h-full w-full items-center justify-center text-2xl font-bold">
            {layer.name}
          </div>
        )}
      </div>
    </Resizable>
  );
}
