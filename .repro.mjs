import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push("CONSOLE ERROR: " + m.text());
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("response", (r) => {
  if (r.status() >= 400) errors.push("HTTP " + r.status() + ": " + r.url());
});

try {
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle2", timeout: 25000 });
} catch (e) {
  errors.push("GOTO ERR: " + e.message);
}
await new Promise((r) => setTimeout(r, 1500));

const htmlProxyErr = errors.filter((e) => e.includes("html-proxy") || e.includes("No matching HTML"));
const cardEnterCount = await page.evaluate(
  () => document.querySelectorAll(".card-enter").length
);
const sampleCard = await page.evaluate(() => {
  const el = document.querySelector(".card-enter");
  if (!el) return null;
  return {
    cls: el.className,
    anim: getComputedStyle(el).animationName,
    delay: getComputedStyle(el).animationDelay,
  };
});

console.log("=== html-proxy errors ===", htmlProxyErr.length ? htmlProxyErr : "NONE");
console.log("=== other errors (excl. network aborts) ===",
  errors.filter((e) => !e.includes("ERR_ABORTED") && !e.includes("ERR_NAME_NOT_RESOLVED") && !e.includes("net::ERR")));
console.log("=== .card-enter count ===", cardEnterCount);
console.log("=== sample card ===", JSON.stringify(sampleCard));
await browser.close();
