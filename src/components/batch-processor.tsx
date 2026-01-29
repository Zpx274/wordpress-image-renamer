'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUploadStore } from '@/lib/stores/upload-store';
import { useCahierStore } from '@/lib/stores/cahier-store';
import { WordPressSite, RenameContext, UploadedImage } from '@/types';

interface BatchProcessorProps {
  site: WordPressSite;
}

interface ProcessingStatus {
  phase: 'idle' | 'renaming' | 'uploading' | 'done';
  current: number;
  total: number;
  errors: string[];
}

// Helper to compress and convert image to base64
// Claude vision API has a 5MB limit, so we resize large images
async function compressImageToBase64(file: File, maxSizeBytes: number = 4 * 1024 * 1024): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Calculate if we need to resize
      let { width, height } = img;
      const maxDimension = 1568; // Claude recommends max 1568px for performance

      // Scale down if too large
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      // Create canvas and draw resized image
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Try different quality levels to get under size limit
      let quality = 0.85;
      let base64 = '';
      const mimeType = 'image/jpeg'; // Always use JPEG for compression

      do {
        base64 = canvas.toDataURL(mimeType, quality).split(',')[1];
        quality -= 0.1;
      } while (base64.length * 0.75 > maxSizeBytes && quality > 0.1);

      resolve({ base64, mimeType });
    };
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function BatchProcessor({ site }: BatchProcessorProps) {
  const { getImages, updateImage } = useUploadStore();
  const { getCahier } = useCahierStore();
  const [status, setStatus] = useState<ProcessingStatus>({
    phase: 'idle',
    current: 0,
    total: 0,
    errors: [],
  });

  const images = getImages(site.id);
  const cahier = getCahier(site.id);

  const readyImages = images.filter(
    (img) => img.targetPage && img.generatedName && img.status !== 'uploaded'
  );
  const associatedImages = images.filter((img) => img.targetPage);
  const uploadedImages = images.filter((img) => img.status === 'uploaded');
  const needsRenaming = associatedImages.filter((img) => !img.generatedName);

  const generateNames = async () => {
    if (needsRenaming.length === 0) return;

    setStatus({ phase: 'renaming', current: 0, total: needsRenaming.length, errors: [] });

    const existingNames: string[] = images
      .filter((img) => img.generatedName)
      .map((img) => img.generatedName!);

    for (let i = 0; i < needsRenaming.length; i++) {
      const image = needsRenaming[i];
      setStatus((prev) => ({ ...prev, current: i + 1 }));

      try {
        updateImage(site.id, image.id, { status: 'processing' });

        const context: RenameContext = {
          pageTitle: image.targetPage!.title,
          pageSlug: image.targetPage!.slug,
          nomEntreprise: cahier?.parsed?.nomEntreprise || '',
          secteurActivite: cahier?.parsed?.secteurActivite || '',
          villesPrincipales: cahier?.parsed?.villesChoisies || [],
          servicePrincipal: cahier?.parsed?.servicePrincipal || '',
          customInstructions: image.customInstructions,
          originalFileName: image.originalName,
          imageIndex: i,
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

        // Check if response is ok before parsing JSON
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`);
        }

        const text = await response.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Invalid JSON response: ${text.slice(0, 50)}...`);
        }

        if (data.success) {
          existingNames.push(data.suggestedName);
          updateImage(site.id, image.id, {
            generatedName: data.suggestedName,
            generatedAltText: data.altText,
            status: 'ready',
          });
        } else {
          throw new Error(data.error || 'Erreur generation');
        }
      } catch (error) {
        console.error('Erreur generation nom:', error);
        updateImage(site.id, image.id, { status: 'error' });
        setStatus((prev) => ({
          ...prev,
          errors: [
            ...prev.errors,
            `${image.originalName}: ${error instanceof Error ? error.message : 'Erreur'}`,
          ],
        }));
      }
    }

    setStatus((prev) => ({ ...prev, phase: 'done' }));
  };

  const uploadToWordPress = async () => {
    if (readyImages.length === 0) return;

    setStatus({ phase: 'uploading', current: 0, total: readyImages.length, errors: [] });

    for (let i = 0; i < readyImages.length; i++) {
      const image = readyImages[i];
      setStatus((prev) => ({ ...prev, current: i + 1 }));

      try {
        updateImage(site.id, image.id, { status: 'processing' });

        const formData = new FormData();
        formData.append('file', image.file);
        formData.append('seoName', image.generatedName!);
        formData.append('siteUrl', site.url);
        if (image.generatedAltText) {
          formData.append('altText', image.generatedAltText);
        }

        if (site.jwtToken) {
          formData.append('token', site.jwtToken);
        } else if (site.applicationPassword) {
          formData.append('username', site.username);
          formData.append('appPassword', site.applicationPassword);
        }

        const response = await fetch('/api/wordpress/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        if (data.success) {
          updateImage(site.id, image.id, {
            status: 'uploaded',
            wordpressMediaId: data.media.id,
            wordpressUrl: data.media.url,
          });
        } else {
          throw new Error(data.error || 'Erreur upload');
        }
      } catch (error) {
        console.error('Erreur upload:', error);
        updateImage(site.id, image.id, { status: 'error' });
        setStatus((prev) => ({
          ...prev,
          errors: [
            ...prev.errors,
            `${image.originalName}: ${error instanceof Error ? error.message : 'Erreur'}`,
          ],
        }));
      }
    }

    setStatus((prev) => ({ ...prev, phase: 'done' }));
  };

  const regenerateSingleName = async (imageId: string) => {
    const image = images.find((img) => img.id === imageId);
    if (!image || !image.targetPage) return;

    updateImage(site.id, imageId, { status: 'processing', generatedName: undefined });

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

      const response = await fetch('/api/ai/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, existingNames }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`);
      }

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Invalid JSON: ${text.slice(0, 50)}...`);
      }

      if (data.success) {
        updateImage(site.id, imageId, {
          generatedName: data.suggestedName,
          status: 'ready',
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erreur regeneration:', error);
      updateImage(site.id, imageId, { status: 'error' });
    }
  };

  const progressPercent =
    status.total > 0 ? Math.round((status.current / status.total) * 100) : 0;

  const isProcessing = status.phase === 'renaming' || status.phase === 'uploading';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Traitement batch</CardTitle>
        <CardDescription>Generer les noms SEO et uploader vers WordPress</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{images.length} image{images.length > 1 ? 's' : ''}</Badge>
          <Badge variant="secondary" className={associatedImages.length > 0 ? 'bg-blue-100 text-blue-800' : ''}>
            {associatedImages.length} associee{associatedImages.length > 1 ? 's' : ''}
          </Badge>
          {needsRenaming.length > 0 && (
            <Badge variant="outline" className="bg-orange-100 text-orange-800">
              {needsRenaming.length} a renommer
            </Badge>
          )}
          {readyImages.length > 0 && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {readyImages.length} prete{readyImages.length > 1 ? 's' : ''}
            </Badge>
          )}
          {uploadedImages.length > 0 && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              {uploadedImages.length} uploadee{uploadedImages.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>
                {status.phase === 'renaming' ? 'Generation des noms' : 'Upload vers WordPress'}
              </span>
              <span>
                {status.current}/{status.total}
              </span>
            </div>
            <Progress value={progressPercent} />
          </div>
        )}

        {/* Errors */}
        {status.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              <div className="font-medium mb-1">Erreurs:</div>
              <ul className="list-disc pl-4 text-sm">
                {status.errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={generateNames}
            disabled={isProcessing || needsRenaming.length === 0}
          >
            {isProcessing && status.phase === 'renaming' ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Generation...
              </>
            ) : (
              <>Generer les noms ({needsRenaming.length})</>
            )}
          </Button>

          <Button
            onClick={uploadToWordPress}
            disabled={isProcessing || readyImages.length === 0}
            variant="default"
            className="bg-green-600 hover:bg-green-700"
          >
            {isProcessing && status.phase === 'uploading' ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Upload...
              </>
            ) : (
              <>Uploader vers WordPress ({readyImages.length})</>
            )}
          </Button>
        </div>

        {/* Summary after upload */}
        {uploadedImages.length > 0 && (
          <div className="p-4 bg-green-50 rounded-lg space-y-3">
            <p className="font-medium text-green-800">
              {uploadedImages.length} image{uploadedImages.length > 1 ? 's' : ''} uploadee
              {uploadedImages.length > 1 ? 's' : ''} avec succes !
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.open(`${site.url}/wp-admin/upload.php`, '_blank');
              }}
            >
              Voir la mediatheque
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Export the regenerate function for use by other components
export type { BatchProcessorProps };
