import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://pixkisocoomogxvehxxc.supabase.co";

/**
 * Proxies a tile URL through Supabase edge function to avoid CORS issues
 */
export const getProxiedTileUrl = (originalUrl: string): string => {
  const encodedUrl = encodeURIComponent(originalUrl);
  return `${SUPABASE_URL}/functions/v1/tile-proxy?url=${encodedUrl}`;
};

/**
 * Fetches a tile through the proxy and returns it as a blob URL
 */
export const fetchProxiedTile = async (originalUrl: string): Promise<string | null> => {
  try {
    const proxyUrl = getProxiedTileUrl(originalUrl);
    
    const response = await fetch(proxyUrl, {
      headers: {
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch proxied tile: ${response.status}`);
      return null;
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error('Error fetching proxied tile:', error);
    return null;
  }
};

/**
 * Preloads tiles through proxy for PDF export
 */
export const preloadTilesForPdfExport = async (
  tileUrls: string[],
  onProgress?: (loaded: number, total: number) => void
): Promise<Map<string, string>> => {
  const tileMap = new Map<string, string>();
  let loaded = 0;
  const total = tileUrls.length;

  const fetchPromises = tileUrls.map(async (url) => {
    try {
      const blobUrl = await fetchProxiedTile(url);
      if (blobUrl) {
        tileMap.set(url, blobUrl);
      }
      loaded++;
      onProgress?.(loaded, total);
    } catch (error) {
      console.warn(`Failed to preload tile: ${url}`, error);
      loaded++;
      onProgress?.(loaded, total);
    }
  });

  await Promise.all(fetchPromises);
  return tileMap;
};

/**
 * Extracts tile URLs from visible Leaflet tile layers
 */
export const extractVisibleTileUrls = (mapContainer: HTMLElement): string[] => {
  const tileUrls: string[] = [];
  const tileImages = mapContainer.querySelectorAll('.leaflet-tile-pane img');
  
  tileImages.forEach((img) => {
    const src = (img as HTMLImageElement).src;
    if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
      tileUrls.push(src);
    }
  });

  return tileUrls;
};

/**
 * Replaces tile image sources with proxied blob URLs
 */
export const replaceTilesWithProxied = async (
  mapContainer: HTMLElement,
  onProgress?: (loaded: number, total: number) => void
): Promise<{ success: boolean; replaced: number; failed: number }> => {
  const tileImages = mapContainer.querySelectorAll('.leaflet-tile-pane img') as NodeListOf<HTMLImageElement>;
  const tileUrls = extractVisibleTileUrls(mapContainer);
  
  if (tileUrls.length === 0) {
    return { success: true, replaced: 0, failed: 0 };
  }

  const proxiedTiles = await preloadTilesForPdfExport(tileUrls, onProgress);
  
  let replaced = 0;
  let failed = 0;

  tileImages.forEach((img) => {
    const originalSrc = img.src;
    if (proxiedTiles.has(originalSrc)) {
      img.src = proxiedTiles.get(originalSrc)!;
      replaced++;
    } else if (!originalSrc.startsWith('data:') && !originalSrc.startsWith('blob:')) {
      failed++;
    }
  });

  return {
    success: failed === 0,
    replaced,
    failed,
  };
};

/**
 * Cleans up blob URLs after PDF export
 */
export const cleanupBlobUrls = (tileMap: Map<string, string>): void => {
  tileMap.forEach((blobUrl) => {
    URL.revokeObjectURL(blobUrl);
  });
};
