'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { WordPressSite } from '@/types';
import { useCahierStore } from '@/lib/stores/cahier-store';

interface MediaItem {
  id: number;
  title: string;
  altText: string;
  url: string;
  thumbnail: string;
  width?: number;
  height?: number;
  date: string;
}

interface MediaLibraryProps {
  site: WordPressSite;
}

export function MediaLibrary({ site }: MediaLibraryProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 });
  const [processResults, setProcessResults] = useState<{ success: number; errors: string[] }>({ success: 0, errors: [] });

  // Editable results
  const [generatedData, setGeneratedData] = useState<Record<number, { title: string; altText: string }>>({});

  const { getCahier } = useCahierStore();
  const cahier = getCahier(site.id);

  const fetchMedia = async (pageNum: number = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        siteUrl: site.url,
        page: pageNum.toString(),
        perPage: '24',
      });

      if (site.jwtToken) {
        params.set('token', site.jwtToken);
      } else if (site.applicationPassword) {
        params.set('username', site.username);
        params.set('appPassword', site.applicationPassword);
      }

      const response = await fetch(`/api/wordpress/media?${params}`);
      const data = await response.json();

      if (data.success) {
        setMedia(data.media);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
        setPage(pageNum);
      } else {
        setError(data.error || 'Erreur lors de la récupération');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(media.map(m => m.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const generateNames = async () => {
    const selected = media.filter(m => selectedIds.has(m.id));
    if (selected.length === 0) return;

    setIsProcessing(true);
    setProcessProgress({ current: 0, total: selected.length });
    setProcessResults({ success: 0, errors: [] });
    setGeneratedData({});

    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];
      setProcessProgress({ current: i + 1, total: selected.length });

      try {
        const context = {
          pageTitle: item.title || 'Image WordPress',
          pageSlug: '',
          nomEntreprise: cahier?.parsed?.nomEntreprise || '',
          secteurActivite: cahier?.parsed?.secteurActivite || '',
          villesPrincipales: cahier?.parsed?.villesChoisies || [],
          servicePrincipal: cahier?.parsed?.servicePrincipal || '',
          originalFileName: item.url.split('/').pop() || '',
        };

        // Pass imageUrl to let the server fetch it (avoids CORS issues)
        const response = await fetch('/api/ai/rename', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context, existingNames: [], imageUrl: item.url }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
          setGeneratedData(prev => ({
            ...prev,
            [item.id]: {
              title: data.suggestedName || '',
              altText: data.altText || '',
            },
          }));
          setProcessResults(prev => ({ ...prev, success: prev.success + 1 }));
        } else {
          throw new Error(data.error || 'Erreur génération');
        }
      } catch (err) {
        setProcessResults(prev => ({
          ...prev,
          errors: [...prev.errors, `${item.title || item.id}: ${err instanceof Error ? err.message : 'Erreur'}`],
        }));
      }
    }

    setIsProcessing(false);
  };

  const updateMedia = async () => {
    const toUpdate = Object.entries(generatedData);
    if (toUpdate.length === 0) return;

    setIsProcessing(true);
    setProcessProgress({ current: 0, total: toUpdate.length });
    setProcessResults({ success: 0, errors: [] });

    for (let i = 0; i < toUpdate.length; i++) {
      const [mediaId, data] = toUpdate[i];
      setProcessProgress({ current: i + 1, total: toUpdate.length });

      try {
        const body: Record<string, unknown> = {
          siteUrl: site.url,
          mediaId: parseInt(mediaId),
          title: data.title,
          altText: data.altText,
        };

        if (site.jwtToken) {
          body.token = site.jwtToken;
        } else if (site.applicationPassword) {
          body.username = site.username;
          body.appPassword = site.applicationPassword;
        }

        const response = await fetch('/api/wordpress/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const result = await response.json();

        if (result.success) {
          // Update local state
          setMedia(prev => prev.map(m =>
            m.id === parseInt(mediaId)
              ? { ...m, title: data.title, altText: data.altText }
              : m
          ));
          setProcessResults(prev => ({ ...prev, success: prev.success + 1 }));
        } else {
          throw new Error(result.error || 'Erreur mise à jour');
        }
      } catch (err) {
        setProcessResults(prev => ({
          ...prev,
          errors: [...prev.errors, `ID ${mediaId}: ${err instanceof Error ? err.message : 'Erreur'}`],
        }));
      }
    }

    setIsProcessing(false);
    setGeneratedData({});
    setSelectedIds(new Set());
  };

  const updateGeneratedField = (mediaId: number, field: 'title' | 'altText', value: string) => {
    setGeneratedData(prev => ({
      ...prev,
      [mediaId]: {
        ...prev[mediaId],
        [field]: value,
      },
    }));
  };

  const removeFromGenerated = (mediaId: number) => {
    setGeneratedData(prev => {
      const newData = { ...prev };
      delete newData[mediaId];
      return newData;
    });
  };

  const [regeneratingId, setRegeneratingId] = useState<number | null>(null);

  const regenerateSingle = async (mediaId: number) => {
    const item = media.find(m => m.id === mediaId);
    if (!item) return;

    setRegeneratingId(mediaId);

    try {
      const context = {
        pageTitle: item.title || 'Image WordPress',
        pageSlug: '',
        nomEntreprise: cahier?.parsed?.nomEntreprise || '',
        secteurActivite: cahier?.parsed?.secteurActivite || '',
        villesPrincipales: cahier?.parsed?.villesChoisies || [],
        servicePrincipal: cahier?.parsed?.servicePrincipal || '',
        originalFileName: item.url.split('/').pop() || '',
      };

      const response = await fetch('/api/ai/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, existingNames: [], imageUrl: item.url }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setGeneratedData(prev => ({
          ...prev,
          [mediaId]: {
            title: data.suggestedName || '',
            altText: data.altText || '',
          },
        }));
      }
    } catch (err) {
      console.error('Regenerate error:', err);
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Médiathèque WordPress</CardTitle>
        <CardDescription>
          Sélectionnez des images existantes pour optimiser leur titre et alt text
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Load button */}
        {media.length === 0 && !isLoading && (
          <Button onClick={() => fetchMedia(1)} disabled={isLoading}>
            Charger la médiathèque
          </Button>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            Chargement...
          </div>
        )}

        {/* Processing */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Traitement en cours...</span>
              <span>{processProgress.current}/{processProgress.total}</span>
            </div>
            <Progress value={(processProgress.current / processProgress.total) * 100} />
          </div>
        )}

        {/* Results */}
        {!isProcessing && (processResults.success > 0 || processResults.errors.length > 0) && (
          <Alert>
            <AlertDescription>
              {processResults.success > 0 && (
                <span className="text-green-600">{processResults.success} réussi(s)</span>
              )}
              {processResults.errors.length > 0 && (
                <span className="text-red-600 ml-2">{processResults.errors.length} erreur(s)</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Media grid */}
        {media.length > 0 && (
          <>
            {/* Actions bar */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Tout sélectionner
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Désélectionner
                </Button>
                <Button variant="outline" size="sm" onClick={() => fetchMedia(page)}>
                  Actualiser
                </Button>
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedIds.size} sélectionné(s) / {total} images
              </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {media.map((item) => {
                const isSelected = selectedIds.has(item.id);
                const hasGenerated = generatedData[item.id];
                const hasTitle = item.title && item.title.trim() !== '';
                const hasAlt = item.altText && item.altText.trim() !== '';

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border-2 cursor-pointer transition-all overflow-hidden ${
                      isSelected ? 'border-primary ring-2 ring-primary/50' : 'border-muted hover:border-muted-foreground/50'
                    }`}
                    onClick={() => toggleSelect(item.id)}
                  >
                    <div className="relative aspect-square">
                      <img
                        src={item.thumbnail}
                        alt={item.altText || item.title}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs">
                          ✓
                        </div>
                      )}
                      {hasGenerated && (
                        <Badge className="absolute bottom-1 left-1 text-[10px] bg-green-600">
                          Généré
                        </Badge>
                      )}
                    </div>
                    <div className="p-2 space-y-1 bg-muted/30">
                      <div className="flex items-start gap-1">
                        <span className="text-[10px] text-muted-foreground font-medium shrink-0">T:</span>
                        <span className={`text-[11px] truncate ${hasTitle ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                          {hasTitle ? item.title : 'Aucun titre'}
                        </span>
                      </div>
                      <div className="flex items-start gap-1">
                        <span className="text-[10px] text-muted-foreground font-medium shrink-0">A:</span>
                        <span className={`text-[11px] truncate ${hasAlt ? 'text-foreground' : 'text-muted-foreground italic'}`}>
                          {hasAlt ? item.altText : 'Aucun alt'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchMedia(page - 1)}
                disabled={page <= 1 || isLoading}
              >
                Précédent
              </Button>
              <span className="flex items-center text-sm">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchMedia(page + 1)}
                disabled={page >= totalPages || isLoading}
              >
                Suivant
              </Button>
            </div>

            {/* Generate button */}
            {selectedIds.size > 0 && Object.keys(generatedData).length === 0 && (
              <Button onClick={generateNames} disabled={isProcessing} className="w-full">
                Générer titres + alt text ({selectedIds.size} images)
              </Button>
            )}

            {/* Preview and edit generated data */}
            {Object.keys(generatedData).length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium">Aperçu des modifications ({Object.keys(generatedData).length}) :</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {Object.entries(generatedData).map(([mediaId, data]) => {
                    const item = media.find(m => m.id === parseInt(mediaId));
                    const isRegenerating = regeneratingId === parseInt(mediaId);
                    return (
                      <div key={mediaId} className="flex gap-3 p-2 border rounded-lg">
                        <img
                          src={item?.thumbnail}
                          alt=""
                          className="w-16 h-16 object-cover rounded flex-shrink-0"
                        />
                        <div className="flex-1 space-y-2 min-w-0">
                          <Input
                            value={data.title}
                            onChange={(e) => updateGeneratedField(parseInt(mediaId), 'title', e.target.value)}
                            placeholder="Titre"
                            className="h-8 text-sm"
                            disabled={isRegenerating}
                          />
                          <Input
                            value={data.altText}
                            onChange={(e) => updateGeneratedField(parseInt(mediaId), 'altText', e.target.value)}
                            placeholder="Alt text"
                            className="h-8 text-sm"
                            disabled={isRegenerating}
                          />
                        </div>
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => regenerateSingle(parseInt(mediaId))}
                            disabled={isRegenerating}
                            title="Regénérer"
                          >
                            {isRegenerating ? (
                              <span className="animate-spin">↻</span>
                            ) : (
                              '↻'
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeFromGenerated(parseInt(mediaId))}
                            disabled={isRegenerating}
                            title="Retirer"
                          >
                            ✕
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Button onClick={updateMedia} disabled={isProcessing || regeneratingId !== null} className="flex-1">
                    Appliquer sur WordPress ({Object.keys(generatedData).length})
                  </Button>
                  <Button variant="outline" onClick={() => setGeneratedData({})}>
                    Tout annuler
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

