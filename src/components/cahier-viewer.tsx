'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

  useEffect(() => {
    if (rawText.trim()) {
      const parsed = parseCahierDesCharges(rawText);
      setParsedCahier(parsed);
    } else {
      setParsedCahier({});
    }
  }, [rawText]);

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
            Collez le texte du cahier des charges pour extraire les informations SEO
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
