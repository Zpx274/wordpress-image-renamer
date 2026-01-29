import { NextRequest, NextResponse } from 'next/server';

function getExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext || 'jpg';
}

function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };
  return mimeTypes[extension] || 'image/jpeg';
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const seoName = formData.get('seoName') as string | null;
    const siteUrl = formData.get('siteUrl') as string | null;
    const altText = formData.get('altText') as string | null;
    const token = formData.get('token') as string | null;
    const username = formData.get('username') as string | null;
    const appPassword = formData.get('appPassword') as string | null;

    if (!file || !seoName || !siteUrl) {
      return NextResponse.json(
        { success: false, error: 'Paramètres manquants (file, seoName, siteUrl)' },
        { status: 400 }
      );
    }

    // Check file size (Vercel limit is 4.5MB on free tier)
    const maxSize = 4.5 * 1024 * 1024; // 4.5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)}MB). Limite: 4.5MB` },
        { status: 400 }
      );
    }

    if (!token && (!username || !appPassword)) {
      return NextResponse.json(
        { success: false, error: 'Authentification requise (token JWT ou username + appPassword)' },
        { status: 400 }
      );
    }

    // Build the final filename with extension
    const originalExt = getExtension(file.name);
    const finalFilename = `${seoName}.${originalExt}`;
    const mimeType = getMimeType(originalExt);

    // Get file bytes
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Build authorization header
    let authHeader: string;
    if (token) {
      authHeader = `Bearer ${token}`;
    } else {
      const credentials = Buffer.from(`${username}:${appPassword}`).toString('base64');
      authHeader = `Basic ${credentials}`;
    }

    // Upload to WordPress
    const baseUrl = siteUrl.replace(/\/$/, '');
    const uploadUrl = `${baseUrl}/wp-json/wp/v2/media`;

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(finalFilename)}"`,
        'Content-Type': mimeType,
      },
      body: buffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Erreur upload WordPress';

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch {
        errorMessage = errorText || errorMessage;
      }

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: response.status }
      );
    }

    const mediaData = await response.json();

    // Update alt text if provided
    if (altText && mediaData.id) {
      try {
        const updateUrl = `${baseUrl}/wp-json/wp/v2/media/${mediaData.id}`;
        await fetch(updateUrl, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            alt_text: altText,
          }),
        });
      } catch (altError) {
        console.error('Erreur mise a jour alt text:', altError);
        // Don't fail the upload if alt text update fails
      }
    }

    return NextResponse.json({
      success: true,
      media: {
        id: mediaData.id,
        url: mediaData.source_url,
        title: mediaData.title?.rendered || seoName,
        filename: finalFilename,
        altText: altText || '',
      },
    });
  } catch (error) {
    console.error('Erreur upload WordPress:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de l\'upload',
      },
      { status: 500 }
    );
  }
}
