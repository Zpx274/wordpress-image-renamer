import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { RenameContext } from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function ensureUniqueName(baseName: string, existingNames: string[]): string {
  if (!existingNames.includes(baseName)) {
    return baseName;
  }

  let counter = 1;
  let newName = `${baseName}-${counter}`;

  while (existingNames.includes(newName)) {
    counter++;
    newName = `${baseName}-${counter}`;
  }

  return newName;
}

function sanitizeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9-]/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .slice(0, 60); // Max 60 characters
}

function getMediaType(mimeType: string): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (validTypes.includes(mimeType)) {
    return mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  }
  return 'image/jpeg'; // Default fallback
}

async function fetchImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn('Failed to fetch image:', response.status);
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return { base64, mimeType: contentType };
  } catch (error) {
    console.warn('Error fetching image:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { context, existingNames = [], imageBase64, mimeType, imageUrl } = body as {
      context: RenameContext;
      existingNames: string[];
      imageBase64?: string;
      mimeType?: string;
      imageUrl?: string;
    };

    if (!context.pageTitle && !context.pageSlug) {
      return NextResponse.json(
        { error: 'Page cible requise pour générer un nom SEO' },
        { status: 400 }
      );
    }

    // Try to get image: either from base64 directly or fetch from URL
    let finalBase64 = imageBase64;
    let finalMimeType = mimeType;

    if (!finalBase64 && imageUrl) {
      const fetched = await fetchImageAsBase64(imageUrl);
      if (fetched) {
        finalBase64 = fetched.base64;
        finalMimeType = fetched.mimeType;
      }
    }

    const hasImage = finalBase64 && finalMimeType;

    const prompt = `Tu es un expert SEO spécialisé dans le nommage de fichiers images et la rédaction de textes alternatifs pour le référencement.

${hasImage ? 'Analyse l\'image fournie et génère' : 'Génère'} :
1. Un nom de fichier optimisé SEO
2. Un texte alternatif (alt text) descriptif pour l'accessibilité et le SEO

CONTEXTE :
- Entreprise : ${context.nomEntreprise || 'Non spécifié'}
- Secteur : ${context.secteurActivite || 'Non spécifié'}
- Page cible : ${context.pageTitle} (slug: ${context.pageSlug})
- Service principal : ${context.servicePrincipal || 'Non spécifié'}
- Localités : ${context.villesPrincipales?.join(', ') || 'Non spécifié'}
- Consignes additionnelles : ${context.customInstructions || 'Aucune'}
${context.originalFileName ? `- Nom original du fichier : ${context.originalFileName}` : ''}

RÈGLES POUR LE NOM DE FICHIER :
1. Format : slug en minuscules avec tirets (pas d'underscores)
2. Pas d'accents ni caractères spéciaux
3. Maximum 60 caractères
4. Inclure si pertinent : service + localité + descripteur de ce que montre l'image
5. Éviter les mots génériques seuls (image, photo, img)
6. Pas d'extension dans le nom

RÈGLES POUR LE TEXTE ALTERNATIF :
1. Décrire ce que montre l'image de manière concise
2. Inclure le contexte métier si pertinent (entreprise, service)
3. Maximum 125 caractères
4. Pas de "Image de..." ou "Photo de..." au début
5. Utile pour l'accessibilité et le SEO

EXEMPLES :
Nom: paysagiste-evreux-terrasse-bois-moderne
Alt: Terrasse en bois exotique réalisée par un paysagiste à Évreux avec jardinières intégrées

Nom: elagage-arbre-chene-vernon
Alt: Élagueur professionnel intervenant sur un chêne centenaire à Vernon

Réponds UNIQUEMENT au format JSON suivant, sans autre texte :
{"filename": "nom-du-fichier", "altText": "Texte alternatif descriptif"}`;

    // Build message content with or without image
    const messageContent: Anthropic.MessageCreateParams['messages'][0]['content'] = [];

    // Add image if provided
    if (hasImage) {
      messageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: getMediaType(finalMimeType!),
          data: finalBase64!,
        },
      });
    }

    // Add text prompt
    messageContent.push({
      type: 'text',
      text: prompt,
    });

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-20250414',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: messageContent,
        },
      ],
    });

    // Extract the text from the response
    const responseContent = message.content[0];
    if (responseContent.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON response
    let filename: string;
    let altText: string;

    try {
      // Clean up response - remove markdown code blocks if present
      let jsonText = responseContent.text.trim();

      // Remove ```json and ``` markers
      jsonText = jsonText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');

      const parsed = JSON.parse(jsonText);
      filename = parsed.filename || '';
      altText = parsed.altText || '';
    } catch {
      // Fallback if JSON parsing fails - try to extract from text
      const text = responseContent.text.trim();
      filename = text.split('\n')[0] || 'image';
      altText = '';
    }

    // Sanitize and ensure uniqueness
    const suggestedName = ensureUniqueName(sanitizeSlug(filename), existingNames);

    return NextResponse.json({
      success: true,
      suggestedName,
      altText: altText.slice(0, 125), // Ensure max length
    });
  } catch (error) {
    console.error('Erreur génération nom SEO:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la génération du nom',
      },
      { status: 500 }
    );
  }
}
