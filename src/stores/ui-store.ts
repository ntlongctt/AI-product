import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  toolBrowserOpen: boolean;
  exportDialogOpen: boolean;
  templatePickerOpen: boolean;
  aiChatOpen: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setToolBrowserOpen: (open: boolean) => void;
  setExportDialogOpen: (open: boolean) => void;
  setTemplatePickerOpen: (open: boolean) => void;
  setAiChatOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toolBrowserOpen: false,
  exportDialogOpen: false,
  templatePickerOpen: false,
  aiChatOpen: false,

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setToolBrowserOpen: (open) => set({ toolBrowserOpen: open }),
  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),
  setTemplatePickerOpen: (open) => set({ templatePickerOpen: open }),
  setAiChatOpen: (open) => set({ aiChatOpen: open }),
}));
