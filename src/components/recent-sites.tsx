'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSiteStore } from '@/lib/stores/site-store';
import { WordPressSite } from '@/types';

function formatLastConnected(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
  return `Il y a ${Math.floor(diffDays / 30)} mois`;
}

interface ReconnectDialogProps {
  site: WordPressSite;
  onClose: () => void;
  onSuccess: (site: WordPressSite, password: string, token?: string) => void;
}

function ReconnectDialog({ site, onClose, onSuccess }: ReconnectDialogProps) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReconnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/wordpress/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: site.url,
          username: site.username,
          password,
          authMethod: site.authMethod || 'jwt',
        }),
      });

      const data = await response.json();

      if (data.success) {
        onSuccess(site, password, data.token);
      } else {
        setError(data.error || 'Erreur de connexion');
      }
    } catch {
      setError('Impossible de se connecter');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-sm mx-4">
        <CardHeader>
          <CardTitle className="text-lg">Reconnexion a {site.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReconnect} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder={site.authMethod === 'application_password' ? 'Application Password' : 'Mot de passe WordPress'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {site.authMethod === 'application_password' ? 'Application Password' : 'JWT Authentication'}
              </p>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? 'Connexion...' : 'Connecter'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function RecentSites() {
  const router = useRouter();
  const { sites, updateSite, setCurrentSite, removeSite } = useSiteStore();
  const [reconnectingSite, setReconnectingSite] = useState<WordPressSite | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isAutoConnecting, setIsAutoConnecting] = useState<string | null>(null);
  const [autoConnectError, setAutoConnectError] = useState<string | null>(null);

  // Éviter l'erreur d'hydratation en attendant le montage côté client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Connexion automatique avec JWT token
  const handleAutoConnect = async (site: WordPressSite) => {
    if (!site.jwtToken) {
      setReconnectingSite(site);
      return;
    }

    setIsAutoConnecting(site.id);
    setAutoConnectError(null);

    try {
      // Valider le token en appelant l'API
      const response = await fetch(`${site.url}/wp-json/wp/v2/users/me`, {
        headers: {
          Authorization: `Bearer ${site.jwtToken}`,
        },
      });

      if (response.ok) {
        // Token valide, connexion directe
        const updatedSite = {
          ...site,
          lastConnected: new Date(),
          status: 'connected' as const,
        };
        updateSite(site.id, updatedSite);
        setCurrentSite(updatedSite);
        router.push(`/dashboard/${site.id}`);
      } else {
        // Token expiré, demander le mot de passe
        setReconnectingSite(site);
      }
    } catch {
      // Erreur réseau, demander le mot de passe
      setAutoConnectError('Token expire ou invalide');
      setReconnectingSite(site);
    } finally {
      setIsAutoConnecting(null);
    }
  };

  const handleSiteClick = (site: WordPressSite) => {
    // Si JWT avec token, tenter la connexion auto
    if (site.authMethod === 'jwt' && site.jwtToken) {
      handleAutoConnect(site);
    } else {
      // Sinon, demander le mot de passe
      setReconnectingSite(site);
    }
  };

  const handleReconnectSuccess = (site: WordPressSite, password: string, token?: string) => {
    const updatedSite = {
      ...site,
      jwtToken: token || site.jwtToken,
      applicationPassword: site.authMethod === 'application_password' ? password : undefined,
      lastConnected: new Date(),
      status: 'connected' as const,
    };
    updateSite(site.id, updatedSite);
    setCurrentSite(updatedSite);
    setReconnectingSite(null);
    router.push(`/dashboard/${site.id}`);
  };

  const handleRemoveSite = (e: React.MouseEvent, siteId: string) => {
    e.stopPropagation();
    if (confirm('Supprimer ce site de la liste ?')) {
      removeSite(siteId);
    }
  };

  // Ne pas rendre côté serveur pour éviter l'erreur d'hydratation
  if (!isMounted || sites.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Sites recents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {autoConnectError && (
            <Alert variant="destructive" className="mb-2">
              <AlertDescription>{autoConnectError}</AlertDescription>
            </Alert>
          )}
          {sites.map((site) => (
            <div
              key={site.id}
              className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
              onClick={() => handleSiteClick(site)}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-xl">
                  {isAutoConnecting === site.id ? '...' : '🌐'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{site.name}</p>
                    {site.authMethod === 'jwt' && site.jwtToken && (
                      <Badge variant="outline" className="text-xs">
                        Auto
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{site.url}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                  {formatLastConnected(site.lastConnected)}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => handleRemoveSite(e, site.id)}
                >
                  x
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {reconnectingSite && (
        <ReconnectDialog
          site={reconnectingSite}
          onClose={() => setReconnectingSite(null)}
          onSuccess={handleReconnectSuccess}
        />
      )}
    </>
  );
}
