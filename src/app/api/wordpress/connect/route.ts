import { NextRequest, NextResponse } from 'next/server';
import { testConnection, normalizeUrl, AuthMethod } from '@/lib/wordpress';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { url, username, password, authMethod = 'jwt' } = body as {
      url: string;
      username: string;
      password: string;
      authMethod?: AuthMethod;
    };

    // Validation des champs
    if (!url || !username || !password) {
      return NextResponse.json(
        { success: false, error: 'Tous les champs sont requis' },
        { status: 400 }
      );
    }

    // Validation de l'URL
    const normalizedUrl = normalizeUrl(url);
    try {
      new URL(normalizedUrl);
    } catch {
      return NextResponse.json(
        { success: false, error: 'URL invalide' },
        { status: 400 }
      );
    }

    // Tester la connexion
    const result = await testConnection({
      url: normalizedUrl,
      username,
      password,
      authMethod,
    });

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 401 });
    }
  } catch (error) {
    console.error('Erreur connexion WordPress:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
