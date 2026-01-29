# PRD - WordPress Image Renamer

## 📋 Informations Projet

| Champ | Valeur |
|-------|--------|
| **Nom du projet** | WordPress Image Renamer |
| **Version** | 1.0.0 |
| **Date** | Janvier 2025 |
| **Auteur** | Virgil / Mindset Solutions |
| **Statut** | Draft |

---

## 🎯 Vision & Objectifs

### Problème à résoudre
Lors de la création de sites WordPress pour les clients, l'équipe doit :
1. Récupérer/recevoir des images du client
2. Les renommer manuellement pour le SEO (souvent oublié ou mal fait)
3. Les uploader sur WordPress
4. Les associer aux bonnes pages

Ce processus est chronophage, répétitif et source d'erreurs (noms incohérents, oublis d'optimisation SEO).

### Solution proposée
Une webapp permettant de :
- Connecter un site WordPress
- Visualiser les pages du site et le cahier des charges
- Uploader des images en batch
- Associer chaque image à une page cible
- Générer automatiquement des noms SEO-friendly via IA
- Uploader les images renommées vers la médiathèque WordPress

### Objectifs mesurables
- Réduire le temps de gestion des images de 30min à 5min par site
- Garantir 100% des images avec un nom SEO optimisé
- Standardiser le processus pour toute l'équipe

---

## 🏗️ Architecture Technique

### Stack recommandée

| Composant | Technologie | Justification |
|-----------|-------------|---------------|
| **Framework** | Next.js 14+ (App Router) | Full-stack, Server Actions, rapide |
| **UI** | shadcn/ui + Tailwind CSS | Composants accessibles, design clean |
| **State** | Zustand | Léger, simple, persiste en localStorage |
| **API WordPress** | REST API native | Standard, pas de plugin requis |
| **IA Renommage** | Claude API (claude-sonnet-4-20250514) | Génération de noms SEO intelligents |
| **Upload** | react-dropzone | Drag & drop, preview, validation |
| **Storage local** | localStorage / IndexedDB | Persistance des sessions, credentials |

### Structure des dossiers

```
wordpress-image-renamer/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Landing / Connexion
│   ├── dashboard/
│   │   ├── page.tsx                # Dashboard principal
│   │   └── [siteId]/
│   │       ├── page.tsx            # Vue site spécifique
│   │       ├── pages/
│   │       │   └── page.tsx        # Liste des pages WP
│   │       ├── upload/
│   │       │   └── page.tsx        # Zone d'upload
│   │       └── cahier/
│   │           └── page.tsx        # Affichage cahier des charges
│   └── api/
│       ├── wordpress/
│       │   ├── connect/route.ts    # Test connexion WP
│       │   ├── pages/route.ts      # Get pages WP
│       │   ├── media/route.ts      # Upload média
│       │   └── upload/route.ts     # Upload batch
│       └── ai/
│           └── rename/route.ts     # Génération noms SEO
├── components/
│   ├── ui/                         # shadcn components
│   ├── site-connector.tsx          # Formulaire connexion
│   ├── page-list.tsx               # Liste pages WP
│   ├── image-uploader.tsx          # Dropzone + preview
│   ├── image-card.tsx              # Card image avec association
│   ├── rename-preview.tsx          # Preview nom généré
│   ├── cahier-viewer.tsx           # Affichage cahier des charges
│   └── batch-processor.tsx         # Traitement batch final
├── lib/
│   ├── wordpress.ts                # Client API WordPress
│   ├── ai-renamer.ts               # Logique renommage IA
│   ├── utils.ts                    # Utilitaires
│   └── stores/
│       ├── site-store.ts           # Store sites connectés
│       └── upload-store.ts         # Store images en cours
├── types/
│   └── index.ts                    # Types TypeScript
└── docs/
    └── PRD.md                      # Ce document
```

---

## 📝 Fonctionnalités Détaillées

### F1 - Connexion Site WordPress

#### Description
Permettre à l'utilisateur de connecter un site WordPress en fournissant l'URL et les credentials API.

#### User Stories
- **US1.1** : En tant qu'utilisateur, je veux entrer l'URL d'un site WordPress pour m'y connecter
- **US1.2** : En tant qu'utilisateur, je veux entrer mes credentials (username + Application Password) pour m'authentifier
- **US1.3** : En tant qu'utilisateur, je veux voir un indicateur de connexion réussie/échouée
- **US1.4** : En tant qu'utilisateur, je veux que mes connexions récentes soient sauvegardées localement

#### Critères d'acceptation
- [ ] Formulaire avec champs : URL, Username, Application Password
- [ ] Validation de l'URL (format valide, https préféré)
- [ ] Test de connexion via `GET /wp-json/wp/v2/users/me`
- [ ] Message d'erreur explicite si échec (mauvais credentials, site non accessible, REST API désactivée)
- [ ] Sauvegarde des sites connectés en localStorage (sans le password en clair)
- [ ] Liste des sites récents avec reconnexion rapide

#### Données requises
```typescript
interface WordPressSite {
  id: string;                    // UUID généré
  url: string;                   // https://example.com
  name: string;                  // Nom du site (récupéré via API)
  username: string;              // Username WP
  applicationPassword?: string;  // Stocké de manière sécurisée ou ressaisi
  lastConnected: Date;
  status: 'connected' | 'disconnected' | 'error';
}
```

#### Endpoint WordPress utilisé
```
GET /wp-json/wp/v2/users/me
Headers: Authorization: Basic base64(username:application_password)
```

---

### F2 - Liste des Pages WordPress

#### Description
Afficher toutes les pages du site WordPress connecté pour permettre l'association avec les images.

#### User Stories
- **US2.1** : En tant qu'utilisateur, je veux voir la liste de toutes les pages du site
- **US2.2** : En tant qu'utilisateur, je veux voir le titre et le slug de chaque page
- **US2.3** : En tant qu'utilisateur, je veux pouvoir filtrer/rechercher dans les pages
- **US2.4** : En tant qu'utilisateur, je veux voir l'arborescence des pages (parent/enfant)

#### Critères d'acceptation
- [ ] Récupération de toutes les pages via API (pagination gérée)
- [ ] Affichage en liste avec : Titre, Slug, Parent, Statut
- [ ] Barre de recherche pour filtrer par titre
- [ ] Indication visuelle de la hiérarchie (indentation ou arbre)
- [ ] Possibilité de sélectionner une page pour l'association

#### Données requises
```typescript
interface WordPressPage {
  id: number;
  title: string;
  slug: string;
  status: 'publish' | 'draft' | 'private';
  parent: number;              // 0 si pas de parent
  link: string;                // URL complète
  template: string;            // Template Elementor si applicable
}
```

#### Endpoint WordPress utilisé
```
GET /wp-json/wp/v2/pages?per_page=100&page=1&_fields=id,title,slug,status,parent,link,template
```

---

### F3 - Affichage Cahier des Charges

#### Description
Permettre de visualiser et/ou coller le cahier des charges du client pour contextualiser le renommage.

#### User Stories
- **US3.1** : En tant qu'utilisateur, je veux pouvoir coller le texte du cahier des charges
- **US3.2** : En tant qu'utilisateur, je veux que les infos clés soient extraites automatiquement
- **US3.3** : En tant qu'utilisateur, je veux voir un résumé des infos utiles pour le SEO

#### Critères d'acceptation
- [ ] Zone de texte pour coller le cahier des charges (format texte brut)
- [ ] Parsing automatique des champs structurés (voir format ci-dessous)
- [ ] Affichage structuré des infos extraites
- [ ] Sauvegarde du cahier avec le site en localStorage

#### Format du Cahier des Charges (à parser)
```typescript
interface CahierDesCharges {
  nomEntreprise: string;           // "Nom entreprise :"
  secteurActivite: string;         // "Secteur activite :"
  telephone: string;               // "Numero telephone :"
  email: string;                   // "Email redirection :"
  adresse: string;                 // "Adresse postale :"
  objectifSite: string;            // "Objectif site :"
  cibleSite: string;               // "Cible site :"
  zonesActivite: string;           // "Zones activite :"
  villesChoisies: string[];        // "Villes choisies :"
  tonAdopter: string;              // "Ton a adopter :"
  servicePrincipal: string;        // "Service principal :"
  arborescence: ArborescenceItem[];// Parsing de l'arborescence
  charteGraphique: string;         // "Charte graphique :"
}

interface ArborescenceItem {
  titre: string;
  info?: string;
  sousRubriques?: ArborescenceItem[];
}
```

#### Exemple de parsing
Input:
```
Nom entreprise : AU VERT Concepteur Paysage
Secteur activite : Paysagiste (aménagement, elagage, abattage, entretien)
Villes choisies : évreux, vernon, val de reuil, anet
Service principal : Conception de massifs et aménagement d'allée
```

Output:
```json
{
  "nomEntreprise": "AU VERT Concepteur Paysage",
  "secteurActivite": "Paysagiste (aménagement, elagage, abattage, entretien)",
  "villesChoisies": ["évreux", "vernon", "val de reuil", "anet"],
  "servicePrincipal": "Conception de massifs et aménagement d'allée"
}
```

---

### F4 - Upload d'Images

#### Description
Permettre l'upload d'images en drag & drop avec preview et validation.

#### User Stories
- **US4.1** : En tant qu'utilisateur, je veux glisser-déposer plusieurs images d'un coup
- **US4.2** : En tant qu'utilisateur, je veux voir un aperçu de chaque image uploadée
- **US4.3** : En tant qu'utilisateur, je veux voir le nom original et la taille de chaque image
- **US4.4** : En tant qu'utilisateur, je veux pouvoir supprimer une image de la liste

#### Critères d'acceptation
- [ ] Dropzone acceptant : JPG, JPEG, PNG, WebP, GIF
- [ ] Limite de taille : 10MB par image
- [ ] Preview thumbnail pour chaque image
- [ ] Affichage : nom original, dimensions, taille
- [ ] Bouton de suppression par image
- [ ] Compteur d'images uploadées
- [ ] Validation des formats avec message d'erreur

#### Données requises
```typescript
interface UploadedImage {
  id: string;                    // UUID
  file: File;                    // Fichier original
  originalName: string;          // Nom original
  size: number;                  // Taille en bytes
  dimensions: {
    width: number;
    height: number;
  };
  preview: string;               // URL blob pour preview
  status: 'pending' | 'processing' | 'ready' | 'uploaded' | 'error';
  
  // Après association
  targetPage?: WordPressPage;
  customInstructions?: string;
  generatedName?: string;
  
  // Après upload WP
  wordpressMediaId?: number;
  wordpressUrl?: string;
}
```

---

### F5 - Association Image → Page

#### Description
Permettre d'associer chaque image à une page cible pour contextualiser le renommage.

#### User Stories
- **US5.1** : En tant qu'utilisateur, je veux sélectionner une page cible pour chaque image
- **US5.2** : En tant qu'utilisateur, je veux pouvoir ajouter des consignes custom (mots-clés, localité)
- **US5.3** : En tant qu'utilisateur, je veux pouvoir associer plusieurs images à la même page
- **US5.4** : En tant qu'utilisateur, je veux voir clairement quelles images sont associées/non associées

#### Critères d'acceptation
- [ ] Dropdown ou modal de sélection de page par image
- [ ] Champ texte pour consignes additionnelles
- [ ] Badge/indicateur visuel d'association sur chaque image
- [ ] Possibilité d'association en batch (sélectionner plusieurs images → même page)
- [ ] Filtre pour voir : Toutes / Associées / Non associées

#### UX recommandée
Option 1 : **Dropdown inline** sur chaque card image
Option 2 : **Drag & drop** des images vers les pages (plus visuel mais plus complexe)
Option 3 : **Sélection multiple** + bouton "Associer à..." (bon compromis)

Recommandation : **Option 3** pour le MVP, évolutif vers Option 2 plus tard.

---

### F6 - Renommage SEO par IA

#### Description
Générer automatiquement des noms de fichiers optimisés SEO basés sur le contexte.

#### User Stories
- **US6.1** : En tant qu'utilisateur, je veux que l'IA génère un nom SEO pour chaque image
- **US6.2** : En tant qu'utilisateur, je veux voir une preview du nom avant validation
- **US6.3** : En tant qu'utilisateur, je veux pouvoir modifier le nom généré
- **US6.4** : En tant qu'utilisateur, je veux que les doublons soient gérés automatiquement (suffixe numérique)

#### Critères d'acceptation
- [ ] Appel API Claude pour génération de nom
- [ ] Contexte envoyé : page cible, cahier des charges, consignes custom
- [ ] Format de sortie : slug-seo-friendly (lowercase, tirets, pas d'accents)
- [ ] Preview éditable du nom généré
- [ ] Gestion des doublons : ajout automatique de -1, -2, etc.
- [ ] Bouton "Régénérer" pour obtenir une alternative

#### Logique de renommage

**Input pour l'IA :**
```typescript
interface RenameContext {
  // Contexte page
  pageTitle: string;
  pageSlug: string;
  
  // Contexte site (depuis cahier des charges)
  nomEntreprise: string;
  secteurActivite: string;
  villesPrincipales: string[];
  servicePrincipal: string;
  
  // Consignes utilisateur
  customInstructions?: string;  // "localité: Évreux", "mot-clé: terrasse bois"
  
  // Infos image (optionnel, si on veut être fancy)
  originalFileName?: string;
  imageIndex?: number;          // Position dans le batch pour la même page
}
```

**Prompt IA :**
```
Tu es un expert SEO spécialisé dans le nommage de fichiers images pour le référencement.

Génère un nom de fichier optimisé SEO pour une image destinée à un site web.

CONTEXTE :
- Entreprise : {nomEntreprise}
- Secteur : {secteurActivite}
- Page cible : {pageTitle} (slug: {pageSlug})
- Service principal : {servicePrincipal}
- Localités : {villesPrincipales.join(', ')}
- Consignes additionnelles : {customInstructions || 'Aucune'}

RÈGLES DE NOMMAGE :
1. Format : slug en minuscules avec tirets (pas d'underscores)
2. Pas d'accents ni caractères spéciaux
3. Maximum 60 caractères
4. Inclure si pertinent : service + localité + descripteur
5. Éviter les mots génériques seuls (image, photo, img)
6. Pas d'extension dans le nom (sera ajoutée automatiquement)

EXEMPLES DE BONS NOMS :
- paysagiste-evreux-creation-terrasse-bois
- amenagement-jardin-vernon-massif-fleurs
- elagage-arbre-val-de-reuil-professionnel

Réponds UNIQUEMENT avec le nom de fichier, sans extension, sans explication.
```

**Output attendu :**
```
paysagiste-evreux-amenagement-allee-pierre
```

#### Gestion des doublons
```typescript
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
```

---

### F7 - Upload vers WordPress

#### Description
Uploader les images renommées vers la médiathèque WordPress.

#### User Stories
- **US7.1** : En tant qu'utilisateur, je veux uploader toutes les images en un clic
- **US7.2** : En tant qu'utilisateur, je veux voir la progression de l'upload
- **US7.3** : En tant qu'utilisateur, je veux voir un récapitulatif final avec les liens

#### Critères d'acceptation
- [ ] Upload batch avec progression
- [ ] Renommage du fichier AVANT upload
- [ ] Gestion des erreurs individuelles (une erreur n'arrête pas le batch)
- [ ] Récapitulatif : nom final, URL WordPress, statut
- [ ] Bouton pour ouvrir la médiathèque WordPress

#### Endpoint WordPress utilisé
```
POST /wp-json/wp/v2/media
Headers: 
  - Authorization: Basic base64(username:application_password)
  - Content-Disposition: attachment; filename="nom-seo-fichier.jpg"
  - Content-Type: image/jpeg
Body: [binary image data]
```

#### Réponse WordPress
```json
{
  "id": 1234,
  "source_url": "https://example.com/wp-content/uploads/2025/01/nom-seo-fichier.jpg",
  "title": { "rendered": "nom-seo-fichier" },
  "alt_text": "",
  "media_details": {
    "width": 1920,
    "height": 1080,
    "sizes": { ... }
  }
}
```

---

## 🔌 API Endpoints (Next.js)

### POST /api/wordpress/connect
Test de connexion à un site WordPress.

**Request:**
```typescript
{
  url: string;
  username: string;
  applicationPassword: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  site?: {
    name: string;
    url: string;
    userId: number;
  };
  error?: string;
}
```

### GET /api/wordpress/pages
Récupère les pages d'un site connecté.

**Query params:**
```
siteUrl: string
username: string
applicationPassword: string
```

**Response:**
```typescript
{
  pages: WordPressPage[];
  total: number;
}
```

### POST /api/wordpress/upload
Upload une image vers WordPress.

**Request (multipart/form-data):**
```
file: File
filename: string (nom SEO)
siteUrl: string
username: string
applicationPassword: string
```

**Response:**
```typescript
{
  success: boolean;
  media?: {
    id: number;
    url: string;
    title: string;
  };
  error?: string;
}
```

### POST /api/ai/rename
Génère un nom SEO pour une image.

**Request:**
```typescript
{
  context: RenameContext;
  existingNames: string[];  // Pour éviter les doublons
}
```

**Response:**
```typescript
{
  suggestedName: string;
  alternatives?: string[];  // Optionnel : autres suggestions
}
```

---

## 🎨 UI/UX Guidelines

### Écrans principaux

#### 1. Écran de connexion
```
┌─────────────────────────────────────────────────────────┐
│  🖼️ WordPress Image Renamer                             │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Sites récents                                    │   │
│  │ ┌─────────────────────────────────────────────┐ │   │
│  │ │ 🌐 au-vert.com          Dernière: 2j       │ │   │
│  │ │ 🌐 client-xyz.fr        Dernière: 5j       │ │   │
│  │ └─────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ── ou connecter un nouveau site ──                    │
│                                                         │
│  URL du site     [https://example.com           ]      │
│  Username        [admin                         ]      │
│  App Password    [••••••••••••••••             ]      │
│                                                         │
│              [ 🔌 Se connecter ]                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 2. Dashboard site
```
┌─────────────────────────────────────────────────────────┐
│  ← Retour    au-vert.com    ✓ Connecté                 │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │   📄        │ │   📤        │ │   📋        │       │
│  │   Pages     │ │   Upload    │ │   Cahier    │       │
│  │   (12)      │ │   (0)       │ │   ✓         │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Workflow rapide                                  │   │
│  │                                                  │   │
│  │ 1. Collez le cahier des charges                 │   │
│  │ 2. Uploadez vos images                          │   │
│  │ 3. Associez-les aux pages                       │   │
│  │ 4. Validez les noms SEO                         │   │
│  │ 5. Uploadez vers WordPress                      │   │
│  │                                                  │   │
│  │         [ 🚀 Commencer ]                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 3. Vue Upload & Association
```
┌─────────────────────────────────────────────────────────┐
│  ← Dashboard    Upload & Renommage                      │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐ ┌──────────────────────┐ │
│  │ 📤 Zone d'upload         │ │ 📄 Pages disponibles │ │
│  │                          │ │                      │ │
│  │  ┌────────────────────┐  │ │ ☐ Accueil            │ │
│  │  │                    │  │ │ ☐ Aménagement        │ │
│  │  │   Glissez vos      │  │ │   ├ Massifs          │ │
│  │  │   images ici       │  │ │   ├ Maçonnerie       │ │
│  │  │                    │  │ │   ├ Clôtures         │ │
│  │  │   ou [Parcourir]   │  │ │   └ Terrasse         │ │
│  │  │                    │  │ │ ☐ Entretien          │ │
│  │  └────────────────────┘  │ │ ☐ Étude de jardin    │ │
│  │                          │ │ ☐ Élagage            │ │
│  │  12 images • 45 MB       │ │                      │ │
│  └──────────────────────────┘ └──────────────────────┘ │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Images uploadées                    [Associer ▼]│   │
│  ├─────────────────────────────────────────────────┤   │
│  │ ☐ ┌─────┐ IMG_001.jpg    → Terrasse             │   │
│  │   │     │ 2.4 MB          paysagiste-evreux-... │   │
│  │   └─────┘ [Consignes: localité évreux      ] ✏️ │   │
│  │                                                  │   │
│  │ ☐ ┌─────┐ photo_jardin.png  → Non associée      │   │
│  │   │     │ 1.1 MB            [Sélectionner page] │   │
│  │   └─────┘                                        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [ Générer tous les noms ]  [ Uploader vers WP (12) ]  │
└─────────────────────────────────────────────────────────┘
```

### Palette de couleurs suggérée
```css
:root {
  --primary: #2563eb;      /* Bleu - actions principales */
  --success: #16a34a;      /* Vert - succès, connecté */
  --warning: #f59e0b;      /* Orange - attention */
  --error: #dc2626;        /* Rouge - erreurs */
  --neutral: #6b7280;      /* Gris - texte secondaire */
  --background: #f9fafb;   /* Fond clair */
  --surface: #ffffff;      /* Cards, modals */
}
```

---

## 📅 Plan de Développement

### Phase 1 : Setup & Connexion (2-3h)
- [ ] Init projet Next.js + Tailwind + shadcn
- [ ] Page de connexion WordPress
- [ ] API route `/api/wordpress/connect`
- [ ] Stockage localStorage des sites
- [ ] UI de sélection site récent

### Phase 2 : Pages & Cahier (2-3h)
- [ ] API route `/api/wordpress/pages`
- [ ] Composant liste des pages (avec hiérarchie)
- [ ] Composant cahier des charges (textarea + parsing)
- [ ] Store Zustand pour état global

### Phase 3 : Upload & Association (3-4h)
- [ ] Composant dropzone avec react-dropzone
- [ ] Preview des images uploadées
- [ ] UI d'association image → page
- [ ] Champ consignes custom par image
- [ ] Store pour les images uploadées

### Phase 4 : Renommage IA & Upload WP (3-4h)
- [ ] API route `/api/ai/rename`
- [ ] Intégration Claude API
- [ ] Preview et édition des noms générés
- [ ] API route `/api/wordpress/upload`
- [ ] Upload batch avec progression
- [ ] Récapitulatif final

### Phase 5 (Future) : Intégration CRM
- [ ] API pour récupérer la liste des sites depuis le CRM
- [ ] Auth JWT vers le CRM
- [ ] Import automatique du cahier des charges

---

## 🔐 Sécurité

### Credentials WordPress
- **Ne jamais stocker** les Application Passwords en clair dans localStorage
- Option 1 : Demander le password à chaque session
- Option 2 : Chiffrement côté client (moins sécurisé mais plus pratique)
- Option 3 : Session côté serveur (plus complexe)

**Recommandation MVP** : Option 1 (ressaisie du password)

### Validation des inputs
- Sanitizer les URLs (éviter les injections)
- Valider les types MIME des images
- Limiter la taille des uploads (10MB)

---

## 📚 Ressources

### WordPress REST API
- [Documentation officielle](https://developer.wordpress.org/rest-api/)
- [Media endpoint](https://developer.wordpress.org/rest-api/reference/media/)
- [Application Passwords](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/)

### Libraries
- [shadcn/ui](https://ui.shadcn.com/)
- [react-dropzone](https://react-dropzone.js.org/)
- [Zustand](https://zustand-demo.pmnd.rs/)

---

## ✅ Checklist de lancement

- [ ] Tests de connexion sur différents hébergeurs WP
- [ ] Test avec images de différentes tailles
- [ ] Gestion des erreurs réseau
- [ ] Messages d'erreur user-friendly
- [ ] Responsive mobile (si nécessaire)
- [ ] Documentation utilisateur basique

---

*Document généré pour Mindset Solutions - Janvier 2025*
