
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import csvText from './backup.csv';

export const runtime = 'edge';

interface Artist {
  name: string;
  url: string;
}

const getArtistSlug = (artistName: string): string => {
  return artistName.toLowerCase().replace(/[^a-z0-9]/g, "");
};

const normalizeUrl = (url: string): string => {
  const googleSheetId = url.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  return googleSheetId ? `https://trackerhub.cx/sh/${googleSheetId}` : url;
};

const buildArtistMap = (csv: string): Map<string, Artist> => {
  const artistMap = new Map<string, Artist>();
  const lines = csv.trim().split("\n").filter(line => line.trim() !== '');
  const nameCount: Record<string, number> = {};

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, "").trim()) || [];
    
    if (matches.length < 2) continue;

    const [name, url] = matches;

    if (name && url) {
      const count = nameCount[name] || 0;
      nameCount[name] = count + 1;
      
      const newName = count === 0 ? name : count === 1 ? `${name} [Alt]` : `${name} [Alt #${count}]`;
      const artist: Artist = { name: newName, url };
      const slug = getArtistSlug(artist.name);
      
      artistMap.set(slug, artist);
    }
  }
  return artistMap;
};

let artistMapCache: Map<string, Artist> | null = null;

const getArtistMap = (): Map<string, Artist> => {
  if (artistMapCache) {
    return artistMapCache;
  }
  
  const map = buildArtistMap(csvText);
  artistMapCache = map;
  return map;
};

export function GET(
  request: NextRequest,
  { params }: { params: { artistname: string } }
) {
  const { artistname } = params;

  if (!artistname) {
    return new NextResponse('Artist name is required', { status: 400 });
  }

  const artistMap = getArtistMap();
  const requestedArtistSlug = getArtistSlug(artistname);
  const artist = artistMap.get(requestedArtistSlug);

  if (artist) {
    const redirectUrl = normalizeUrl(artist.url);
    return NextResponse.redirect(new URL(redirectUrl));
  } else {
    return new NextResponse(`Artist not found: ${artistname}`, { status: 404 });
  }
}