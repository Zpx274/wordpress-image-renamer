'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSiteStore } from '@/lib/stores/site-store';

export default function DashboardPage() {
  const router = useRouter();
  const { currentSite, sites } = useSiteStore();

  useEffect(() => {
    // Rediriger vers le site courant ou la page d'accueil
    if (currentSite) {
      router.replace(`/dashboard/${currentSite.id}`);
    } else if (sites.length > 0) {
      router.replace('/');
    } else {
      router.replace('/');
    }
  }, [currentSite, sites, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Redirection...</p>
    </div>
  );
}
