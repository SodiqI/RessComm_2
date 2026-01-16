import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tileUrl = url.searchParams.get('url');

    if (!tileUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing tile URL parameter' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Validate the URL is a legitimate tile source
    const allowedDomains = [
      'tile.openstreetmap.org',
      'a.tile.openstreetmap.org',
      'b.tile.openstreetmap.org',
      'c.tile.openstreetmap.org',
      'cartodb-basemaps-a.global.ssl.fastly.net',
      'cartodb-basemaps-b.global.ssl.fastly.net',
      'cartodb-basemaps-c.global.ssl.fastly.net',
      'a.basemaps.cartocdn.com',
      'b.basemaps.cartocdn.com',
      'c.basemaps.cartocdn.com',
      'd.basemaps.cartocdn.com',
      'server.arcgisonline.com',
      'services.arcgisonline.com',
      'a.tile.opentopomap.org',
      'b.tile.opentopomap.org',
      'c.tile.opentopomap.org',
      'stamen-tiles.a.ssl.fastly.net',
      'tiles.stadiamaps.com',
      'mt0.google.com',
      'mt1.google.com',
      'mt2.google.com',
      'mt3.google.com',
    ];

    const tileUrlParsed = new URL(tileUrl);
    const isAllowed = allowedDomains.some(domain => 
      tileUrlParsed.hostname === domain || tileUrlParsed.hostname.endsWith('.' + domain)
    );

    if (!isAllowed) {
      return new Response(
        JSON.stringify({ error: 'Tile source not allowed', hostname: tileUrlParsed.hostname }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch the tile with appropriate headers
    const tileResponse = await fetch(tileUrl, {
      headers: {
        'User-Agent': 'LovablePDFExport/1.0',
        'Accept': 'image/png,image/jpeg,image/*',
        'Referer': 'https://lovable.dev',
      },
    });

    if (!tileResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch tile', status: tileResponse.status }),
        { 
          status: tileResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const contentType = tileResponse.headers.get('content-type') || 'image/png';
    const tileData = await tileResponse.arrayBuffer();

    return new Response(tileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });

  } catch (error: unknown) {
    console.error('Tile proxy error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
