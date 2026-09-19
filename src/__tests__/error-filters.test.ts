import { describe, it, expect } from "vitest";
import { shouldDropError, hasExtensionFrame } from "@/src/lib/error-filters";
describe("error-filters", () => {
  describe("shouldDropError", () => {
    it("drops React ErrorBoundary errors", () => {
      expect(shouldDropError("something", "React ErrorBoundary (in Component)")).toBe(true);
    });
    it("drops CompileError by type", () => {
      expect(shouldDropError("something", "CompileError")).toBe(true);
    });
    it("drops short obfuscated minified error strings", () => {
      expect(shouldDropError("Aa", "Error")).toBe(true);
      expect(shouldDropError("fa", "Error")).toBe(true);
      expect(shouldDropError("Ba", "Error")).toBe(true);
    });
    it("drops obfuscated extension errors matching regex", () => {
      expect(shouldDropError("_0x20ebc0 is not an Object. (evaluating '_0x172229 in _0x20ebc0')", "TypeError")).toBe(
        true
      );
    });
    it("drops substring-matched errors", () => {
      expect(shouldDropError("Request timeout appSettingsDistributor.getValue", "UnhandledRejection")).toBe(true);
      expect(shouldDropError("InvalidStateError: The object is in an invalid state.", "Error")).toBe(true);
      expect(shouldDropError("ResizeObserver loop limit exceeded", "Error")).toBe(true);
      expect(shouldDropError("ResizeObserver loop completed with undelivered notifications.", "Error")).toBe(true);
      expect(shouldDropError("undefined is not an object (evaluating 'A.xxh3String')", "TypeError")).toBe(true);
      expect(shouldDropError("Can't find variable: WebAssembly", "ReferenceError")).toBe(true);
      expect(shouldDropError("Can't find variable: pauseVideos", "ReferenceError")).toBe(true);
      expect(shouldDropError("The WKWebView was deallocated before the message was delivered", "Error")).toBe(true);
      expect(shouldDropError("undefined is not an object (evaluating 'res.operation')", "TypeError")).toBe(true);
    });
    it("retains legitimate application errors", () => {
      expect(shouldDropError("Cannot read properties of undefined (reading 'split')", "TypeError")).toBe(false);
      expect(shouldDropError("NetworkError when attempting to fetch resource", "TypeError")).toBe(false);
    });
  });
  describe("hasExtensionFrame", () => {
    it("drops errors with extension culprits", () => {
      expect(hasExtensionFrame({ culprit: "qi" })).toBe(true);
      expect(hasExtensionFrame({ culprit: "OImpt" })).toBe(true);
      expect(hasExtensionFrame({ culprit: "Pseuu" })).toBe(true);
      expect(hasExtensionFrame({ culprit: "lBwRB" })).toBe(true);
    });
    it("drops errors when transaction matches extension culprits", () => {
      expect(hasExtensionFrame({ transaction: "qi" })).toBe(true);
      expect(hasExtensionFrame({ transaction: "OImpt" })).toBe(true);
      expect(hasExtensionFrame({ transaction: "Pseuu" })).toBe(true);
      expect(hasExtensionFrame({ transaction: "lBwRB" })).toBe(true);
    });
    it("handles missing culprit, transaction, and exception gracefully", () => {
      expect(hasExtensionFrame({})).toBe(false);
      expect(hasExtensionFrame({ culprit: "normalFn" })).toBe(false);
      expect(hasExtensionFrame({ exception: {} })).toBe(false);
      expect(hasExtensionFrame({ exception: { values: [{}] } })).toBe(false);
      expect(hasExtensionFrame({ exception: { values: [{ stacktrace: {} }] } })).toBe(false);
      expect(hasExtensionFrame({ exception: { values: [{ stacktrace: { frames: [{}] } }] } })).toBe(false);
    });
    it("drops errors when stack frame function matches extension markers", () => {
      expect(
        hasExtensionFrame({
          exception: { values: [{ stacktrace: { frames: [{ function: "qi" }] } }] },
        })
      ).toBe(true);
      expect(
        hasExtensionFrame({
          exception: { values: [{ stacktrace: { frames: [{ function: "OImpt" }] } }] },
        })
      ).toBe(true);
      expect(
        hasExtensionFrame({
          exception: { values: [{ stacktrace: { frames: [{ function: "Pseuu" }] } }] },
        })
      ).toBe(true);
      expect(
        hasExtensionFrame({
          exception: { values: [{ stacktrace: { frames: [{ function: "lBwRB" }] } }] },
        })
      ).toBe(true);
    });
    it("drops errors when stack frame filename matches extension markers", () => {
      const markers = [
        "chrome-extension://",
        "moz-extension://",
        "safari-extension://",
        "safari-web-extension://",
        "edge-extension://",
        "webkit-masked-url",
        "__DLD__",
        "frontend.min.js",
      ];
      for (const marker of markers) {
        expect(
          hasExtensionFrame({
            exception: {
              values: [
                {
                  stacktrace: {
                    frames: [{ filename: `https://example.com/sub/${marker}/script.js` }],
                  },
                },
              ],
            },
          })
        ).toBe(true);
      }
    });
    it("retains legitimate application errors", () => {
      expect(
        hasExtensionFrame({
          exception: {
            values: [
              {
                stacktrace: {
                  frames: [{ filename: "https://artistgrid.cx/assets/index-abc.js", function: "render" }],
                },
              },
            ],
          },
        })
      ).toBe(false);
    });
  });
});
