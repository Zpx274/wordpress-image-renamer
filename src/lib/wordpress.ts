// Client API WordPress

export type AuthMethod = 'application_password' | 'jwt';

export interface WordPressCredentials {
  url: string;
  username: string;
  password: string;
  authMethod: AuthMethod;
}

export interface WordPressUser {
  id: number;
  name: string;
  slug: string;
  email: string;
}

export interface WordPressSiteInfo {
  name: string;
  url: string;
  userId: number;
}

export interface JWTTokenResponse {
  token: string;
  user_email: string;
  user_nicename: string;
  user_display_name: string;
}

export interface ConnectResult {
  success: boolean;
  site?: WordPressSiteInfo;
  token?: string; // JWT token si auth JWT
  error?: string;
}

/**
 * Normalise l'URL du site WordPress
 */
export function normalizeUrl(url: string): string {
  let normalizedUrl = url.trim();

  // Ajouter https:// si pas de protocole
  if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  // Supprimer le slash final
  normalizedUrl = normalizedUrl.replace(/\/+$/, '');

  return normalizedUrl;
}

/**
 * Crée l'en-tête d'authentification Basic
 */
export function createBasicAuthHeader(username: string, password: string): string {
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Crée l'en-tête d'authentification Bearer (JWT)
 */
export function createBearerAuthHeader(token: string): string {
  return `Bearer ${token}`;
}

/**
 * Obtient un token JWT depuis WordPress
 */
export async function getJWTToken(
  url: string,
  username: string,
  password: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const normalizedUrl = normalizeUrl(url);

  try {
    const response = await fetch(`${normalizedUrl}/wp-json/jwt-auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 403) {
        return {
          success: false,
          error: errorData.message || 'Identifiants invalides',
        };
      }
      if (response.status === 404) {
        return {
          success: false,
          error: "Le plugin JWT Auth n'est pas installé ou activé sur ce site.",
        };
      }
      return {
        success: false,
        error: errorData.message || `Erreur ${response.status}: ${response.statusText}`,
      };
    }

    const data: JWTTokenResponse = await response.json();
    return { success: true, token: data.token };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur de connexion JWT',
    };
  }
}

/**
 * Teste la connexion à un site WordPress avec Application Password
 */
export async function testConnectionWithAppPassword(
  url: string,
  username: string,
  password: string
): Promise<ConnectResult> {
  const normalizedUrl = normalizeUrl(url);
  const authHeader = createBasicAuthHeader(username, password);

  try {
    const response = await fetch(`${normalizedUrl}/wp-json/wp/v2/users/me`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'Identifiants invalides' };
      }
      if (response.status === 403) {
        return { success: false, error: 'Accès refusé. Vérifiez vos permissions.' };
      }
      if (response.status === 404) {
        return {
          success: false,
          error: "L'API REST WordPress n'est pas accessible.",
        };
      }
      return { success: false, error: `Erreur ${response.status}: ${response.statusText}` };
    }

    const userData: WordPressUser = await response.json();
    const siteName = await getSiteName(normalizedUrl, authHeader);

    return {
      success: true,
      site: {
        name: siteName,
        url: normalizedUrl,
        userId: userData.id,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur de connexion',
    };
  }
}

/**
 * Teste la connexion à un site WordPress avec JWT
 */
export async function testConnectionWithJWT(
  url: string,
  username: string,
  password: string
): Promise<ConnectResult> {
  const normalizedUrl = normalizeUrl(url);

  // Obtenir le token JWT
  const tokenResult = await getJWTToken(normalizedUrl, username, password);
  if (!tokenResult.success || !tokenResult.token) {
    return { success: false, error: tokenResult.error };
  }

  const authHeader = createBearerAuthHeader(tokenResult.token);

  try {
    // Valider le token en appelant users/me
    const response = await fetch(`${normalizedUrl}/wp-json/wp/v2/users/me`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { success: false, error: 'Token JWT invalide' };
    }

    const userData: WordPressUser = await response.json();
    const siteName = await getSiteName(normalizedUrl, authHeader);

    return {
      success: true,
      site: {
        name: siteName,
        url: normalizedUrl,
        userId: userData.id,
      },
      token: tokenResult.token,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur de connexion',
    };
  }
}

/**
 * Récupère le nom du site
 */
async function getSiteName(url: string, authHeader: string): Promise<string> {
  try {
    const response = await fetch(`${url}/wp-json`, {
      headers: { Authorization: authHeader },
    });
    if (response.ok) {
      const data = await response.json();
      return data.name || url;
    }
  } catch {
    // Ignorer l'erreur, utiliser l'URL comme nom
  }
  return url;
}

/**
 * Teste la connexion avec la méthode spécifiée
 */
export async function testConnection(credentials: WordPressCredentials): Promise<ConnectResult> {
  if (credentials.authMethod === 'jwt') {
    return testConnectionWithJWT(credentials.url, credentials.username, credentials.password);
  }
  return testConnectionWithAppPassword(credentials.url, credentials.username, credentials.password);
}
