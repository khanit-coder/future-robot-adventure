import { create } from 'zustand';

export interface ToastItem {
  id: string;
  kind: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface ToastState {
  items: ToastItem[];
  push: (item: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (item) => {
    const id = crypto.randomUUID();
    set((s) => ({ items: [...s.items.slice(-4), { ...item, id }] }));
    setTimeout(() => {
      set((s) => ({ items: s.items.filter((x) => x.id !== id) }));
    }, 4500);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

export function toast(kind: ToastItem['kind'], title: string, description?: string) {
  useToastStore.getState().push({ kind, title, description });
}
