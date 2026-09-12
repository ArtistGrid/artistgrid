import { test, expect } from "@playwright/test";
import { TRACKER_ID, mockSite, dismissAnnouncement, waitForImages } from "./helpers";

test.use({ viewport: { width: 1280, height: 900 } });

test.beforeEach(async ({ page }) => {
  await mockSite(page);
  await dismissAnnouncement(page);
});

test("home grid matches snapshot", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kanye West" })).toBeVisible();
  await waitForImages(page);
  await expect(page.locator("main")).toHaveScreenshot("home-grid.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
  });
});

test("expanded era card matches snapshot", async ({ page }) => {
  await page.goto(`/sh/${TRACKER_ID}`);
  const donda = page.getByText("Donda").first();
  await expect(donda).toBeVisible();
  await donda.click();
  await expect(page.getByText("Hurricane")).toBeVisible();

  const card = page.locator(".cv-auto").first();
  await waitForImages(page);
  await expect(card).toHaveScreenshot("era-card-expanded.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
  });
});
