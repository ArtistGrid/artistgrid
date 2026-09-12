import { test, expect } from "@playwright/test";
import { mockSite, dismissAnnouncement } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockSite(page);
  await dismissAnnouncement(page);
});

test("settings modal opens, switches tabs, and persists toggles", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  // Default tab (Lyrics) is active
  await expect(page.getByText("Synced Lyrics Only")).toBeVisible();

  // Toggle a switch and confirm it persists to localStorage
  const row = page.getByText("Synced Lyrics Only").locator("xpath=ancestor::div[contains(@class,'py-3')]");
  const sw = row.getByRole("switch");
  await expect(sw).not.toBeChecked();
  await sw.click();
  await expect(sw).toBeChecked();

  const stored = await page.evaluate(() => localStorage.getItem("artistgrid-settings:v1"));
  expect(stored).toContain("syncedOnly");
  expect(JSON.parse(stored!).lyrics.syncedOnly).toBe(true);

  // Tab navigation works
  await page.getByRole("tab", { name: "Behavior" }).click();
  await expect(page.getByText("Errors & Notifications")).toBeVisible();
  await page.getByRole("tab", { name: "Scrobbling" }).click();
  await expect(page.getByText("Last.fm Scrobbling")).toBeVisible();

  // Escape closes the modal
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeHidden();
});

test("settings switch reflects saved state on reopen", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  const row = page.getByText("Synced Lyrics Only").locator("xpath=ancestor::div[contains(@class,'py-3')]");
  await row.getByRole("switch").click();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Settings" }).click();
  const row2 = page.getByText("Synced Lyrics Only").locator("xpath=ancestor::div[contains(@class,'py-3')]");
  await expect(row2.getByRole("switch")).toBeChecked();
});
