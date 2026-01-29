'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useUploadStore } from '@/lib/stores/upload-store';
import { ImageUploader } from './image-uploader';
import { ImageCard } from './image-card';
import { BatchProcessor } from './batch-processor';
import { ElementorReplacer } from './elementor-replacer';
import { useCahierStore } from '@/lib/stores/cahier-store';
import { WordPressSite, WordPressPage, UploadedImage, RenameContext } from '@/types';

interface ImageManagerProps {
  site: WordPressSite;
}

export function ImageManager({ site }: ImageManagerProps) {
  const { getImages, selectedImageIds, selectAllImages, clearSelection, assignPageToSelected, updateImage } =
    useUploadStore();
  const { getCahier } = useCahierStore();
  const [pages, setPages] = useState<WordPressPage[]>([]);
  const [isLoadingPages, setIsLoadingPages] = useState(true);
  const [pageSearch, setPageSearch] = useState('');
  const [showPageSelector, setShowPageSelector] = useState(false);
  const [targetImage, setTargetImage] = useState<UploadedImage | null>(null);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);

  const images = getImages(site.id);
  const cahier = getCahier(site.id);

  // Charger les pages
  useEffect(() => {
    const fetchPages = async () => {
      setIsLoadingPages(true);
      try {
        const params = new URLSearchParams({ siteUrl: site.url });
        if (site.jwtToken) {
          params.set('token', site.jwtToken);
        } else if (site.applicationPassword) {
          params.set('username', site.username);
          params.set('appPassword', site.applicationPassword);
        }

        const response = await fetch(`/api/wordpress/pages?${params}`);
        const data = await response.json();

        if (data.success) {
          setPages(data.pages);
        }
      } catch (error) {
        console.error('Erreur chargement pages:', error);
      } finally {
        setIsLoadingPages(false);
      }
    };

    fetchPages();
  }, [site]);

  const filteredPages = pages.filter(
    (page) =>
      page.title.toLowerCase().includes(pageSearch.toLowerCase()) ||
      page.slug.toLowerCase().includes(pageSearch.toLowerCase())
  );

  const handleSelectPage = (image: UploadedImage) => {
    setTargetImage(image);
    setShowPageSelector(true);
  };

  const handlePageSelected = (page: WordPressPage) => {
    if (targetImage) {
      // Association individuelle
      useUploadStore.getState().setTargetPage(site.id, targetImage.id, page);
    } else if (selectedImageIds.length > 0) {
      // Association multiple
      assignPageToSelected(site.id, page);
    }
    setShowPageSelector(false);
    setTargetImage(null);
    setPageSearch('');
  };

  const handleBulkAssign = () => {
    setTargetImage(null);
    setShowPageSelector(true);
  };

  const associatedCount = images.filter((img) => img.targetPage).length;
  const unassociatedCount = images.length - associatedCount;

  // Helper to compress and convert image to base64
  const compressImageToBase64 = (file: File, maxSizeBytes: number = 4 * 1024 * 1024): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const maxDimension = 1568;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.85;
        let base64 = '';
        const mimeType = 'image/jpeg';

        do {
          base64 = canvas.toDataURL(mimeType, quality).split(',')[1];
          quality -= 0.1;
        } while (base64.length * 0.75 > maxSizeBytes && quality > 0.1);

        URL.revokeObjectURL(img.src);
        resolve({ base64, mimeType });
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleRegenerate = async (imageId: string) => {
    const image = images.find((img) => img.id === imageId);
    if (!image || !image.targetPage) return;

    setGeneratingImageId(imageId);
    updateImage(site.id, imageId, { status: 'processing', generatedName: undefined, generatedAltText: undefined });

    try {
      const existingNames = images
        .filter((img) => img.generatedName && img.id !== imageId)
        .map((img) => img.generatedName!);

      const context: RenameContext = {
        pageTitle: image.targetPage.title,
        pageSlug: image.targetPage.slug,
        nomEntreprise: cahier?.parsed?.nomEntreprise || '',
        secteurActivite: cahier?.parsed?.secteurActivite || '',
        villesPrincipales: cahier?.parsed?.villesChoisies || [],
        servicePrincipal: cahier?.parsed?.servicePrincipal || '',
        customInstructions: image.customInstructions,
        originalFileName: image.originalName,
      };

      // Try to convert and compress image to base64 for vision analysis
      let imageBase64: string | undefined;
      let mimeType: string | undefined;

      try {
        const compressed = await compressImageToBase64(image.file);
        imageBase64 = compressed.base64;
        mimeType = compressed.mimeType;
      } catch (imgError) {
        console.warn(`Image ${image.originalName} cannot be loaded for vision, using text-only mode`);
        // Continue without image - will use text-only generation
      }

      const response = await fetch('/api/ai/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, existingNames, imageBase64, mimeType }),
      });

      const data = await response.json();

      if (data.success) {
        updateImage(site.id, imageId, {
          generatedName: data.suggestedName,
          generatedAltText: data.altText,
          status: 'ready',
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erreur regeneration:', error);
      updateImage(site.id, imageId, { status: 'error' });
    } finally {
      setGeneratingImageId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Uploader */}
      <ImageUploader siteId={site.id} />

      {/* Image list */}
      {images.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                Images ({images.length})
              </CardTitle>
              <div className="flex items-center gap-2">
                {associatedCount > 0 && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {associatedCount} associee{associatedCount > 1 ? 's' : ''}
                  </Badge>
                )}
                {unassociatedCount > 0 && (
                  <Badge variant="outline">
                    {unassociatedCount} non associee{unassociatedCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>

            {/* Bulk actions */}
            {images.length > 1 && (
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    selectedImageIds.length === images.length
                      ? clearSelection()
                      : selectAllImages(site.id)
                  }
                >
                  {selectedImageIds.length === images.length
                    ? 'Tout deselectionner'
                    : 'Tout selectionner'}
                </Button>
                {selectedImageIds.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleBulkAssign}>
                    Associer {selectedImageIds.length} image{selectedImageIds.length > 1 ? 's' : ''} a...
                  </Button>
                )}
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {images.map((image) => (
              <ImageCard
                key={image.id}
                image={image}
                siteId={site.id}
                pages={pages}
                onSelectPage={handleSelectPage}
                onRegenerate={handleRegenerate}
                isGenerating={generatingImageId === image.id}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Batch processor */}
      {images.length > 0 && <BatchProcessor site={site} />}

      {/* Elementor replacer */}
      {images.some((img) => img.status === 'uploaded') && (
        <ElementorReplacer site={site} uploadedImages={images} />
      )}

      {/* Page selector modal */}
      {showPageSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">
                {targetImage
                  ? `Associer "${targetImage.originalName}"`
                  : `Associer ${selectedImageIds.length} images`}
              </CardTitle>
              <Input
                placeholder="Rechercher une page..."
                value={pageSearch}
                onChange={(e) => setPageSearch(e.target.value)}
                autoFocus
              />
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {isLoadingPages ? (
                <p className="text-center text-muted-foreground py-4">
                  Chargement des pages...
                </p>
              ) : filteredPages.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Aucune page trouvee
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredPages.map((page) => (
                    <div
                      key={page.id}
                      className="p-2 rounded cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => handlePageSelected(page)}
                    >
                      <p className="font-medium text-sm">{page.title || '(Sans titre)'}</p>
                      <p className="text-xs text-muted-foreground">/{page.slug}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            <div className="p-4 border-t">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setShowPageSelector(false);
                  setTargetImage(null);
                  setPageSearch('');
                }}
              >
                Annuler
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
