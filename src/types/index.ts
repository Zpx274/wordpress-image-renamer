// Types pour WordPress Image Renamer

export type AuthMethod = 'application_password' | 'jwt';

export interface WordPressSite {
  id: string;
  url: string;
  name: string;
  username: string;
  authMethod: AuthMethod;
  // Pour Application Password (non stocké en localStorage)
  applicationPassword?: string;
  // Pour JWT (stocké en localStorage car c'est un token)
  jwtToken?: string;
  lastConnected: Date;
  status: 'connected' | 'disconnected' | 'error';
}

export interface WordPressPage {
  id: number;
  title: string;
  slug: string;
  status: 'publish' | 'draft' | 'private';
  parent: number;
  link: string;
  template: string;
}

export interface CahierDesCharges {
  nomEntreprise: string;
  secteurActivite: string;
  telephone: string;
  email: string;
  adresse: string;
  objectifSite: string;
  cibleSite: string;
  zonesActivite: string;
  villesChoisies: string[];
  tonAdopter: string;
  servicePrincipal: string;
  arborescence: ArborescenceItem[];
  charteGraphique: string;
}

export interface ArborescenceItem {
  titre: string;
  info?: string;
  sousRubriques?: ArborescenceItem[];
}

export interface UploadedImage {
  id: string;
  file: File;
  originalName: string;
  size: number;
  dimensions: {
    width: number;
    height: number;
  };
  preview: string;
  status: 'pending' | 'processing' | 'ready' | 'uploaded' | 'error';
  loadError?: string; // Error message if image couldn't be loaded
  targetPage?: WordPressPage;
  customInstructions?: string;
  generatedName?: string;
  generatedAltText?: string;
  wordpressMediaId?: number;
  wordpressUrl?: string;
}

export interface RenameContext {
  pageTitle: string;
  pageSlug: string;
  nomEntreprise: string;
  secteurActivite: string;
  villesPrincipales: string[];
  servicePrincipal: string;
  customInstructions?: string;
  originalFileName?: string;
  imageIndex?: number;
}

export interface ConnectResponse {
  success: boolean;
  site?: {
    name: string;
    url: string;
    userId: number;
  };
  token?: string; // JWT token si auth JWT
  error?: string;
}
