import { test, expect } from "@playwright/test";
import { TRACKER_ID, mockSite, dismissAnnouncement } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockSite(page);
  await dismissAnnouncement(page);
});

test("switching view tabs shows the right empty states", async ({ page }) => {
  await page.goto(`/sh/${TRACKER_ID}`);
  await page.getByText("Donda").first().click();
  await expect(page.getByText("Hurricane")).toBeVisible();

  // Main tab shows eras/tracks
  await expect(page.getByRole("button", { name: "Main", exact: true })).toBeVisible();

  // Favourites tab empty state
  await page.getByRole("button", { name: "Favourites", exact: true }).click();
  await expect(page.getByText("No Favourites Yet")).toBeVisible();

  // Custom tab empty state
  await page.getByRole("button", { name: "Custom", exact: true }).click();
  await expect(page.getByText("No Custom Views")).toBeVisible();
});

test("favouriting a track then opening Favourites shows it", async ({ page }) => {
  await page.goto(`/sh/${TRACKER_ID}`);
  await page.getByText("Donda").first().click();
  await expect(page.getByText("Hurricane")).toBeVisible();

  await page.getByLabel("Add to favourites").first().click();
  await expect(page.getByText("Added to favourites", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Favourites", exact: true }).click();
  await expect(page.getByText("Hurricane")).toBeVisible();
  await expect(page.getByText("No Favourites Yet")).toBeHidden();
});
