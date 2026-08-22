import { describe, it, expect } from "vitest";
import { shouldDropError, hasExtensionFrame } from "@/src/lib/error-filters";

describe("error-filters", () => {
  it("drops extension request timeouts", () => {
    expect(shouldDropError("Request timeout appSettingsDistributor.getValue", "UnhandledRejection")).toBe(true);
    expect(shouldDropError("Request timeout availableLanguagesDistributor.getValue", "UnhandledRejection")).toBe(true);
    expect(shouldDropError("Request timeout lettersVoicesDistributor.getValue", "UnhandledRejection")).toBe(true);
    expect(shouldDropError("Request timeout getDictionariesByLanguageId", "UnhandledRejection")).toBe(true);
    expect(shouldDropError("Request timeout isPredictionAvailable", "UnhandledRejection")).toBe(true);
    expect(shouldDropError("Request timeout isDictateAvailable", "UnhandledRejection")).toBe(true);
    expect(shouldDropError("Request timeout isMathOcrAvailable", "UnhandledRejection")).toBe(true);
    expect(shouldDropError("Request timeout en_wordsDistributor.getValue", "UnhandledRejection")).toBe(true);
  });

  it("drops obfuscated extension errors", () => {
    expect(shouldDropError("_0x20ebc0 is not an Object. (evaluating '_0x172229 in _0x20ebc0')", "TypeError")).toBe(
      true
    );
  });

  it("drops InvalidStateError and video invalid state", () => {
    expect(shouldDropError("InvalidStateError: The object is in an invalid state.", "Error")).toBe(true);
    expect(shouldDropError("The object is in an invalid state", "Error")).toBe(true);
  });

  it("drops res.operation extension errors", () => {
    expect(shouldDropError("undefined is not an object (evaluating 'res.operation')", "TypeError")).toBe(true);
  });

  it("drops errors with webkit-masked-url stack frames", () => {
    const event = {
      exception: {
        values: [
          {
            type: "TypeError",
            value: "null is not an object (evaluating 'o.id')",
            stacktrace: {
              frames: [
                {
                  filename: "webkit-masked-url://hidden/",
                  function: "qi",
                },
              ],
            },
          },
        ],
      },
    };
    expect(hasExtensionFrame(event)).toBe(true);
  });

  it("drops errors with extension culprits", () => {
    expect(hasExtensionFrame({ culprit: "qi" })).toBe(true);
    expect(hasExtensionFrame({ culprit: "OImpt" })).toBe(true);
    expect(hasExtensionFrame({ culprit: "Pseuu" })).toBe(true);
    expect(hasExtensionFrame({ culprit: "lBwRB" })).toBe(true);
  });

  it("retains legitimate application errors", () => {
    expect(shouldDropError("Cannot read properties of undefined (reading 'split')", "TypeError")).toBe(false);
    expect(
      hasExtensionFrame({
        exception: {
          values: [
            { stacktrace: { frames: [{ filename: "https://artistgrid.cx/assets/index-abc.js", function: "render" }] } },
          ],
        },
      })
    ).toBe(false);
  });
});
