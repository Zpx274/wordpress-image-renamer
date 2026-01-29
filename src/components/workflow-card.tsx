'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUploadStore } from '@/lib/stores/upload-store';
import { WordPressSite } from '@/types';

interface WorkflowCardProps {
  site: WordPressSite;
  cahierData?: {
    parsed?: {
      nomEntreprise?: string;
    };
  } | null;
  onNavigate: (tab: 'overview' | 'pages' | 'cahier' | 'upload') => void;
}

export function WorkflowCard({ site, cahierData, onNavigate }: WorkflowCardProps) {
  const { getImages } = useUploadStore();
  const images = getImages(site.id);

  // Calculate progress for each step
  const step1Done = !!cahierData?.parsed?.nomEntreprise;
  const step2Done = images.length > 0;
  const step3Done = images.some((img) => img.targetPage);
  const step4Done = images.some((img) => img.generatedName);
  const step5Done = images.some((img) => img.status === 'uploaded');

  // Calculate counts for display
  const associatedCount = images.filter((img) => img.targetPage).length;
  const namedCount = images.filter((img) => img.generatedName).length;
  const uploadedCount = images.filter((img) => img.status === 'uploaded').length;

  // Determine current step and next action
  const getCurrentStep = () => {
    if (!step1Done) return { step: 1, tab: 'cahier' as const, label: 'Commencer' };
    if (!step2Done) return { step: 2, tab: 'upload' as const, label: 'Uploader des images' };
    if (!step3Done) return { step: 3, tab: 'upload' as const, label: 'Associer aux pages' };
    if (!step4Done) return { step: 4, tab: 'upload' as const, label: 'Generer les noms' };
    if (!step5Done) return { step: 5, tab: 'upload' as const, label: 'Uploader vers WordPress' };
    return { step: 6, tab: 'upload' as const, label: 'Voir les resultats' };
  };

  const current = getCurrentStep();

  const steps = [
    {
      num: 1,
      label: 'Collez le cahier des charges du client',
      done: step1Done,
      detail: step1Done ? cahierData?.parsed?.nomEntreprise : undefined,
    },
    {
      num: 2,
      label: 'Uploadez vos images',
      done: step2Done,
      detail: step2Done ? `${images.length} image${images.length > 1 ? 's' : ''}` : undefined,
    },
    {
      num: 3,
      label: 'Associez-les aux pages cibles',
      done: step3Done,
      detail: step3Done ? `${associatedCount}/${images.length} associee${associatedCount > 1 ? 's' : ''}` : undefined,
    },
    {
      num: 4,
      label: 'Validez les noms SEO generes',
      done: step4Done,
      detail: step4Done ? `${namedCount}/${images.length} nommee${namedCount > 1 ? 's' : ''}` : undefined,
    },
    {
      num: 5,
      label: 'Uploadez vers WordPress',
      done: step5Done,
      detail: step5Done ? `${uploadedCount}/${images.length} uploadee${uploadedCount > 1 ? 's' : ''}` : undefined,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workflow rapide</CardTitle>
        <CardDescription>
          Suivez ces etapes pour renommer et uploader vos images
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {steps.map((step) => (
            <li key={step.num} className="flex items-start gap-3">
              <span
                className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.done
                    ? 'bg-green-500 text-white'
                    : current.step === step.num
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.done ? '✓' : step.num}
              </span>
              <div className="flex-1">
                <span className={step.done ? 'text-muted-foreground' : ''}>{step.label}</span>
                {step.detail && (
                  <span className="ml-2 text-xs text-green-600 font-medium">
                    ({step.detail})
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6">
          <Button onClick={() => onNavigate(current.tab)}>
            {current.label}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
