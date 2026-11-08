import { describe, expect, it } from "vitest";
import { parseTrackerLink, parseTrackerPath, trackerPath } from "@/src/lib/tracker-route";

describe("tracker route round trips", () => {
  it.each(["recent", "demos/leaks", "100%", "phase?1", "phase#1", "art.json"])(
    "round-trips tab %s as one path segment",
    (tabSlug) => expect(parseTrackerPath(trackerPath("AC/DC", tabSlug))).toEqual({ trackerParam: "AC/DC", tabSlug })
  );
  it.each(["/sh/", "/sh/id/tab/extra", "/sh/id//tab", "/other/id"])("rejects unsupported path %s", (path) => {
    expect(parseTrackerPath(path)).toBeNull();
  });
  it.each(["/sh/id/%FF", "/sh/%"])("rejects malformed encoding in %s", (path) => {
    expect(() => parseTrackerPath(path)).toThrow(URIError);
  });
  it("parses published and local share links without losing their tab/query", () => {
    expect(parseTrackerLink("https://artistgrid.cx/sh/frankocean/demos%2Fleaks/?track=abc")).toEqual({
      trackerParam: "frankocean",
      tabSlug: "demos/leaks",
      href: "/sh/frankocean/demos%2Fleaks/?track=abc",
    });
    expect(parseTrackerLink("http://localhost:8788/view?id=franktracker.net", "http://localhost:8788")).toEqual({
      trackerParam: "franktracker.net",
      tabSlug: "",
      href: "/view?id=franktracker.net",
    });
    expect(parseTrackerLink("https://yetracker.net/")).toBeNull();
    expect(() => parseTrackerLink("https://artistgrid.cx/donate")).toThrow("Invalid ArtistGrid tracker link");
  });
});
