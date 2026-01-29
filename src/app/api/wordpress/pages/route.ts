import { NextRequest, NextResponse } from 'next/server';
import { normalizeUrl, createBasicAuthHeader, createBearerAuthHeader } from '@/lib/wordpress';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteUrl = searchParams.get('siteUrl');
    const token = searchParams.get('token');
    const username = searchParams.get('username');
    const appPassword = searchParams.get('appPassword');

    if (!siteUrl) {
      return NextResponse.json(
        { success: false, error: 'URL du site requise' },
        { status: 400 }
      );
    }

    // Déterminer le header d'auth
    let authHeader: string;
    if (token) {
      authHeader = createBearerAuthHeader(token);
    } else if (username && appPassword) {
      authHeader = createBasicAuthHeader(username, appPassword);
    } else {
      return NextResponse.json(
        { success: false, error: 'Authentification requise' },
        { status: 401 }
      );
    }

    const url = normalizeUrl(siteUrl);
    const allPages: Array<{
      id: number;
      title: { rendered: string };
      slug: string;
      status: string;
      parent: number;
      link: string;
      template: string;
    }> = [];

    let page = 1;
    let hasMore = true;

    // Pagination pour récupérer toutes les pages
    while (hasMore) {
      const response = await fetch(
        `${url}/wp-json/wp/v2/pages?per_page=100&page=${page}&_fields=id,title,slug,status,parent,link,template`,
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          return NextResponse.json(
            { success: false, error: 'Authentification invalide' },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { success: false, error: `Erreur ${response.status}` },
          { status: response.status }
        );
      }

      const pages = await response.json();
      allPages.push(...pages);

      // Vérifier s'il y a plus de pages
      const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1');
      hasMore = page < totalPages;
      page++;
    }

    // Créer un map des IDs vers les slugs pour vérifier les parents
    const slugById = new Map<number, string>();
    allPages.forEach((p) => {
      slugById.set(p.id, p.slug);
    });

    // Regex pour détecter un slug se terminant par 5 chiffres (code postal)
    const postalCodeRegex = /\d{5}$/;

    // Filtrer les pages "longue traine" (dont le parent a un code postal dans le slug)
    // Mais garder les pages villes elles-mêmes (avec code postal dans leur propre slug)
    const filteredPages = allPages.filter((p) => {
      // Si pas de parent, on garde
      if (!p.parent || p.parent === 0) return true;

      // Récupérer le slug du parent
      const parentSlug = slugById.get(p.parent);
      if (!parentSlug) return true; // Parent non trouvé, on garde par sécurité

      // Si le parent a un code postal dans son slug, c'est une page longue traine -> exclure
      if (postalCodeRegex.test(parentSlug)) {
        return false;
      }

      return true;
    });

    // Transformer les données
    const formattedPages = filteredPages.map((p) => ({
      id: p.id,
      title: p.title.rendered,
      slug: p.slug,
      status: p.status,
      parent: p.parent,
      link: p.link,
      template: p.template || '',
    }));

    return NextResponse.json({
      success: true,
      pages: formattedPages,
      total: formattedPages.length,
      totalBeforeFilter: allPages.length,
    });
  } catch (error) {
    console.error('Erreur récupération pages:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
