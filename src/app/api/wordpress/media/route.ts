import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteUrl = searchParams.get('siteUrl');
    const token = searchParams.get('token');
    const username = searchParams.get('username');
    const appPassword = searchParams.get('appPassword');
    const page = searchParams.get('page') || '1';
    const perPage = searchParams.get('perPage') || '20';

    if (!siteUrl) {
      return NextResponse.json(
        { success: false, error: 'URL du site requise' },
        { status: 400 }
      );
    }

    // Build auth header
    let authHeader: string;
    if (token) {
      authHeader = `Bearer ${token}`;
    } else if (username && appPassword) {
      const credentials = Buffer.from(`${username}:${appPassword}`).toString('base64');
      authHeader = `Basic ${credentials}`;
    } else {
      return NextResponse.json(
        { success: false, error: 'Authentification requise' },
        { status: 401 }
      );
    }

    const baseUrl = siteUrl.replace(/\/$/, '');

    // Fetch media library
    const response = await fetch(
      `${baseUrl}/wp-json/wp/v2/media?per_page=${perPage}&page=${page}&media_type=image&_fields=id,title,alt_text,source_url,media_details,date`,
      {
        headers: {
          Authorization: authHeader,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `Erreur WordPress: ${errorText}` },
        { status: response.status }
      );
    }

    const media = await response.json();
    const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1');
    const total = parseInt(response.headers.get('X-WP-Total') || '0');

    // Format media items
    const formattedMedia = media.map((item: any) => ({
      id: item.id,
      title: item.title?.rendered || '',
      altText: item.alt_text || '',
      url: item.source_url,
      thumbnail: item.media_details?.sizes?.thumbnail?.source_url ||
                 item.media_details?.sizes?.medium?.source_url ||
                 item.source_url,
      width: item.media_details?.width,
      height: item.media_details?.height,
      date: item.date,
    }));

    return NextResponse.json({
      success: true,
      media: formattedMedia,
      pagination: {
        page: parseInt(page),
        perPage: parseInt(perPage),
        totalPages,
        total,
      },
    });
  } catch (error) {
    console.error('Erreur récupération médiathèque:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// Update media title and alt text
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteUrl, token, username, appPassword, mediaId, title, altText } = body;

    if (!siteUrl || !mediaId) {
      return NextResponse.json(
        { success: false, error: 'Paramètres manquants' },
        { status: 400 }
      );
    }

    // Build auth header
    let authHeader: string;
    if (token) {
      authHeader = `Bearer ${token}`;
    } else if (username && appPassword) {
      const credentials = Buffer.from(`${username}:${appPassword}`).toString('base64');
      authHeader = `Basic ${credentials}`;
    } else {
      return NextResponse.json(
        { success: false, error: 'Authentification requise' },
        { status: 401 }
      );
    }

    const baseUrl = siteUrl.replace(/\/$/, '');

    // Update media
    const updateData: Record<string, string> = {};
    if (title !== undefined) updateData.title = title;
    if (altText !== undefined) updateData.alt_text = altText;

    const response = await fetch(
      `${baseUrl}/wp-json/wp/v2/media/${mediaId}`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `Erreur mise à jour: ${errorText}` },
        { status: response.status }
      );
    }

    const updatedMedia = await response.json();

    return NextResponse.json({
      success: true,
      media: {
        id: updatedMedia.id,
        title: updatedMedia.title?.rendered || '',
        altText: updatedMedia.alt_text || '',
      },
    });
  } catch (error) {
    console.error('Erreur mise à jour média:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
