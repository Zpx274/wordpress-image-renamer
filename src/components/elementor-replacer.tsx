'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WordPressSite, UploadedImage } from '@/types';

interface ElementorWidget {
  id: string;
  type: string;
  currentUrl?: string;
}

interface ElementorReplacerProps {
  site: WordPressSite;
  uploadedImages: UploadedImage[];
}

export function ElementorReplacer({ site, uploadedImages }: ElementorReplacerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageWidgets, setPageWidgets] = useState<Record<number, ElementorWidget[]>>({});
  const [selectedMappings, setSelectedMappings] = useState<Record<string, string>>({}); // widgetId -> imageId
  const [replacingWidget, setReplacingWidget] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get unique pages from uploaded images
  const pagesWithImages = uploadedImages
    .filter((img) => img.targetPage && img.status === 'uploaded' && img.wordpressUrl)
    .reduce((acc, img) => {
      const pageId = img.targetPage!.id;
      if (!acc[pageId]) {
        acc[pageId] = {
          page: img.targetPage!,
          images: [],
        };
      }
      acc[pageId].images.push(img);
      return acc;
    }, {} as Record<number, { page: { id: number; title: string; slug: string }; images: UploadedImage[] }>);

  const fetchElementorWidgets = async (pageId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        siteUrl: site.url,
        pageId: pageId.toString(),
      });

      if (site.jwtToken) {
        params.set('token', site.jwtToken);
      } else if (site.applicationPassword) {
        params.set('username', site.username);
        params.set('appPassword', site.applicationPassword);
      }

      const response = await fetch(`/api/wordpress/elementor?${params}`);
      const data = await response.json();

      if (data.success) {
        setPageWidgets((prev) => ({
          ...prev,
          [pageId]: data.imageWidgets || [],
        }));

        if (data.imageWidgets?.length === 0) {
          setError(`Aucun widget image trouve sur la page. (${data.elementorWidgetCount} widgets au total)`);
        }
      } else {
        setError(data.error || 'Erreur lors de la recuperation');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  };

  const replaceImage = async (pageId: number, widgetId: string, image: UploadedImage) => {
    if (!image.wordpressUrl || !image.wordpressMediaId) {
      setError('Image non uploadee sur WordPress');
      return;
    }

    setReplacingWidget(widgetId);
    setError(null);
    setSuccessMessage(null);

    try {
      const body: Record<string, unknown> = {
        siteUrl: site.url,
        pageId,
        widgetId,
        newImageUrl: image.wordpressUrl,
        newImageId: image.wordpressMediaId,
      };

      if (site.jwtToken) {
        body.token = site.jwtToken;
      } else if (site.applicationPassword) {
        body.username = site.username;
        body.appPassword = site.applicationPassword;
      }

      console.log('Sending replace request:', body);

      const response = await fetch('/api/wordpress/elementor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      console.log('Replace response:', data);

      if (data.success) {
        setSuccessMessage(`Image remplacee avec succes ! Rechargez la page Elementor pour voir le changement.`);
        // Update the widget's current URL in state
        setPageWidgets((prev) => ({
          ...prev,
          [pageId]: prev[pageId].map((w) =>
            w.id === widgetId ? { ...w, currentUrl: image.wordpressUrl } : w
          ),
        }));
      } else {
        setError(data.error || 'Erreur lors du remplacement');
      }
    } catch (err) {
      console.error('Replace error:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setReplacingWidget(null);
    }
  };

  if (Object.keys(pagesWithImages).length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Remplacer dans Elementor</CardTitle>
        <CardDescription>
          Remplacez des images existantes dans vos pages Elementor
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info about plugin requirement */}
        <Alert>
          <AlertDescription className="text-xs text-muted-foreground">
            Pour que le remplacement fonctionne, installez le plugin <strong>image-renamer-helper.php</strong> sur WordPress
            (dossier wordpress-plugin/ du projet).
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="whitespace-pre-wrap text-sm">{error}</AlertDescription>
          </Alert>
        )}

        {successMessage && (
          <Alert>
            <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
          </Alert>
        )}

        {Object.entries(pagesWithImages).map(([pageIdStr, { page, images }]) => {
          const pageId = parseInt(pageIdStr);
          const widgets = pageWidgets[pageId];

          return (
            <div key={pageId} className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{page.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {images.length} image{images.length > 1 ? 's' : ''} uploadee{images.length > 1 ? 's' : ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchElementorWidgets(pageId)}
                  disabled={isLoading}
                >
                  {isLoading ? 'Chargement...' : widgets ? 'Actualiser' : 'Explorer Elementor'}
                </Button>
              </div>

              {widgets && widgets.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Widgets image trouves ({widgets.length}):</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {widgets.map((widget) => {
                      const selectedImg = images.find((i) => i.id === selectedMappings[widget.id]);
                      return (
                        <div
                          key={widget.id}
                          className="border rounded-lg p-2 bg-background space-y-2"
                        >
                          {/* Current image preview */}
                          <div className="relative aspect-video bg-muted rounded overflow-hidden">
                            {widget.currentUrl ? (
                              <img
                                src={widget.currentUrl}
                                alt="Image actuelle"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                                Pas d&apos;image
                              </div>
                            )}
                            <Badge
                              variant="secondary"
                              className="absolute top-1 left-1 text-[10px] bg-black/70 text-white"
                            >
                              {widget.type}
                            </Badge>
                          </div>

                          {/* Arrow indicator */}
                          {selectedImg && (
                            <>
                              <div className="flex justify-center text-muted-foreground">
                                ↓
                              </div>
                              {/* New image preview */}
                              <div className="relative aspect-video bg-muted rounded overflow-hidden border-2 border-green-500">
                                <img
                                  src={selectedImg.wordpressUrl || selectedImg.preview}
                                  alt="Nouvelle image"
                                  className="w-full h-full object-cover"
                                />
                                <Badge
                                  variant="secondary"
                                  className="absolute top-1 left-1 text-[10px] bg-green-600 text-white"
                                >
                                  Nouveau
                                </Badge>
                              </div>
                            </>
                          )}

                          {/* Select + Replace */}
                          <div className="space-y-1">
                            <select
                              className="w-full text-xs border rounded px-2 py-1.5"
                              value={selectedMappings[widget.id] || ''}
                              onChange={(e) =>
                                setSelectedMappings((prev) => ({
                                  ...prev,
                                  [widget.id]: e.target.value,
                                }))
                              }
                            >
                              <option value="">Choisir image...</option>
                              {images.map((img) => (
                                <option key={img.id} value={img.id}>
                                  {img.generatedName || img.originalName}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              className="w-full h-7 text-xs"
                              disabled={!selectedMappings[widget.id] || replacingWidget === widget.id}
                              onClick={() => {
                                const img = images.find((i) => i.id === selectedMappings[widget.id]);
                                if (img) replaceImage(pageId, widget.id, img);
                              }}
                            >
                              {replacingWidget === widget.id ? 'Remplacement...' : 'Remplacer'}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {widgets && widgets.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Aucun widget image trouve sur cette page.
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
