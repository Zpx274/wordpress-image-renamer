'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UploadedImage } from '@/types';
import { useUploadStore } from '@/lib/stores/upload-store';

interface RenamePreviewProps {
  image: UploadedImage;
  siteId: string;
  onRegenerate: (imageId: string) => void;
  isGenerating?: boolean;
}

export function RenamePreview({
  image,
  siteId,
  onRegenerate,
  isGenerating = false,
}: RenamePreviewProps) {
  const { updateImage } = useUploadStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingAlt, setIsEditingAlt] = useState(false);
  const [editedName, setEditedName] = useState(image.generatedName || '');
  const [editedAlt, setEditedAlt] = useState(image.generatedAltText || '');

  const handleSaveName = () => {
    // Sanitize the name
    const sanitized = editedName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);

    updateImage(siteId, image.id, { generatedName: sanitized });
    setEditedName(sanitized);
    setIsEditingName(false);
  };

  const handleSaveAlt = () => {
    const trimmed = editedAlt.trim().slice(0, 125);
    updateImage(siteId, image.id, { generatedAltText: trimmed });
    setEditedAlt(trimmed);
    setIsEditingAlt(false);
  };

  const handleCancelName = () => {
    setEditedName(image.generatedName || '');
    setIsEditingName(false);
  };

  const handleCancelAlt = () => {
    setEditedAlt(image.generatedAltText || '');
    setIsEditingAlt(false);
  };

  const getExtension = () => {
    return image.originalName.split('.').pop()?.toLowerCase() || 'jpg';
  };

  if (!image.generatedName && !isGenerating) {
    return (
      <div className="p-2 bg-muted/50 rounded text-xs text-muted-foreground">
        Nom SEO non genere
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="p-2 bg-muted rounded text-xs flex items-center gap-2">
        <span className="animate-spin">⏳</span>
        <span>Analyse de l&apos;image et generation...</span>
      </div>
    );
  }

  return (
    <div className="p-2 bg-muted rounded text-xs space-y-2">
      {/* Header with status */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground font-medium">SEO:</span>
        {image.status === 'uploaded' && (
          <Badge variant="secondary" className="bg-green-100 text-green-800 text-[10px]">
            Uploade
          </Badge>
        )}
        {image.status === 'ready' && (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-[10px]">
            Pret
          </Badge>
        )}
      </div>

      {/* Filename */}
      <div className="space-y-1">
        <span className="text-muted-foreground">Nom fichier:</span>
        {isEditingName ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Input
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="h-7 text-xs font-mono"
                placeholder="nom-seo-fichier"
              />
              <span className="text-muted-foreground">.{getExtension()}</span>
            </div>
            <div className="flex gap-1">
              <Button size="sm" className="h-5 text-[10px] px-2" onClick={handleSaveName}>
                OK
              </Button>
              <Button size="sm" variant="ghost" className="h-5 text-[10px] px-2" onClick={handleCancelName}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono break-all">
              {image.generatedName}.{getExtension()}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-2 text-[10px]"
              onClick={() => {
                setEditedName(image.generatedName || '');
                setIsEditingName(true);
              }}
              disabled={image.status === 'uploaded'}
            >
              Editer
            </Button>
          </div>
        )}
      </div>

      {/* Alt text */}
      <div className="space-y-1">
        <span className="text-muted-foreground">Alt text:</span>
        {isEditingAlt ? (
          <div className="space-y-1">
            <Input
              value={editedAlt}
              onChange={(e) => setEditedAlt(e.target.value)}
              className="h-7 text-xs"
              placeholder="Description de l'image..."
              maxLength={125}
            />
            <div className="flex gap-1">
              <Button size="sm" className="h-5 text-[10px] px-2" onClick={handleSaveAlt}>
                OK
              </Button>
              <Button size="sm" variant="ghost" className="h-5 text-[10px] px-2" onClick={handleCancelAlt}>
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="break-all italic">
              {image.generatedAltText || <span className="text-muted-foreground">Non defini</span>}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-2 text-[10px]"
              onClick={() => {
                setEditedAlt(image.generatedAltText || '');
                setIsEditingAlt(true);
              }}
              disabled={image.status === 'uploaded'}
            >
              Editer
            </Button>
          </div>
        )}
      </div>

      {/* Regenerate button */}
      <div className="pt-1 border-t border-border/50">
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs w-full"
          onClick={() => onRegenerate(image.id)}
          disabled={image.status === 'uploaded'}
        >
          Regenerer nom + alt
        </Button>
      </div>

      {/* WordPress URL */}
      {image.wordpressUrl && (
        <div className="pt-1 border-t border-border/50">
          <a
            href={image.wordpressUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all"
          >
            {image.wordpressUrl}
          </a>
        </div>
      )}
    </div>
  );
}
