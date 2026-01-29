'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { UploadedImage, WordPressPage } from '@/types';
import { useUploadStore } from '@/lib/stores/upload-store';
import { RenamePreview } from './rename-preview';

interface ImageCardProps {
  image: UploadedImage;
  siteId: string;
  pages: WordPressPage[];
  onSelectPage: (image: UploadedImage) => void;
  onRegenerate?: (imageId: string) => void;
  isGenerating?: boolean;
}

export function ImageCard({ image, siteId, pages, onSelectPage, onRegenerate, isGenerating }: ImageCardProps) {
  const { removeImage, updateImage, toggleImageSelection, selectedImageIds } =
    useUploadStore();
  const [showInstructions, setShowInstructions] = useState(false);

  const isSelected = selectedImageIds.includes(image.id);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    URL.revokeObjectURL(image.preview);
    removeImage(siteId, image.id);
  };

  return (
    <Card
      className={`overflow-hidden transition-all ${
        isSelected ? 'ring-2 ring-primary' : ''
      }`}
    >
      <div className="flex gap-3 p-3">
        {/* Checkbox */}
        <div className="flex items-start pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleImageSelection(image.id)}
            className="w-4 h-4 cursor-pointer"
          />
        </div>

        {/* Thumbnail */}
        <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-muted">
          {image.loadError ? (
            <div className="w-full h-full flex items-center justify-center bg-red-100 text-red-500">
              <span className="text-2xl">⚠️</span>
            </div>
          ) : (
            <Image
              src={image.preview}
              alt={image.originalName}
              fill
              className="object-cover"
              sizes="64px"
            />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{image.originalName}</p>
              <p className="text-xs text-muted-foreground">
                {formatSize(image.size)}
                {image.dimensions.width > 0 &&
                  ` • ${image.dimensions.width}x${image.dimensions.height}`}
              </p>
              {image.loadError && (
                <p className="text-xs text-red-600 mt-1">
                  ⚠️ {image.loadError}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleRemove}
            >
              x
            </Button>
          </div>

          {/* Page association */}
          <div className="mt-2">
            {image.targetPage ? (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {image.targetPage.title}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 text-xs"
                  onClick={() => onSelectPage(image)}
                >
                  Changer
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onSelectPage(image)}
              >
                Associer a une page
              </Button>
            )}
          </div>

          {/* Custom instructions */}
          {showInstructions ? (
            <div className="mt-2">
              <Input
                placeholder="Ex: localite Evreux, terrasse bois..."
                value={image.customInstructions || ''}
                onChange={(e) =>
                  updateImage(siteId, image.id, { customInstructions: e.target.value })
                }
                className="h-7 text-xs"
              />
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-0 text-xs text-muted-foreground mt-1"
              onClick={() => setShowInstructions(true)}
            >
              + Ajouter des consignes
            </Button>
          )}

          {/* Generated name preview */}
          {(image.generatedName || image.targetPage || isGenerating) && (
            <div className="mt-2">
              <RenamePreview
                image={image}
                siteId={siteId}
                onRegenerate={onRegenerate || (() => {})}
                isGenerating={isGenerating}
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
