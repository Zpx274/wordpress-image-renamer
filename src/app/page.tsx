import { SiteConnector } from '@/components/site-connector';
import { RecentSites } from '@/components/recent-sites';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto py-12 px-4">
        <div className="flex flex-col items-center gap-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              WordPress Image Renamer
            </h1>
            <p className="text-muted-foreground max-w-md">
              Renommez vos images pour le SEO et uploadez-les directement sur WordPress
            </p>
          </div>

          {/* Sites récents */}
          <RecentSites />

          {/* Séparateur */}
          <div className="flex items-center gap-4 w-full max-w-md">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">ou connecter un nouveau site</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Formulaire de connexion */}
          <SiteConnector />
        </div>
      </main>
    </div>
  );
}
