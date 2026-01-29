'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { CahierDesCharges } from '@/types';
import { parseCahierDesCharges } from '@/lib/cahier-parser';

interface CahierViewerProps {
  initialText?: string;
  onSave?: (cahier: Partial<CahierDesCharges>, rawText: string) => void;
}

export function CahierViewer({ initialText = '', onSave }: CahierViewerProps) {
  const [rawText, setRawText] = useState(initialText);
  const [parsedCahier, setParsedCahier] = useState<Partial<CahierDesCharges>>({});
  const [isEditing, setIsEditing] = useState(!initialText);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (rawText.trim()) {
      const parsed = parseCahierDesCharges(rawText);
      setParsedCahier(parsed);
    } else {
      setParsedCahier({});
    }
  }, [rawText]);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoadingPdf(true);
    setPdfError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setRawText(data.text);
      } else {
        setPdfError(data.error || 'Erreur lors de la lecture du PDF');
      }
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsLoadingPdf(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = () => {
    onSave?.(parsedCahier, rawText);
    setIsEditing(false);
  };

  const hasData = Object.keys(parsedCahier).some((key) => {
    const value = parsedCahier[key as keyof CahierDesCharges];
    return value && (Array.isArray(value) ? value.length > 0 : true);
  });

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cahier des charges</CardTitle>
          <CardDescription>
            Importez un PDF ou collez le texte du cahier des charges
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* PDF Upload */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handlePdfUpload}
              className="hidden"
              id="pdf-upload"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoadingPdf}
            >
              Importer un PDF
            </Button>
            <span className="text-sm text-muted-foreground">ou collez le texte ci-dessous</span>
          </div>

          {isLoadingPdf && (
            <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                <span className="text-sm font-medium">Analyse du PDF en cours...</span>
              </div>
              <Progress value={66} className="h-2" />
              <p className="text-xs text-muted-foreground">Claude lit et extrait le contenu du document</p>
            </div>
          )}

          {pdfError && (
            <Alert variant="destructive">
              <AlertDescription>{pdfError}</AlertDescription>
            </Alert>
          )}

          <textarea
            className="w-full min-h-64 p-3 border rounded-md font-mono text-sm resize-y"
            placeholder={`Exemple de format:

Nom entreprise : AU VERT Concepteur Paysage
Secteur activite : Paysagiste
Numero telephone : 06 12 34 56 78
Email redirection : contact@example.com
Objectif site : Generer des leads
Cible site : Particuliers et professionnels
Zones activite : Eure, Eure-et-Loir
Villes choisies : Evreux, Vernon, Val de Reuil
Ton a adopter : Professionnel et chaleureux
Service principal : Amenagement de jardins`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />

          {hasData && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-2">Apercu des donnees extraites :</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {parsedCahier.nomEntreprise && (
                  <div>
                    <span className="text-muted-foreground">Entreprise:</span>{' '}
                    {parsedCahier.nomEntreprise}
                  </div>
                )}
                {parsedCahier.secteurActivite && (
                  <div>
                    <span className="text-muted-foreground">Secteur:</span>{' '}
                    {parsedCahier.secteurActivite}
                  </div>
                )}
                {parsedCahier.villesChoisies && parsedCahier.villesChoisies.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Villes:</span>{' '}
                    {parsedCahier.villesChoisies.join(', ')}
                  </div>
                )}
                {parsedCahier.servicePrincipal && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Service principal:</span>{' '}
                    {parsedCahier.servicePrincipal}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!rawText.trim()}>
              Enregistrer
            </Button>
            {initialText && (
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Annuler
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Cahier des charges</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Modifier
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="space-y-3">
            {parsedCahier.nomEntreprise && (
              <Field label="Entreprise" value={parsedCahier.nomEntreprise} />
            )}
            {parsedCahier.secteurActivite && (
              <Field label="Secteur" value={parsedCahier.secteurActivite} />
            )}
            {parsedCahier.servicePrincipal && (
              <Field label="Service principal" value={parsedCahier.servicePrincipal} />
            )}
            {parsedCahier.villesChoisies && parsedCahier.villesChoisies.length > 0 && (
              <div>
                <Label className="text-muted-foreground text-xs">Villes</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {parsedCahier.villesChoisies.map((ville, i) => (
                    <Badge key={i} variant="secondary">
                      {ville}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {parsedCahier.zonesActivite && (
              <Field label="Zones d'activite" value={parsedCahier.zonesActivite} />
            )}
            {parsedCahier.cibleSite && (
              <Field label="Cible" value={parsedCahier.cibleSite} />
            )}
            {parsedCahier.tonAdopter && (
              <Field label="Ton" value={parsedCahier.tonAdopter} />
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-4">
            Aucun cahier des charges configure
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <p className="text-sm">{value}</p>
    </div>
  );
}
