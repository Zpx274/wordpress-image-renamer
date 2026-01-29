import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WordPressSite } from '@/types';

interface SiteStore {
  sites: WordPressSite[];
  currentSite: WordPressSite | null;
  addSite: (site: WordPressSite) => void;
  updateSite: (id: string, updates: Partial<WordPressSite>) => void;
  removeSite: (id: string) => void;
  setCurrentSite: (site: WordPressSite | null) => void;
  getSiteById: (id: string) => WordPressSite | undefined;
}

export const useSiteStore = create<SiteStore>()(
  persist(
    (set, get) => ({
      sites: [],
      currentSite: null,

      addSite: (site) => {
        set((state) => {
          // Vérifier si le site existe déjà (par URL)
          const existingIndex = state.sites.findIndex(
            (s) => s.url.toLowerCase() === site.url.toLowerCase()
          );

          if (existingIndex >= 0) {
            // Mettre à jour le site existant
            const updatedSites = [...state.sites];
            updatedSites[existingIndex] = {
              ...updatedSites[existingIndex],
              ...site,
              lastConnected: new Date(),
            };
            return { sites: updatedSites };
          }

          // Ajouter un nouveau site
          return { sites: [site, ...state.sites] };
        });
      },

      updateSite: (id, updates) => {
        set((state) => ({
          sites: state.sites.map((site) =>
            site.id === id ? { ...site, ...updates } : site
          ),
          currentSite:
            state.currentSite?.id === id
              ? { ...state.currentSite, ...updates }
              : state.currentSite,
        }));
      },

      removeSite: (id) => {
        set((state) => ({
          sites: state.sites.filter((site) => site.id !== id),
          currentSite: state.currentSite?.id === id ? null : state.currentSite,
        }));
      },

      setCurrentSite: (site) => {
        set({ currentSite: site });
      },

      getSiteById: (id) => {
        return get().sites.find((site) => site.id === id);
      },
    }),
    {
      name: 'wordpress-sites-storage',
      partialize: (state) => ({
        sites: state.sites.map((site) => ({
          ...site,
          // Ne pas stocker le mot de passe Application Password en localStorage
          applicationPassword: undefined,
          // Le token JWT peut être stocké car c'est un token, pas un mot de passe
          // Il sera utilisé pour la reconnexion automatique
        })),
      }),
    }
  )
);
