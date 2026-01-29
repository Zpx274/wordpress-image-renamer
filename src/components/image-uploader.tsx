'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUploadStore } from '@/lib/stores/upload-store';
import { UploadedImage } from '@/types';

interface ImageUploaderProps {
  siteId: string;
}

const ACCEPTED_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function ImageUploader({ siteId }: ImageUploaderProps) {
  const { addImages, getImages } = useUploadStore();
  const existingImages = getImages(siteId);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newImages: UploadedImage[] = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        originalName: file.name,
        size: file.size,
        dimensions: { width: 0, height: 0 },
        preview: URL.createObjectURL(file),
        status: 'pending' as const,
      }));

      // Charger les dimensions des images et detecter les erreurs
      newImages.forEach((img) => {
        const image = new Image();

        image.onload = () => {
          useUploadStore.getState().updateImage(siteId, img.id, {
            dimensions: { width: image.width, height: image.height },
          });
        };

        image.onerror = () => {
          // Image failed to load - try to diagnose why
          const file = img.file;
          let errorMsg = 'Image corrompue ou format non supporte';

          // Check file signature by reading first bytes
          const reader = new FileReader();
          reader.onload = (e) => {
            const arr = new Uint8Array(e.target?.result as ArrayBuffer);
            const header = arr.slice(0, 4).join(',');

            // Known signatures: JPEG=255,216,255, PNG=137,80,78,71, GIF=71,73,70,56, WEBP starts with RIFF
            const isValidJPEG = arr[0] === 255 && arr[1] === 216 && arr[2] === 255;
            const isValidPNG = arr[0] === 137 && arr[1] === 80 && arr[2] === 78 && arr[3] === 71;
            const isValidGIF = arr[0] === 71 && arr[1] === 73 && arr[2] === 70;

            if (!isValidJPEG && !isValidPNG && !isValidGIF) {
              errorMsg = `Format invalide (signature: ${header}). Le fichier n'est pas une vraie image.`;
            } else {
              errorMsg = `Image corrompue (signature ${isValidJPEG ? 'JPEG' : isValidPNG ? 'PNG' : 'GIF'} valide mais donnees corrompues)`;
            }

            useUploadStore.getState().updateImage(siteId, img.id, {
              loadError: errorMsg,
              dimensions: { width: 0, height: 0 },
            });
          };
          reader.onerror = () => {
            useUploadStore.getState().updateImage(siteId, img.id, {
              loadError: 'Impossible de lire le fichier',
              dimensions: { width: 0, height: 0 },
            });
          };
          reader.readAsArrayBuffer(file.slice(0, 16));
        };

        image.src = img.preview;
      });

      addImages(siteId, newImages);
    },
    [siteId, addImages]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_SIZE,
  });

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const totalSize = existingImages.reduce((acc, img) => acc + img.size, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Upload d&apos;images</CardTitle>
        <CardDescription>
          Glissez-deposez vos images ou cliquez pour parcourir
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="text-4xl mb-2">📤</div>
          {isDragActive ? (
            <p className="font-medium">Deposez les images ici...</p>
          ) : (
            <>
              <p className="font-medium">Glissez vos images ici</p>
              <p className="text-sm text-muted-foreground mt-1">
                ou cliquez pour parcourir
              </p>
            </>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            JPG, PNG, WebP, GIF - Max 10MB par image
          </p>
        </div>

        {fileRejections.length > 0 && (
          <Alert variant="destructive">
            <AlertDescription>
              {fileRejections.map((rejection) => (
                <div key={rejection.file.name}>
                  {rejection.file.name}: {rejection.errors.map((e) => e.message).join(', ')}
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {existingImages.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {existingImages.length} image{existingImages.length > 1 ? 's' : ''} • {formatSize(totalSize)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
