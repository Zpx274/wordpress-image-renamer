import { NextRequest, NextResponse } from 'next/server';

// Fetch Elementor data for a page to understand its structure
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteUrl = searchParams.get('siteUrl');
    const pageId = searchParams.get('pageId');
    const token = searchParams.get('token');
    const username = searchParams.get('username');
    const appPassword = searchParams.get('appPassword');

    if (!siteUrl || !pageId) {
      return NextResponse.json(
        { success: false, error: 'siteUrl et pageId requis' },
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
        { status: 400 }
      );
    }

    const baseUrl = siteUrl.replace(/\/$/, '');

    // Fetch page with Elementor meta
    const response = await fetch(
      `${baseUrl}/wp-json/wp/v2/pages/${pageId}?_fields=id,title,meta`,
      {
        headers: { Authorization: authHeader },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { success: false, error: `Erreur WordPress: ${error}` },
        { status: response.status }
      );
    }

    const pageData = await response.json();

    // Try to get Elementor data from meta
    // Elementor stores data in _elementor_data meta field
    // We need to fetch it via a different endpoint or check if it's exposed

    // Try fetching the raw post meta
    const metaResponse = await fetch(
      `${baseUrl}/wp-json/wp/v2/pages/${pageId}?context=edit`,
      {
        headers: { Authorization: authHeader },
      }
    );

    let elementorData = null;
    let imageWidgets: Array<{
      id: string;
      type: string;
      currentUrl?: string;
      settings?: Record<string, unknown>;
    }> = [];

    if (metaResponse.ok) {
      const fullPageData = await metaResponse.json();

      // Check for Elementor data in meta
      if (fullPageData.meta && fullPageData.meta._elementor_data) {
        try {
          elementorData = JSON.parse(fullPageData.meta._elementor_data);

          // Extract image widgets recursively
          const findImageWidgets = (elements: unknown[]): void => {
            for (const element of elements) {
              const el = element as Record<string, unknown>;
              if (el.widgetType === 'image' || el.widgetType === 'image-box') {
                const settings = el.settings as Record<string, unknown> | undefined;
                // Log full settings to debug
                console.log('Found image widget:', el.id, 'settings:', JSON.stringify(settings, null, 2));

                // Try to get URL from different possible locations
                let currentUrl = (settings?.image as Record<string, unknown>)?.url as string | undefined;

                // Also check for background_image or other image fields
                if (!currentUrl && settings) {
                  const bgImage = settings.background_image as Record<string, unknown>;
                  if (bgImage?.url) currentUrl = bgImage.url as string;
                }

                imageWidgets.push({
                  id: el.id as string,
                  type: el.widgetType as string,
                  currentUrl,
                  settings: settings,
                });
              }
              if (el.elements && Array.isArray(el.elements)) {
                findImageWidgets(el.elements);
              }
            }
          };

          if (Array.isArray(elementorData)) {
            findImageWidgets(elementorData);
          }
        } catch (e) {
          console.error('Error parsing Elementor data:', e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      page: {
        id: pageData.id,
        title: pageData.title?.rendered,
      },
      hasElementor: !!elementorData,
      imageWidgets,
      // Don't send full elementorData to avoid large payloads
      elementorWidgetCount: elementorData ? countWidgets(elementorData) : 0,
    });
  } catch (error) {
    console.error('Erreur fetch Elementor:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}

function countWidgets(elements: unknown[]): number {
  let count = 0;
  for (const element of elements) {
    const el = element as Record<string, unknown>;
    if (el.widgetType) count++;
    if (el.elements && Array.isArray(el.elements)) {
      count += countWidgets(el.elements);
    }
  }
  return count;
}

// Helper to fetch Elementor data trying pages, posts, then templates
async function fetchElementorData(
  baseUrl: string,
  pageId: number,
  authHeader: string
): Promise<{ data: unknown; endpoint: string } | null> {
  const endpoints = ['pages', 'posts', 'elementor_library'];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(
        `${baseUrl}/wp-json/wp/v2/${endpoint}/${pageId}?context=edit`,
        { headers: { Authorization: authHeader } }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.meta?._elementor_data) {
          return { data, endpoint };
        }
      }
    } catch {
      // Try next endpoint
    }
  }
  return null;
}

// Helper to clear Elementor cache after update
async function clearElementorCache(
  baseUrl: string,
  pageId: number,
  endpoint: string,
  authHeader: string,
  currentPageSettings?: string
): Promise<void> {
  try {
    // Update meta fields to force Elementor cache regeneration
    const cacheBreakMeta = {
      meta: {
        _elementor_css: '', // Clear generated CSS cache
        _elementor_page_settings: currentPageSettings || '',
        _elementor_edit_mode: 'builder',
        _elementor_version: '3.0.0', // Force version update
        _elementor_cache_bust: Date.now().toString(),
      },
    };

    await fetch(`${baseUrl}/wp-json/wp/v2/${endpoint}/${pageId}`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cacheBreakMeta),
    });
    console.log('Elementor cache cleared for', endpoint, pageId);
  } catch (error) {
    console.error('Failed to clear Elementor cache:', error);
    // Non-fatal error, continue
  }
}

// Update an image widget in Elementor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteUrl, pageId, token, username, appPassword, widgetId, newImageUrl, newImageId } = body;

    if (!siteUrl || !pageId || !widgetId || !newImageUrl) {
      return NextResponse.json(
        { success: false, error: 'Parametres manquants' },
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
        { status: 400 }
      );
    }

    const baseUrl = siteUrl.replace(/\/$/, '');

    // Fetch current Elementor data (try pages, posts, templates)
    console.log('Fetching Elementor data for', pageId);
    const result = await fetchElementorData(baseUrl, pageId, authHeader);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Pas de donnees Elementor trouvees (pages/posts/templates)' },
        { status: 400 }
      );
    }

    const { data: pageData, endpoint } = result;
    const meta = (pageData as Record<string, unknown>).meta as Record<string, unknown>;
    const pageSettings = meta._elementor_page_settings as string | undefined;

    let elementorData;
    try {
      elementorData = JSON.parse(meta._elementor_data as string);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Donnees Elementor invalides' },
        { status: 400 }
      );
    }

    // Find and update the widget recursively
    let found = false;
    let oldImageData: unknown = null;
    const updateWidget = (elements: unknown[]): boolean => {
      for (const element of elements) {
        const el = element as Record<string, unknown>;
        if (el.id === widgetId) {
          // Found the widget
          if (el.widgetType === 'image' || el.widgetType === 'image-box') {
            const settings = (el.settings || {}) as Record<string, unknown>;
            // Save old image data for logging
            oldImageData = settings.image;

            // Update image settings - keep existing structure, just update id and url
            const existingImage = (settings.image || {}) as Record<string, unknown>;
            settings.image = {
              ...existingImage, // Preserve other fields like size, alt, etc.
              id: newImageId ? Number(newImageId) : existingImage.id,
              url: newImageUrl,
            };
            el.settings = settings;
            found = true;
            console.log('Updated widget image:', { old: oldImageData, new: settings.image });
            return true;
          }
        }
        if (el.elements && Array.isArray(el.elements)) {
          if (updateWidget(el.elements)) return true;
        }
      }
      return false;
    };

    updateWidget(elementorData);

    if (!found) {
      return NextResponse.json(
        { success: false, error: `Widget ${widgetId} non trouve` },
        { status: 404 }
      );
    }

    // Save updated Elementor data
    console.log('Saving Elementor data to', endpoint, pageId);

    const updateData = {
      meta: {
        _elementor_data: JSON.stringify(elementorData),
        _elementor_edit_mode: 'builder',
      },
    };

    const updateResponse = await fetch(
      `${baseUrl}/wp-json/wp/v2/${endpoint}/${pageId}`,
      {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }
    );

    const updateResult = await updateResponse.json();
    console.log('Update response:', updateResponse.status);

    if (!updateResponse.ok) {
      return NextResponse.json(
        { success: false, error: `Erreur sauvegarde: ${JSON.stringify(updateResult)}` },
        { status: updateResponse.status }
      );
    }

    // Clear Elementor cache to force regeneration
    await clearElementorCache(baseUrl, pageId, endpoint, authHeader, pageSettings);

    // Verify the change was applied
    const verifyResult = await fetchElementorData(baseUrl, pageId, authHeader);
    let changeApplied = false;
    let foundUrlInVerify: string | null = null;

    if (verifyResult) {
      try {
        const verifyMeta = (verifyResult.data as Record<string, unknown>).meta as Record<string, unknown>;
        const verifyElementor = JSON.parse(verifyMeta._elementor_data as string);
        const checkWidget = (elements: unknown[]): boolean => {
          for (const element of elements) {
            const el = element as Record<string, unknown>;
            if (el.id === widgetId) {
              const settings = el.settings as Record<string, unknown>;
              const img = settings?.image as Record<string, unknown>;
              foundUrlInVerify = img?.url as string || null;
              console.log('Verify widget found:', { widgetId, expectedUrl: newImageUrl, actualUrl: foundUrlInVerify, fullImage: img });
              if (img?.url === newImageUrl) {
                return true;
              }
            }
            if (el.elements && Array.isArray(el.elements)) {
              if (checkWidget(el.elements)) return true;
            }
          }
          return false;
        };
        changeApplied = checkWidget(verifyElementor);
      } catch (e) {
        console.error('Verify parse error:', e);
      }
    }

    console.log('Change applied:', changeApplied, 'Found URL:', foundUrlInVerify, 'Expected:', newImageUrl);

    if (!changeApplied) {
      return NextResponse.json({
        success: false,
        error: `WordPress a ignore la mise a jour. Le champ _elementor_data n'est probablement pas expose via REST API.

Solutions:
1. Ajouter ce code dans functions.php:
   register_post_meta('page', '_elementor_data', ['show_in_rest' => true, 'single' => true, 'type' => 'string']);
   register_post_meta('page', '_elementor_css', ['show_in_rest' => true, 'single' => true, 'type' => 'string']);

2. Ou installer le plugin MCP Elementor Helper`,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Widget mis a jour avec succes',
      endpoint,
    });
  } catch (error) {
    console.error('Erreur update Elementor:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      },
      { status: 500 }
    );
  }
}
