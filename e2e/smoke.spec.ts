import { test, expect } from "@playwright/test";
import { TRACKER_ID, mockSite, dismissAnnouncement } from "./helpers";

test.beforeEach(async ({ page }) => {
  await mockSite(page);
  await dismissAnnouncement(page);
});

test("home renders artists from CSV and filters by search", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Kanye West" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Drake" })).toBeVisible();
  await expect(page.getByText(/of 3 trackers/)).toBeVisible();

  const search = page.getByLabel("Search artists");
  await search.fill("drake");
  await expect(page.getByRole("heading", { name: "Drake" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kanye West" })).not.toBeVisible();
});

test("opening a tracker shows eras and tracks", async ({ page }) => {
  await page.goto(`/sh/${TRACKER_ID}`);
  const donda = page.getByText("Donda").first();
  await expect(donda).toBeVisible();
  await donda.click();

  await expect(page.getByText("Hurricane")).toBeVisible();
  await expect(page.getByText("Last updated")).toBeVisible();
});

test("tracks can be favourited and appear in the Favourites tab", async ({ page }) => {
  await page.goto(`/sh/${TRACKER_ID}`);
  await page.getByText("Donda").first().click();
  await expect(page.getByText("Hurricane")).toBeVisible();

  await page.getByLabel("Add to favourites").first().click();
  await expect(page.getByText("Added to favourites", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Favourites", exact: true }).click();
  await expect(page.getByText("Hurricane")).toBeVisible();
  await expect(page.getByText(/1 favourite/)).toBeVisible();
});

