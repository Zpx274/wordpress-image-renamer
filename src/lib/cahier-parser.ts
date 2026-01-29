import { CahierDesCharges, ArborescenceItem } from '@/types';

/**
 * Parse le texte du cahier des charges et extrait les informations structurées
 */
export function parseCahierDesCharges(text: string): Partial<CahierDesCharges> {
  const result: Partial<CahierDesCharges> = {};

  // Patterns de recherche (insensible à la casse et aux accents)
  const patterns: Record<keyof Omit<CahierDesCharges, 'arborescence' | 'villesChoisies'>, RegExp> = {
    nomEntreprise: /nom\s*(?:de\s*l[''])?entreprise\s*[:\-]?\s*(.+)/i,
    secteurActivite: /secteur\s*(?:d[''])?activit[eé]\s*[:\-]?\s*(.+)/i,
    telephone: /(?:num[eé]ro\s*(?:de\s*)?)?t[eé]l[eé]phone\s*[:\-]?\s*(.+)/i,
    email: /(?:email|e-mail|mail)\s*(?:redirection)?\s*[:\-]?\s*(.+)/i,
    adresse: /adresse\s*(?:postale)?\s*[:\-]?\s*(.+)/i,
    objectifSite: /objectif\s*(?:du\s*)?site\s*[:\-]?\s*(.+)/i,
    cibleSite: /cible\s*(?:du\s*)?site\s*[:\-]?\s*(.+)/i,
    zonesActivite: /zones?\s*(?:d[''])?activit[eé]\s*[:\-]?\s*(.+)/i,
    tonAdopter: /ton\s*[àa]\s*adopter\s*[:\-]?\s*(.+)/i,
    servicePrincipal: /service\s*principal\s*[:\-]?\s*(.+)/i,
    charteGraphique: /charte\s*graphique\s*[:\-]?\s*(.+)/i,
  };

  // Extraire chaque champ
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern);
    if (match && match[1]) {
      result[key as keyof typeof patterns] = match[1].trim();
    }
  }

  // Extraire les villes choisies
  const villesMatch = text.match(/villes?\s*choisies?\s*[:\-]?\s*(.+)/i);
  if (villesMatch && villesMatch[1]) {
    result.villesChoisies = villesMatch[1]
      .split(/[,;]/)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }

  // Parser l'arborescence si présente
  const arborescenceMatch = text.match(/arborescence\s*[:\-]?\s*([\s\S]*?)(?=(?:\n\n|\n[A-Z]|$))/i);
  if (arborescenceMatch && arborescenceMatch[1]) {
    result.arborescence = parseArborescence(arborescenceMatch[1]);
  }

  return result;
}

/**
 * Parse l'arborescence du site
 */
function parseArborescence(text: string): ArborescenceItem[] {
  const lines = text.split('\n').filter((line) => line.trim());
  const result: ArborescenceItem[] = [];
  const stack: { item: ArborescenceItem; level: number }[] = [];

  for (const line of lines) {
    // Calculer le niveau d'indentation
    const leadingSpaces = line.match(/^[\s\-•*]*/)?.[0].length || 0;
    const level = Math.floor(leadingSpaces / 2);
    const content = line.replace(/^[\s\-•*]+/, '').trim();

    if (!content) continue;

    // Extraire le titre et l'info optionnelle
    const infoMatch = content.match(/^(.+?)\s*\((.+?)\)\s*$/);
    const item: ArborescenceItem = {
      titre: infoMatch ? infoMatch[1].trim() : content,
      info: infoMatch ? infoMatch[2].trim() : undefined,
      sousRubriques: [],
    };

    // Trouver le parent approprié
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      result.push(item);
    } else {
      stack[stack.length - 1].item.sousRubriques?.push(item);
    }

    stack.push({ item, level });
  }

  return result;
}

/**
 * Convertit le cahier des charges en texte formaté
 */
export function cahierToText(cahier: Partial<CahierDesCharges>): string {
  const lines: string[] = [];

  if (cahier.nomEntreprise) lines.push(`Nom entreprise : ${cahier.nomEntreprise}`);
  if (cahier.secteurActivite) lines.push(`Secteur activite : ${cahier.secteurActivite}`);
  if (cahier.telephone) lines.push(`Numero telephone : ${cahier.telephone}`);
  if (cahier.email) lines.push(`Email redirection : ${cahier.email}`);
  if (cahier.adresse) lines.push(`Adresse postale : ${cahier.adresse}`);
  if (cahier.objectifSite) lines.push(`Objectif site : ${cahier.objectifSite}`);
  if (cahier.cibleSite) lines.push(`Cible site : ${cahier.cibleSite}`);
  if (cahier.zonesActivite) lines.push(`Zones activite : ${cahier.zonesActivite}`);
  if (cahier.villesChoisies?.length) {
    lines.push(`Villes choisies : ${cahier.villesChoisies.join(', ')}`);
  }
  if (cahier.tonAdopter) lines.push(`Ton a adopter : ${cahier.tonAdopter}`);
  if (cahier.servicePrincipal) lines.push(`Service principal : ${cahier.servicePrincipal}`);
  if (cahier.charteGraphique) lines.push(`Charte graphique : ${cahier.charteGraphique}`);

  return lines.join('\n');
}
