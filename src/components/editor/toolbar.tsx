'use client';

import {
  MousePointer2,
  Hand,
  Eraser,
  ArrowUpFromLine,
  Sparkles,
  Sun,
  Image,
  Download,
  Grid3X3,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEditorStore } from '@/stores/editor-store';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import type { Tool } from '@/types';

const tools: { id: Tool; label: string; icon: React.ElementType }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'pan', label: 'Pan', icon: Hand },
];

const aiTools: { id: Tool; label: string; icon: React.ElementType }[] = [
  { id: 'remove-bg', label: 'Remove BG', icon: Eraser },
  { id: 'upscale', label: 'Upscale', icon: ArrowUpFromLine },
  { id: 'polish', label: 'Polish', icon: Sparkles },
  { id: 'relight', label: 'Relight', icon: Sun },
];

export function Toolbar() {
  const { activeTool, setTool, zoom, setZoom } = useEditorStore();
  const { setExportDialogOpen, setTemplatePickerOpen } = useUIStore();

  return (
    <div className="flex h-12 items-center gap-2 border-b bg-background px-4">
      {/* Basic tools */}
      <div className="flex items-center gap-1">
        {tools.map((tool) => (
          <Button
            key={tool.id}
            variant={activeTool === tool.id ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setTool(tool.id)}
            title={tool.label}
          >
            <tool.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <div className="h-6 w-px bg-border" />

      {/* AI tools */}
      <div className="flex items-center gap-1">
        {aiTools.map((tool) => (
          <Button
            key={tool.id}
            variant={activeTool === tool.id ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => setTool(tool.id)}
            title={tool.label}
          >
            <tool.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Template & Scene */}
      <Button variant="ghost" size="sm" onClick={() => setTemplatePickerOpen(true)}>
        <Image className="mr-2 h-4 w-4" />
        Templates
      </Button>

      <div className="flex-1" />

      {/* Zoom controls */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => setZoom(zoom - 0.25)}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="w-12 text-center text-sm">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" onClick={() => setZoom(zoom + 0.25)}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Export */}
      <Button onClick={() => setExportDialogOpen(true)}>
        <Download className="mr-2 h-4 w-4" />
        Export
      </Button>
    </div>
  );
}
