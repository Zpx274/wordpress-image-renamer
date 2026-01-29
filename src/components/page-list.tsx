'use client';

import { useState, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WordPressPage, WordPressSite } from '@/types';

interface PageListProps {
  site: WordPressSite;
  onSelectPage?: (page: WordPressPage) => void;
  selectedPageId?: number;
}

interface PageTreeNode extends WordPressPage {
  children: PageTreeNode[];
  level: number;
}

function buildPageTree(pages: WordPressPage[]): PageTreeNode[] {
  const pageMap = new Map<number, PageTreeNode>();
  const roots: PageTreeNode[] = [];

  // Créer tous les nœuds
  pages.forEach((page) => {
    pageMap.set(page.id, { ...page, children: [], level: 0 });
  });

  // Construire l'arbre
  pages.forEach((page) => {
    const node = pageMap.get(page.id)!;
    if (page.parent === 0) {
      roots.push(node);
    } else {
      const parent = pageMap.get(page.parent);
      if (parent) {
        node.level = parent.level + 1;
        parent.children.push(node);
      } else {
        // Parent non trouvé, ajouter à la racine
        roots.push(node);
      }
    }
  });

  // Trier par titre
  const sortNodes = (nodes: PageTreeNode[]): PageTreeNode[] => {
    return nodes
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((node) => ({
        ...node,
        children: sortNodes(node.children),
      }));
  };

  return sortNodes(roots);
}

function flattenTree(nodes: PageTreeNode[]): PageTreeNode[] {
  const result: PageTreeNode[] = [];
  const traverse = (node: PageTreeNode) => {
    result.push(node);
    node.children.forEach(traverse);
  };
  nodes.forEach(traverse);
  return result;
}

export function PageList({ site, onSelectPage, selectedPageId }: PageListProps) {
  const [pages, setPages] = useState<WordPressPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPages = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({ siteUrl: site.url });
        if (site.jwtToken) {
          params.set('token', site.jwtToken);
        } else if (site.applicationPassword) {
          params.set('username', site.username);
          params.set('appPassword', site.applicationPassword);
        }

        const response = await fetch(`/api/wordpress/pages?${params}`);
        const data = await response.json();

        if (data.success) {
          setPages(data.pages);
        } else {
          setError(data.error || 'Erreur lors de la récupération des pages');
        }
      } catch {
        setError('Impossible de récupérer les pages');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPages();
  }, [site]);

  const pageTree = useMemo(() => buildPageTree(pages), [pages]);
  const flatPages = useMemo(() => flattenTree(pageTree), [pageTree]);

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return flatPages;
    const query = searchQuery.toLowerCase();
    return flatPages.filter(
      (page) =>
        page.title.toLowerCase().includes(query) ||
        page.slug.toLowerCase().includes(query)
    );
  }, [flatPages, searchQuery]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chargement des pages...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Pages ({pages.length})</CardTitle>
        </div>
        <Input
          placeholder="Rechercher une page..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mt-2"
        />
      </CardHeader>
      <CardContent className="max-h-96 overflow-y-auto">
        {filteredPages.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Aucune page trouvee
          </p>
        ) : (
          <div className="space-y-1">
            {filteredPages.map((page) => (
              <div
                key={page.id}
                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                  selectedPageId === page.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent'
                }`}
                style={{ paddingLeft: `${page.level * 16 + 8}px` }}
                onClick={() => onSelectPage?.(page)}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {page.level > 0 && (
                    <span className="text-muted-foreground">└</span>
                  )}
                  <span className="truncate">{page.title || '(Sans titre)'}</span>
                </div>
                <div className="flex items-center gap-2">
                  {page.status !== 'publish' && (
                    <Badge variant="outline" className="text-xs">
                      {page.status}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    /{page.slug}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
