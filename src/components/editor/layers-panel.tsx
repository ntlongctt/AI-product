'use client';

import { Eye, EyeOff, Lock, Unlock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/stores/editor-store';
import { cn } from '@/lib/utils';

export function LayersPanel() {
  const { layers, selectedLayerId, selectLayer, updateLayer, removeLayer } = useEditorStore();

  return (
    <aside className="w-64 border-l bg-background">
      <div className="flex h-12 items-center border-b px-4">
        <h2 className="font-semibold">Layers</h2>
      </div>

      <div className="p-2">
        {layers.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">No layers yet</p>
        ) : (
          <ul className="space-y-1">
            {[...layers].reverse().map((layer) => (
              <li
                key={layer.id}
                className={cn(
                  'flex items-center gap-2 rounded-md p-2 text-sm transition-colors',
                  selectedLayerId === layer.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                )}
                onClick={() => selectLayer(layer.id)}
              >
                <span className="flex-1 truncate">{layer.name}</span>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateLayer(layer.id, { visible: !layer.visible });
                  }}
                >
                  {layer.visible ? (
                    <Eye className="h-3 w-3" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    updateLayer(layer.id, { locked: !layer.locked });
                  }}
                >
                  {layer.locked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Unlock className="h-3 w-3" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLayer(layer.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
