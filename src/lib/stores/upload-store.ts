import { create } from 'zustand';
import { UploadedImage, WordPressPage } from '@/types';

interface UploadStore {
  // Map de siteId -> images
  images: Record<string, UploadedImage[]>;

  getImages: (siteId: string) => UploadedImage[];
  addImages: (siteId: string, newImages: UploadedImage[]) => void;
  removeImage: (siteId: string, imageId: string) => void;
  updateImage: (siteId: string, imageId: string, updates: Partial<UploadedImage>) => void;
  setTargetPage: (siteId: string, imageId: string, page: WordPressPage | undefined) => void;
  setGeneratedName: (siteId: string, imageId: string, name: string) => void;
  clearImages: (siteId: string) => void;

  // Sélection multiple
  selectedImageIds: string[];
  toggleImageSelection: (imageId: string) => void;
  selectAllImages: (siteId: string) => void;
  clearSelection: () => void;

  // Associer plusieurs images à une page
  assignPageToSelected: (siteId: string, page: WordPressPage) => void;
}

export const useUploadStore = create<UploadStore>((set, get) => ({
  images: {},
  selectedImageIds: [],

  getImages: (siteId) => {
    return get().images[siteId] || [];
  },

  addImages: (siteId, newImages) => {
    set((state) => ({
      images: {
        ...state.images,
        [siteId]: [...(state.images[siteId] || []), ...newImages],
      },
    }));
  },

  removeImage: (siteId, imageId) => {
    set((state) => ({
      images: {
        ...state.images,
        [siteId]: (state.images[siteId] || []).filter((img) => img.id !== imageId),
      },
      selectedImageIds: state.selectedImageIds.filter((id) => id !== imageId),
    }));
  },

  updateImage: (siteId, imageId, updates) => {
    set((state) => ({
      images: {
        ...state.images,
        [siteId]: (state.images[siteId] || []).map((img) =>
          img.id === imageId ? { ...img, ...updates } : img
        ),
      },
    }));
  },

  setTargetPage: (siteId, imageId, page) => {
    get().updateImage(siteId, imageId, { targetPage: page });
  },

  setGeneratedName: (siteId, imageId, name) => {
    get().updateImage(siteId, imageId, { generatedName: name });
  },

  clearImages: (siteId) => {
    set((state) => {
      const { [siteId]: _, ...rest } = state.images;
      return { images: rest, selectedImageIds: [] };
    });
  },

  toggleImageSelection: (imageId) => {
    set((state) => ({
      selectedImageIds: state.selectedImageIds.includes(imageId)
        ? state.selectedImageIds.filter((id) => id !== imageId)
        : [...state.selectedImageIds, imageId],
    }));
  },

  selectAllImages: (siteId) => {
    const images = get().images[siteId] || [];
    set({ selectedImageIds: images.map((img) => img.id) });
  },

  clearSelection: () => {
    set({ selectedImageIds: [] });
  },

  assignPageToSelected: (siteId, page) => {
    const { selectedImageIds, images } = get();
    const siteImages = images[siteId] || [];

    set({
      images: {
        ...images,
        [siteId]: siteImages.map((img) =>
          selectedImageIds.includes(img.id) ? { ...img, targetPage: page } : img
        ),
      },
      selectedImageIds: [],
    });
  },
}));
