'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSiteStore } from '@/lib/stores/site-store';
import { useCahierStore } from '@/lib/stores/cahier-store';
import { WordPressSite, CahierDesCharges } from '@/types';
import { PageList } from '@/components/page-list';
import { CahierViewer } from '@/components/cahier-viewer';
import { ImageManager } from '@/components/image-manager';
import { WorkflowCard } from '@/components/workflow-card';
import { MediaLibrary } from '@/components/media-library';
import { useUploadStore } from '@/lib/stores/upload-store';

type Tab = 'overview' | 'pages' | 'cahier' | 'upload' | 'mediatheque';

export default function SiteDashboard() {
  const params = useParams();
  const router = useRouter();
  const { getSiteById, currentSite, setCurrentSite } = useSiteStore();
  const { getCahier, setCahier } = useCahierStore();
  const { getImages } = useUploadStore();
  const [site, setSite] = useState<WordPressSite | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Éviter l'erreur d'hydratation
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const siteId = params.siteId as string;
    const foundSite = getSiteById(siteId);

    if (!foundSite) {
      router.replace('/');
      return;
    }

    // Vérifier si on a une authentification valide (JWT token ou App Password)
    const hasAuth =
      foundSite.jwtToken ||
      foundSite.applicationPassword ||
      currentSite?.jwtToken ||
      currentSite?.applicationPassword;

    if (!hasAuth) {
      router.replace('/');
      return;
    }

    // Utiliser le site courant avec les credentials si disponible
    if (currentSite && currentSite.id === siteId) {
      setSite(currentSite);
    } else {
      setSite(foundSite);
      setCurrentSite(foundSite);
    }
  }, [params.siteId, getSiteById, currentSite, setCurrentSite, router, isMounted]);

  const handleSaveCahier = (parsed: Partial<CahierDesCharges>, rawText: string) => {
    if (site) {
      setCahier(site.id, parsed, rawText);
    }
  };

  if (!isMounted || !site) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  const cahierData = getCahier(site.id);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Retour
            </Link>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{site.name}</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Connecte
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{site.url}</p>
        </div>
      </header>

      {/* Navigation tabs */}
      <div className="border-b">
        <div className="container mx-auto px-4">
          <nav className="flex gap-4">
            {[
              { id: 'overview', label: 'Apercu' },
              { id: 'pages', label: 'Pages' },
              { id: 'cahier', label: 'Cahier des charges' },
              { id: 'upload', label: 'Upload' },
              { id: 'mediatheque', label: 'Mediatheque' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`py-3 px-1 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary font-medium'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        {activeTab === 'overview' && (
          <div className="grid gap-6">
            {/* Quick actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => setActiveTab('pages')}
              >
                <CardHeader className="pb-2">
                  <div className="text-3xl mb-2">📄</div>
                  <CardTitle className="text-lg">Pages</CardTitle>
                  <CardDescription>Voir les pages du site</CardDescription>
                </CardHeader>
              </Card>

              <Card
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => setActiveTab('upload')}
              >
                <CardHeader className="pb-2">
                  <div className="text-3xl mb-2">📤</div>
                  <CardTitle className="text-lg">Upload</CardTitle>
                  <CardDescription>Uploader des images</CardDescription>
                </CardHeader>
                <CardContent>
                  {getImages(site.id).length > 0 ? (
                    <Badge variant="secondary">
                      {getImages(site.id).length} image{getImages(site.id).length > 1 ? 's' : ''}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Aucune image</Badge>
                  )}
                </CardContent>
              </Card>

              <Card
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => setActiveTab('cahier')}
              >
                <CardHeader className="pb-2">
                  <div className="text-3xl mb-2">📋</div>
                  <CardTitle className="text-lg">Cahier des charges</CardTitle>
                  <CardDescription>Configurer le contexte SEO</CardDescription>
                </CardHeader>
                <CardContent>
                  {cahierData?.parsed?.nomEntreprise ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Configure
                    </Badge>
                  ) : (
                    <Badge variant="outline">A configurer</Badge>
                  )}
                </CardContent>
              </Card>

              <Card
                className="hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => setActiveTab('mediatheque')}
              >
                <CardHeader className="pb-2">
                  <div className="text-3xl mb-2">🖼️</div>
                  <CardTitle className="text-lg">Mediatheque</CardTitle>
                  <CardDescription>Optimiser les images existantes</CardDescription>
                </CardHeader>
              </Card>
            </div>

            {/* Workflow */}
            <WorkflowCard
              site={site}
              cahierData={cahierData}
              onNavigate={setActiveTab}
            />
          </div>
        )}

        {activeTab === 'pages' && <PageList site={site} />}

        {activeTab === 'cahier' && (
          <CahierViewer
            initialText={cahierData?.rawText || ''}
            onSave={handleSaveCahier}
          />
        )}

        {activeTab === 'upload' && <ImageManager site={site} />}

        {activeTab === 'mediatheque' && <MediaLibrary site={site} />}
      </main>
    </div>
  );
}
