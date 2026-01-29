'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSiteStore } from '@/lib/stores/site-store';
import { normalizeUrl, AuthMethod } from '@/lib/wordpress';

export function SiteConnector() {
  const router = useRouter();
  const { addSite, setCurrentSite } = useSiteStore();

  const [url, setUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('jwt');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/wordpress/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, username, password, authMethod }),
      });

      const data = await response.json();

      if (data.success) {
        const newSite = {
          id: crypto.randomUUID(),
          url: normalizeUrl(url),
          name: data.site.name,
          username,
          authMethod,
          // Stocker le token JWT (sera persisté en localStorage)
          jwtToken: data.token,
          // Application password gardé en mémoire seulement (pas persisté)
          applicationPassword: authMethod === 'application_password' ? password : undefined,
          lastConnected: new Date(),
          status: 'connected' as const,
        };

        addSite(newSite);
        setCurrentSite(newSite);
        router.push(`/dashboard/${newSite.id}`);
      } else {
        setError(data.error || 'Erreur de connexion');
      }
    } catch {
      setError('Impossible de se connecter au serveur');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Connecter un site WordPress</CardTitle>
        <CardDescription>
          Entrez les informations de connexion de votre site WordPress
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL du site</Label>
            <Input
              id="url"
              type="text"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Nom d&apos;utilisateur</Label>
            <Input
              id="username"
              type="text"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              placeholder={authMethod === 'jwt' ? 'Mot de passe WordPress' : 'xxxx xxxx xxxx xxxx'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Sélecteur de méthode d'auth */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={authMethod === 'jwt' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setAuthMethod('jwt')}
            >
              JWT Token
            </Button>
            <Button
              type="button"
              variant={authMethod === 'application_password' ? 'default' : 'outline'}
              size="sm"
              className="flex-1"
              onClick={() => setAuthMethod('application_password')}
            >
              App Password
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {authMethod === 'jwt'
              ? 'Utilise le plugin JWT Authentication (recommande)'
              : "Utilise l'Application Password natif de WordPress"}
          </p>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Connexion...' : 'Se connecter'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
