import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithFallback, clearETags, computeETag } from "@/src/lib/api";

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
}

function notModified(etag: string): Response {
  return new Response(null, {
    status: 304,
    headers: { ETag: etag },
  });
}

describe("ETag support", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearETags();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("computeETag", () => {
    it("returns a quoted hex string", async () => {
      const etag = await computeETag('{"test":1}');
      expect(etag).toMatch(/^"[0-9a-f]{64}"$/);
    });

    it("produces consistent hashes for same input", async () => {
      const a = await computeETag('{"a":1}');
      const b = await computeETag('{"a":1}');
      expect(a).toBe(b);
    });

    it("produces different hashes for different input", async () => {
      const a = await computeETag('{"a":1}');
      const b = await computeETag('{"a":2}');
      expect(a).not.toBe(b);
    });
  });

  describe("fetchWithFallback", () => {
    it("fetches normally on first request", async () => {
      const data = { name: "Test" };
      fetchSpy.mockResolvedValueOnce(jsonResponse(data));

      const res = await fetchWithFallback("/sh/test/");
      const json = await res.json();

      expect(json).toEqual(data);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, opts] = fetchSpy.mock.calls[0];
      expect(opts?.headers?.["If-None-Match"]).toBeUndefined();
    });

    it("sends If-None-Match on second request to same endpoint", async () => {
      const data = { name: "Test" };
      fetchSpy.mockResolvedValueOnce(jsonResponse(data));
      await fetchWithFallback("/sh/test/");

      fetchSpy.mockResolvedValueOnce(notModified('"abc123"'));
      await fetchWithFallback("/sh/test/");

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      const [, opts] = fetchSpy.mock.calls[1];
      expect(opts?.headers?.["If-None-Match"]).toBeDefined();
      expect(typeof opts.headers["If-None-Match"]).toBe("string");
      expect(opts.headers["If-None-Match"]).toMatch(/^"[0-9a-f]+"/);
    });

    it("returns cached body on 304 response", async () => {
      const data = { name: "Test", eras: [] };
      fetchSpy.mockResolvedValueOnce(jsonResponse(data));
      const firstRes = await fetchWithFallback("/sh/test/");
      const firstJson = await firstRes.json();

      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 304 }));
      const secondRes = await fetchWithFallback("/sh/test/");
      const secondJson = await secondRes.json();

      expect(firstJson).toEqual(secondJson);
      expect(secondRes.status).toBe(200);
    });

    it("updates ETag when server returns new data after 304", async () => {
      const data1 = { name: "V1" };
      fetchSpy.mockResolvedValueOnce(jsonResponse(data1));
      await fetchWithFallback("/sh/test/");

      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 304 }));
      await fetchWithFallback("/sh/test/");

      const data2 = { name: "V2" };
      fetchSpy.mockResolvedValueOnce(jsonResponse(data2));
      const res = await fetchWithFallback("/sh/test/");
      const json = await res.json();

      expect(json).toEqual(data2);
    });

    it("does not send If-None-Match for different endpoints", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ a: 1 }));
      await fetchWithFallback("/sh/test/");

      fetchSpy.mockResolvedValueOnce(jsonResponse({ b: 2 }));
      await fetchWithFallback("/sh/other/");

      const [, opts] = fetchSpy.mock.calls[1];
      expect(opts?.headers?.["If-None-Match"]).toBeUndefined();
    });

    it("does not cache non-200 responses", async () => {
      fetchSpy.mockResolvedValueOnce(new Response("error", { status: 500 }));
      await fetchWithFallback("/sh/test/");

      fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true }));
      const res = await fetchWithFallback("/sh/test/");
      const json = await res.json();

      expect(json).toEqual({ ok: true });
      const [, opts] = fetchSpy.mock.calls[1];
      expect(opts?.headers?.["If-None-Match"]).toBeUndefined();
    });

    it("clearETags removes all stored ETags", async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ a: 1 }));
      await fetchWithFallback("/sh/test/");

      clearETags();

      fetchSpy.mockResolvedValueOnce(jsonResponse({ a: 1 }));
      await fetchWithFallback("/sh/test/");

      const [, opts] = fetchSpy.mock.calls[1];
      expect(opts?.headers?.["If-None-Match"]).toBeUndefined();
    });

    it("passes through caller options alongside If-None-Match", async () => {
      const controller = new AbortController();
      fetchSpy.mockResolvedValueOnce(jsonResponse({ a: 1 }));
      await fetchWithFallback("/sh/test/", { signal: controller.signal });

      fetchSpy.mockResolvedValueOnce(jsonResponse({ a: 1 }));
      await fetchWithFallback("/sh/test/", { signal: controller.signal });

      const [, opts] = fetchSpy.mock.calls[1];
      expect(opts?.signal).toBe(controller.signal);
      expect(opts?.headers?.["If-None-Match"]).toBeDefined();
    });

    it("handles concurrent requests to different endpoints", async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({ a: 1 }))
        .mockResolvedValueOnce(jsonResponse({ b: 2 }));

      const [r1, r2] = await Promise.all([
        fetchWithFallback("/sh/a/"),
        fetchWithFallback("/sh/b/"),
      ]);

      expect(await r1.json()).toEqual({ a: 1 });
      expect(await r2.json()).toEqual({ b: 2 });
    });

    it("sends If-None-Match with correct etag value from first response", async () => {
      const data = { name: "Test" };
      fetchSpy.mockResolvedValueOnce(jsonResponse(data));
      const firstRes = await fetchWithFallback("/sh/test/");
      const firstBody = await firstRes.text();
      const expectedETag = await computeETag(firstBody);

      fetchSpy.mockResolvedValueOnce(new Response(null, { status: 304 }));
      await fetchWithFallback("/sh/test/");

      const [, opts] = fetchSpy.mock.calls[1];
      expect(opts.headers["If-None-Match"]).toBe(expectedETag);
    });
  });
});
