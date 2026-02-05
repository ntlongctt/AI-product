import { create } from 'zustand';
import type { Layer, Tool } from '@/types';
import { generateId } from '@/lib/utils';

interface EditorState {
  layers: Layer[];
  selectedLayerId: string | null;
  activeTool: Tool;
  zoom: number;
  panX: number;
  panY: number;

  addLayer: (layer: Omit<Layer, 'id' | 'zIndex'>) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  selectLayer: (id: string | null) => void;
  reorderLayers: (fromIndex: number, toIndex: number) => void;
  setLayers: (layers: Layer[]) => void;

  setTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;

  reset: () => void;
}

const initialState = {
  layers: [],
  selectedLayerId: null,
  activeTool: 'select' as Tool,
  zoom: 1,
  panX: 0,
  panY: 0,
};

export const useEditorStore = create<EditorState>((set, get) => ({
  ...initialState,

  addLayer: (layer) =>
    set((state) => ({
      layers: [
        ...state.layers,
        {
          ...layer,
          id: generateId(),
          zIndex: state.layers.length,
        },
      ],
    })),

  removeLayer: (id) =>
    set((state) => ({
      layers: state.layers.filter((l) => l.id !== id),
      selectedLayerId: state.selectedLayerId === id ? null : state.selectedLayerId,
    })),

  updateLayer: (id, updates) =>
    set((state) => ({
      layers: state.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })),

  selectLayer: (id) => set({ selectedLayerId: id }),

  reorderLayers: (fromIndex, toIndex) =>
    set((state) => {
      const layers = [...state.layers];
      const [removed] = layers.splice(fromIndex, 1);
      layers.splice(toIndex, 0, removed);
      return {
        layers: layers.map((l, i) => ({ ...l, zIndex: i })),
      };
    }),

  setLayers: (layers) => set({ layers }),

  setTool: (tool) => set({ activeTool: tool }),
  setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),

  reset: () => set(initialState),
}));
