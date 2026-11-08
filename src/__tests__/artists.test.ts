import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findMatchingArtist, getDirectTrackerId, parseArtistsCsv, resolveArtistTracker } from "@/src/lib/artists";
import { ARTISTS_CSV, HOME_CACHE_EXPIRY, LOCAL_STORAGE_KEYS } from "@/src/lib/home-constants";
import { setCachedData } from "@/src/lib/cache";

const SHEET_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcdefghi";
const CSV = `name,url,credit,links_work,updated,best
Kanye West,yetracker.net,"A, B",1,1,true
Kanye West,${SHEET_ID},C,1,0,false
Playboi Carti,carti12345678901234567890123456789012345678901,C,1,1,false
Frank Ocean,franktracker.net,C,1,1,true
King Gizzard & the Lizard Wizard,kinggizzardtracker.net,C,1,1,false`;
const ARTISTS = parseArtistsCsv(CSV);

describe("artist directory matching", () => {
  it("preserves CSV flags and alternate trackers, including quoted multiline fields", () => {
    expect(ARTISTS[0]).toMatchObject({ name: "Kanye West", url: "yetracker.net", isStarred: true, isUpdated: true });
    expect(ARTISTS[1]).toMatchObject({ name: "Kanye West [Alt]", url: SHEET_ID, isStarred: false, isUpdated: false });
    const quoted = parseArtistsCsv('name,url,credit\r\n"Tyler, The Creator",tylertracker.net,"a\r\nb"\r\n');
    expect(quoted[0]).toMatchObject({ name: "Tyler, The Creator", url: "tylertracker.net" });
    expect(() => parseArtistsCsv('name,url\n"unfinished,url')).toThrow("unterminated quoted field");
    expect(() => parseArtistsCsv("bad,columns\na,b")).toThrow("missing columns");
  });

  it.each(["kanyewest", "Kanye-West", "kanyewesttracker", "ye", "ye-tracker", "kanye", "kanyewset"])(
    "resolves %s to the primary tracker",
    (query) => expect(findMatchingArtist(query, ARTISTS)?.url).toBe("yetracker.net")
  );

  it("ranks the nearest name and keeps the primary tracker ahead of alternates on ties", () => {
    const reversed = [ARTISTS[1], ARTISTS[0], ...ARTISTS.slice(2)];
    expect(findMatchingArtist("kanyewset", reversed)?.url).toBe("yetracker.net");
    expect(findMatchingArtist("kinggizzardandthelizardwzard", ARTISTS)?.url).toBe("kinggizzardtracker.net");
    expect(findMatchingArtist("carti", ARTISTS)?.name).toBe("Playboi Carti");
  });

  it("matches exact IDs before names and never fuzzy-matches a domain or Sheet ID", () => {
    expect(findMatchingArtist(SHEET_ID, ARTISTS)?.url).toBe(SHEET_ID);
    expect(findMatchingArtist("https://franktracker.net/", ARTISTS)?.url).toBe("franktracker.net");
    expect(findMatchingArtist("frankocean.net", ARTISTS)).toBeNull();
    expect(findMatchingArtist("kanyewest1234567890123456789", ARTISTS)).toBeNull();
    expect(getDirectTrackerId("https://yetracker.net/")).toBe("yetracker.net");
    expect(getDirectTrackerId(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`)).toBe(SHEET_ID);
    expect(getDirectTrackerId("https://docs.google.com/spreadsheets/d/e/2PACX-xyz123/pubhtml")).toBe("2PACX-xyz123");
  });

  it.each(["zzzzzzzz", "zzzzzzzzzzzzzzzzzzzzzzzz", "__proto__", "", "a"])(
    "does not guess a tracker for %s",
    (query) => {
      expect(findMatchingArtist(query, ARTISTS)).toBeNull();
    }
  );
});

describe("browser tracker resolution", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses the shared home-page cache without another request", async () => {
    setCachedData(LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL, ARTISTS);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const resolved = await resolveArtistTracker("kanyewest", new AbortController().signal);
    expect(resolved).toEqual({ trackerId: "yetracker.net", artistName: "Kanye West" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes expired artist data and saves the new identifier", async () => {
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL,
      JSON.stringify({ data: ARTISTS, timestamp: Date.now() - HOME_CACHE_EXPIRY - 1 })
    );
    const fetch = vi.fn().mockResolvedValue(new Response(`name,url\nKanye West,${SHEET_ID}`));
    vi.stubGlobal("fetch", fetch);
    expect(await resolveArtistTracker("kanyewest", new AbortController().signal)).toMatchObject({
      trackerId: SHEET_ID,
    });
    expect(fetch).toHaveBeenCalledWith(ARTISTS_CSV, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL)!).data[0].url).toBe(SHEET_ID);
  });

  it.each(["yetracker.net", "https://yetracker.net/", SHEET_ID])(
    "allows direct identifier %s when the directory is unavailable",
    async (query) => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
      expect(await resolveArtistTracker(query, new AbortController().signal)).toEqual({
        trackerId: query === SHEET_ID ? SHEET_ID : "yetracker.net",
        artistName: null,
      });
    }
  );

  it.each(["zzzzzzzz", "zzzzzzzzzzzzzzzzzzzzzzzz"])(
    "reports unknown name %s instead of requesting it as an ID",
    async (query) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(CSV)));
      await expect(resolveArtistTracker(query, new AbortController().signal)).rejects.toThrow("No matching artist");
    }
  );

  it("does not publish or cache a directory response after cancellation", async () => {
    let finish!: (value: string) => void;
    const text = new Promise<string>((resolve) => (finish = resolve));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: () => text }));
    const controller = new AbortController();
    const pending = resolveArtistTracker("kanyewest", controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    finish(CSV);
    await rejected;
    expect(localStorage.getItem(LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL)).toBeNull();
  });

  it.each([undefined, "invalid"])("refreshes a cache with timestamp %s", async (timestamp) => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL, JSON.stringify({ data: ARTISTS, timestamp }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`name,url\nKanye West,${SHEET_ID}`)));
    const resolved = await resolveArtistTracker("kanyewest", new AbortController().signal);
    expect(resolved.trackerId).toBe(SHEET_ID);
    expect(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL)!).timestamp).toEqual(expect.any(Number));
  });

  it("retains cached mappings when a refresh returns an empty directory", async () => {
    localStorage.setItem(LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL, JSON.stringify({ data: ARTISTS, timestamp: 0 }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("name,url\n")));
    const resolved = await resolveArtistTracker("kanyewest", new AbortController().signal);
    expect(resolved.trackerId).toBe("yetracker.net");
    expect(JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEYS.CSV_CACHE_LOCAL)!).timestamp).toBe(0);
  });

  it("bounds a stalled directory while retaining a usable domain identifier", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    const pending = resolveArtistTracker("yetracker.net", new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1500);
    expect(await pending).toEqual({ trackerId: "yetracker.net", artistName: null });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("looks up the CSV name for an explicit tracker URL on a cold visit", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(CSV));
    vi.stubGlobal("fetch", fetch);
    expect(await resolveArtistTracker("https://yetracker.net/", new AbortController().signal)).toEqual({
      trackerId: "yetracker.net",
      artistName: "Kanye West",
    });
    expect(fetch).toHaveBeenCalledWith(ARTISTS_CSV, expect.any(Object));
  });

  it("fetches the CSV name for a bare canonical Sheet ID on a cold visit", async () => {
    const id = "1zqqdIds1iwnx4lh29iF1IlraeuqfGhxH9qLNlWOnryo";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`name,url\nLil Uzi Vert,${id}`)));
    expect(await resolveArtistTracker(id, new AbortController().signal)).toEqual({
      trackerId: id,
      artistName: "Lil Uzi Vert",
    });
  });
});

describe("exact catalogue identities", () => {
  const directory = parseArtistsCsv(
    `name,url\nmk.gee,mkgeetracker.net\nAC/DC,acdctracker.net\nKanye West,yetracker.net\nKanye West,${SHEET_ID}\nKing Gizzard & the Lizard Wizard,kinggizzardtracker.net`
  );
  it.each(["mk.gee", "MK.GEE"])("keeps displayed artist %s ahead of domain inference", (name) => {
    expect(findMatchingArtist(name, directory)?.url).toBe("mkgeetracker.net");
  });
  it.each(["Kanye West [Alt]", "kanye-west-alt"])("preserves an explicit alternate query %s", (name) => {
    expect(findMatchingArtist(name, directory)?.url).toBe(SHEET_ID);
  });
  it("fuzzy-matches a long mixed-case artist query", () => {
    expect(findMatchingArtist("KingGizzardandtheLizardWzard", directory)?.url).toBe("kinggizzardtracker.net");
  });
  it("resolves names in published ArtistGrid links instead of using its hostname", () => {
    expect(findMatchingArtist("https://artistgrid.cx/sh/mkgee/recent/", directory)?.url).toBe("mkgeetracker.net");
    expect(getDirectTrackerId("https://artistgrid.cx/sh/mkgee/recent/")).toBeNull();
  });
});
