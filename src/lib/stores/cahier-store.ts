import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CahierDesCharges } from '@/types';

interface CahierStore {
  // Map de siteId -> cahier
  cahiers: Record<string, { parsed: Partial<CahierDesCharges>; rawText: string }>;
  getCahier: (siteId: string) => { parsed: Partial<CahierDesCharges>; rawText: string } | null;
  setCahier: (siteId: string, parsed: Partial<CahierDesCharges>, rawText: string) => void;
  removeCahier: (siteId: string) => void;
}

export const useCahierStore = create<CahierStore>()(
  persist(
    (set, get) => ({
      cahiers: {},

      getCahier: (siteId) => {
        return get().cahiers[siteId] || null;
      },

      setCahier: (siteId, parsed, rawText) => {
        set((state) => ({
          cahiers: {
            ...state.cahiers,
            [siteId]: { parsed, rawText },
          },
        }));
      },

      removeCahier: (siteId) => {
        set((state) => {
          const { [siteId]: _, ...rest } = state.cahiers;
          return { cahiers: rest };
        });
      },
    }),
    {
      name: 'wordpress-cahiers-storage',
    }
  )
);
