/**
 * Optional real-browser/HTTP regression, against a NEW isolated fixture server only.
 * Setup: scripts/canteen-browser-fixture.ts; point dev server at its printed databaseUrl.
 * Install Playwright + @sparticuz/chromium under ~/.cache/okgs-browser (not app dependencies).
 * PHASE=print runs just print checks while iterating; a full run needs a fresh fixture.
 * All remote image requests are fulfilled with labeled local test graphics. No Cloudinary/email calls.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";

const fixture = JSON.parse(readFileSync(resolve(".screens/canteen-browser-fixture.json"), "utf8"));
const baseURL = process.env.BASE_URL || "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost", "0.0.0.0"].includes(new URL(baseURL).hostname), "This mutating test may ONLY target a local isolated server");
assert.ok(fixture.databaseUrl.startsWith(`file:${resolve(".screens")}/canteen-`));
const require = createRequire(import.meta.url);
const tools = createRequire(join(process.env.BROWSER_TOOLS_DIR || join(homedir(), ".cache", "okgs-browser"), "package.json"));
const packageValue = tools("@sparticuz/chromium");
const binary = packageValue.default || packageValue;
const moduleDir = dirname(tools.resolve("@sparticuz/chromium"));
// This minimal Linux sandbox lacks NSS/NSPR; extract the libs already bundled in the npm package.
const libs = await tools(join(moduleDir, "lambdafs.js")).inflate(join(moduleDir, "..", "bin", "al2023.tar.br"));
process.env.LD_LIBRARY_PATH = join(libs, "lib") + (process.env.LD_LIBRARY_PATH ? `:${process.env.LD_LIBRARY_PATH}` : "");
const browser = await tools("playwright").chromium.launch({ executablePath: await binary.executablePath(), args: binary.args.filter((arg) => arg !== "--disable-web-security"), headless: true });
const artifacts = join(fixture.directory, "browser");
mkdirSync(artifacts, { recursive: true });
const errors = [];
const png = require("pngjs").PNG;
const jsQR = require("jsqr");
const student = fixture.students;
const noPurchase = "Unauthorized: No Lunch Box Purchased.";
const alreadyClaimed = "Lunch Box Already Claimed Today.";
const message = (page) => page.locator("dialog[open] #scan-result-message");
const close = async (page) => { await page.getByRole("button", { name: "Next scan", exact: true }).click(); await page.locator("dialog[open]").waitFor({ state: "hidden" }); };
const assertNoOverflow = async (page) => {
  const bad = await page.evaluate(() => {
    const fields = Array.from(document.querySelectorAll(".ticket-fit-text")).filter((node) => node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1);
    const frames = Array.from(document.querySelectorAll(".ticket-frame")).filter((node) => node.scrollHeight > node.clientHeight + 1);
    return { fields: fields.slice(0, 5).map((node) => ({ text: node.textContent, font: getComputedStyle(node).fontSize, height: node.clientHeight, scroll: node.scrollHeight })), frames: frames.length };
  });
  assert.deepEqual(bad, { fields: [], frames: 0 }, "Full names/details, QR and footer must stay within every safe card");
};
const waitPrinted = async (page) => {
  await page.waitForFunction(() => window.__printCalls === 1 || Array.from(document.querySelectorAll(".print-ready-note")).some((node) => node.textContent && !node.textContent.startsWith("Preparing")), undefined, { timeout: 60_000 });
  const state = await page.evaluate(() => ({ calls: window.__printCalls, notices: Array.from(document.querySelectorAll(".print-ready-note")).map((node) => node.textContent),
    fields: Array.from(document.querySelectorAll(".ticket-fit-text")).filter((node) => node.scrollHeight > node.clientHeight + 1).slice(0, 6).map((node) => ({ text: node.textContent, font: getComputedStyle(node).fontSize, height: node.clientHeight, scroll: node.scrollHeight })),
    frames: Array.from(document.querySelectorAll(".ticket-frame")).filter((node) => node.scrollHeight > node.clientHeight + 1).length }));
  assert.equal(state.calls, 1, JSON.stringify(state));
};
const countPdfPages = (pdf) => (pdf.toString("latin1").match(/\/Type\s*\/Page\b/g) || []).length;
const assertPaperSize = (pdf, width, height) => {
  const boxes = [...pdf.toString("latin1").matchAll(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/g)];
  assert.ok(boxes.length);
  for (const box of boxes) assert.ok(Math.abs(Number(box[1]) * 25.4 / 72 - width) < .5 && Math.abs(Number(box[2]) * 25.4 / 72 - height) < .5, "PDF must use the actual requested paper size");
};
const waitFonts = async (page) => { await page.evaluate(() => document.fonts.ready); await page.waitForFunction(() => [...document.querySelectorAll(".ticket-sheet img")].every((img) => img.complete && img.naturalWidth)); };

try {
  const context = await browser.newContext({ baseURL, viewport: { width: 375, height: 812 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (new URL(request.url()).origin === new URL(baseURL).origin) return route.continue();
    if (request.resourceType() === "image") {
      const label = request.url().includes("father") ? "FATHER" : request.url().includes("mother") ? "MOTHER" : request.url().includes("student") ? "STUDENT" : "TEST IMAGE";
      return route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="427"><rect width="320" height="427" fill="#dae7ef"/><circle cx="160" cy="140" r="62" fill="#6f95a9"/><path d="M45 355 Q50 215 160 215 Q270 215 275 355" fill="#6f95a9"/><text x="160" y="402" text-anchor="middle" font-size="25" font-family="sans-serif" fill="#1e3b50">${label}</text></svg>` });
    }
    return route.abort();
  });
  const post = async (path, data, options = {}) => { const response = await context.request.post(path, { data, ...options }); return { status: response.status(), body: await response.json() }; };
  const login = await post("/api/portal/login", { identifier: fixture.staffLogin, password: fixture.password });
  assert.equal(login.status, 200); assert.equal(login.body.user.id, fixture.operatorId, "server MUST be using the isolated fixture DB");
  assert.equal((await post("/api/staff/fair-preference", { slug: fixture.fairSlug })).status, 200);
  const getLogs = async () => (await context.request.get(`/api/staff/lunch/logs?fair=${fixture.fairSlug}&today=1&limit=500`)).json();
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
  let posted = 0;
  page.on("request", (request) => { if (request.method() === "POST" && request.url().includes("/api/staff/lunch/scan")) posted++; });

  if (process.env.PHASE !== "print") {
    const anonymous = await tools("playwright").request.newContext({ baseURL });
    assert.equal((await anonymous.post("/api/staff/lunch/scan", { data: { code: student[0].code } })).status(), 401);
    assert.equal((await anonymous.get("/api/staff/lunch/logs")).status(), 401);
    await anonymous.dispose();
    const learner = await tools("playwright").request.newContext({ baseURL });
    assert.equal((await learner.post("/api/portal/login", { data: { identifier: fixture.studentLogin, password: fixture.password } })).status(), 200);
    assert.equal((await learner.post("/api/staff/lunch/scan", { data: { code: student[0].code } })).status(), 401);
    assert.equal((await learner.get("/api/staff/lunch/logs")).status(), 401);
    await learner.dispose();
    console.log("PASS HTTP staff-only lunch API and audit log");
    assert.equal((await getLogs()).summary.claimed, 0, "full regression requires a fresh fixture");
    await page.goto("/sf/canteen");
    await page.getByRole("heading", { name: "Canteen lunch boxes" }).waitFor();
    assert.equal(await page.locator('.sf-scan-mode-tabs a[aria-current="page"]').getAttribute("href"), "/sf/canteen");
    const manual = page.getByPlaceholder("Type a student ID or paste a ticket QR");
    await manual.fill(student[0].code);
    await page.getByRole("button", { name: "Check only", exact: true }).click();
    await page.waitForFunction(() => document.querySelector("dialog[open] .sf-result-title")?.textContent === "Lunch box authorized");
    assert.equal(await page.getByLabel("Verified name").inputValue(), "Verification Student 1");
    assert.equal(await page.getByLabel("Verified ID").inputValue(), student[0].code);
    assert.equal((await getLogs()).summary.claimed, 0, "check must not consume a lunch");
    await page.getByRole("button", { name: "Open full expanded view" }).click();
    await page.getByText("Holder ID", { exact: true }).waitFor();
    const box = await page.locator("dialog[open]").boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 376 && box.y + box.height <= 813, "phone popup must fit within the viewport");
    for (let i = 0; i < 10; i++) { await page.keyboard.press("Tab"); assert.ok(await page.evaluate(() => document.querySelector("dialog[open]").contains(document.activeElement)), "native modal must trap keyboard focus"); }
    await page.screenshot({ path: join(artifacts, "mobile-check-popup.png") });
    const beforeConfirm = posted;
    await page.locator("dialog[open] form").evaluate((form) => { form.requestSubmit(); form.requestSubmit(); });
    await message(page).filter({ hasText: "Lunch box claimed successfully." }).waitFor();
    assert.equal(posted, beforeConfirm + 1, "rapid double confirmation must send only one claim request");
    assert.equal((await getLogs()).summary.claimed, 1);
    await page.screenshot({ path: join(artifacts, "mobile-success-popup.png") });
    await close(page);
    await manual.fill(student[0].code); await page.getByRole("button", { name: "Claim lunch box", exact: true }).click();
    await message(page).filter({ hasText: alreadyClaimed }).waitFor(); assert.equal(await message(page).innerText(), alreadyClaimed);
    await close(page);
    for (const value of [student[501].code, fixture.tokens.noLunch]) {
      await manual.fill(value); await page.getByRole("button", { name: "Claim lunch box", exact: true }).click();
      await message(page).filter({ hasText: noPurchase }).waitFor(); assert.equal(await message(page).innerText(), noPurchase);
      if (value === fixture.tokens.noLunch) assert.equal(await page.getByLabel("Verified ID").inputValue(), fixture.entryGuestId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase());
      await page.screenshot({ path: join(artifacts, "mobile-denied-popup.png") }); await close(page);
    }
    console.log("PASS phone check/confirm, synchronous double-tap lock, full view, native focus trap and exact denial/duplicate messages");

    const spoof = await post("/api/staff/lunch/scan", { code: student[501].code, fair_slug: fixture.fairSlug, actor_id: "attacker", actor_name: "Attacker", claim_date: "2099-01-01", eligible: true, payment_status: "PAID" });
    assert.equal(spoof.body.message, noPurchase);
    const audit = await getLogs();
    const row = audit.logs.find((item) => item.subject_code === student[501].code);
    assert.equal(row.scanned_by, fixture.operatorId); assert.equal(row.scanned_by_name, "Verification Operator"); assert.equal(row.claim_date, audit.day);
    assert.equal((await post("/api/staff/lunch/scan", { code: student[0].code }, { headers: { "Sec-Fetch-Site": "cross-site" } })).status, 403);
    assert.equal((await post("/api/staff/lunch/scan", { token: "x".repeat(9000) })).status, 413);
    const races = await Promise.all(Array.from({ length: 16 }, () => post("/api/staff/lunch/scan", { code: student[100].code, fair_slug: fixture.fairSlug })));
    assert.equal(races.filter((reply) => reply.body.result === "success").length, 1);
    assert.equal(races.filter((reply) => reply.body.result === "duplicate").length, 15);
    console.log("PASS HTTP client-flag/date/actor spoofing, cross-site/byte limits and 16 concurrent claim requests");

    // A real decoded QR from a synthetic local MediaStream exercises the camera loop, not a mocked scanner response.
    await page.evaluate(async (qr) => {
      const canvas = document.createElement("canvas"); canvas.width = 720; canvas.height = 720;
      const image = new Image(); image.src = qr; await image.decode();
      const drawing = canvas.getContext("2d");
      const draw = () => { drawing.fillStyle = "white"; drawing.fillRect(0, 0, 720, 720); drawing.drawImage(image, 100, 100, 520, 520); }; draw();
      window.__cameraStarts = 0; window.__cameraStops = 0;
      navigator.mediaDevices.getUserMedia = async () => {
        window.__cameraStarts++;
        const stream = canvas.captureStream(10); const timer = setInterval(draw, 100);
        for (const track of stream.getTracks()) { const original = track.stop.bind(track); track.stop = () => { window.__cameraStops++; clearInterval(timer); original(); }; }
        return stream;
      };
    }, fixture.cameraQr);
    const beforeCamera = posted;
    await page.getByRole("button", { name: "Start camera", exact: true }).evaluate((button) => { button.click(); button.click(); });
    await message(page).filter({ hasText: "Lunch box claimed successfully." }).waitFor();
    assert.equal(await page.getByLabel("Verified ID").inputValue(), student[3].code);
    assert.equal(await page.evaluate(() => window.__cameraStarts), 1);
    await page.waitForTimeout(1200); assert.equal(posted, beforeCamera + 1, "camera must pause under the result popup");
    await close(page); await page.waitForTimeout(1200); assert.equal(posted, beforeCamera + 1, "stationary QRs must not auto-resubmit after closing");
    await page.getByRole("button", { name: "Stop camera", exact: true }).click();
    assert.equal(await page.evaluate(() => window.__cameraStops), 1);
    console.log("PASS real camera decoding, double-start protection, popup pause, stationary-QR suppression and track cleanup");
  }

  // A chosen subset including one unpaid row must never become the whole roster.
  const selected = [student[0], student[2], student[249], student[501]];
  const prepared = await post("/api/staff/students/bulk-print", { fair_slug: fixture.fairSlug, student_ids: selected.map((row) => row.id) });
  assert.equal(prepared.status, 200); assert.equal(prepared.body.paid, 3); assert.equal(prepared.body.unpaid, 1);
  assert.equal((await post("/api/staff/students/bulk-print", { fair_slug: fixture.fairSlug, student_ids: [] })).status, 422);
  assert.equal((await post("/api/staff/students/bulk-print", [])).status, 422);
  assert.equal((await post("/api/staff/students/bulk-print", Buffer.from("{broken"), { headers: { "Content-Type": "application/json" } })).status, 400);
  const originalJob = new URL(prepared.body.url, baseURL).searchParams.get("job");
  await page.goto(`${prepared.body.url}&auto=0`);
  await page.locator(".ticket-sheet").first().waitFor();
  const expected = selected.slice(0, 3).map((row) => row.code).sort();
  assert.deepEqual((await page.locator(".ticket-sheet").evaluateAll((nodes) => nodes.map((node) => node.dataset.ticketId))).sort(), expected);
  await page.getByRole("group", { name: "Ticket language" }).getByRole("button").nth(2).click();
  await page.waitForURL(/lang=both/);
  assert.equal(new URL(page.url()).searchParams.get("job"), originalJob);
  assert.deepEqual((await page.locator(".ticket-sheet").evaluateAll((nodes) => nodes.map((node) => node.dataset.ticketId))).sort(), expected);
  await waitFonts(page);
  await page.setViewportSize({ width: 1100, height: 1000 });
  await page.emulateMedia({ media: "print" });
  await page.waitForFunction(() => !document.querySelector(".ticket-bulk-print")?.disabled);
  await page.locator(".ticket-bulk-print").evaluate((button) => button.click());
  await waitPrinted(page);
  await assertNoOverflow(page);
  const card = await page.locator(".ticket-sheet").first().boundingBox();
  const qr = await page.locator(".ticket-qr img").first().boundingBox();
  assert.ok(Math.abs(card.width * 25.4 / 96 - 95) < .2 && Math.abs(card.height * 25.4 / 96 - 137) < .2);
  assert.ok(Math.abs(qr.width * 25.4 / 96 - 26) < .2 && Math.abs(qr.height * 25.4 / 96 - 26) < .2);
  const qrRaster = await page.locator(".ticket-qr img").first().screenshot();
  writeFileSync(join(artifacts, "printed-qr.png"), qrRaster);
  const raster = png.sync.read(qrRaster);
  console.log("QR raster pixels / CSS size:", raster.width, raster.height, qr.width, qr.height);
  const decoded = jsQR(new Uint8ClampedArray(raster.data), raster.width, raster.height);
  assert.ok(decoded, "the 26mm printed QR must remain decodable at ~300 DPI");
  assert.equal(JSON.parse(Buffer.from(decoded.data.split(".")[0], "base64url")).i, student[0].id);
  const smallPdf = await page.pdf({ path: join(artifacts, "selected-three-a4.pdf"), printBackground: true, preferCSSPageSize: true });
  assertPaperSize(smallPdf, 210, 297);
  assert.equal(countPdfPages(smallPdf), 1, "three selected cards must occupy one A4 sheet, not extra A6/blank pages");
  await page.screenshot({ path: join(artifacts, "a4-safe-print-layout.png") });
  console.log("PASS exact subset-only printing, unpaid/empty exclusion, selection-preserving language toggle and decodable fixed-size QR");

  for (const lang of ["en", "bn", "both"]) {
    await page.goto(`/sf/print/ticket/${student[2].id}?fair=${fixture.fairSlug}&copies=3&lang=${lang}&auto=0`);
    await waitFonts(page);
    await page.waitForFunction(() => !document.querySelector(".ticket-print-now")?.disabled);
    await page.locator(".ticket-print-now").evaluate((button) => button.click());
    await waitPrinted(page);
    await assertNoOverflow(page);
    const pdf = await page.pdf({ path: join(artifacts, `a6-${lang}-three-copies.pdf`), printBackground: true, preferCSSPageSize: true });
    assertPaperSize(pdf, 105, 148);
    assert.equal(countPdfPages(pdf), 3, "each safely inset copy must occupy exactly one A6 sheet");
  }
  await page.goto(`/sf/print/guest/${fixture.paidGuestId}?fair=wrong-fair&lang=both&auto=0`);
  await waitFonts(page);
  assert.equal(await page.locator(".ticket-photo-frame").count(), 3);
  assert.ok((await page.locator(".ticket-photo-frame img").nth(0).getAttribute("src")).includes("father-1"));
  assert.ok((await page.locator(".ticket-photo-frame img").nth(1).getAttribute("src")).includes("guest.jpg"));
  assert.ok((await page.locator(".ticket-photo-frame img").nth(2).getAttribute("src")).includes("mother-1"));
  await page.waitForFunction(() => !document.querySelector(".ticket-print-now")?.disabled);
  await page.locator(".ticket-print-now").evaluate((button) => button.click());
  await waitPrinted(page);
  await assertNoOverflow(page);
  assert.equal(countPdfPages(await page.pdf({ path: join(artifacts, "guest-parents-a6.pdf"), printBackground: true, preferCSSPageSize: true })), 1);
  console.log("PASS real A6 PDF pagination in English/Bangla/bilingual, long names and guest's left/center/right portraits");

  const autoUrl = new URL(prepared.body.url, baseURL);
  autoUrl.searchParams.set("auto", "1");
  await page.goto(autoUrl.href);
  await waitPrinted(page);
  await assertNoOverflow(page);
  assert.deepEqual((await page.locator(".ticket-sheet").evaluateAll((nodes) => nodes.map((node) => node.dataset.ticketId))).sort(), expected);
  console.log("PASS automatic printing waits for fonts/photos and keeps the exact selected subset");

  const large = await post("/api/staff/students/bulk-print", { fair_slug: fixture.fairSlug, student_ids: student.map((row) => row.id) });
  assert.equal(large.body.paid, 501); assert.equal(large.body.sheets_total, 126);
  await page.goto(`${large.body.url}&auto=0`, { timeout: 120_000 });
  await page.locator(".ticket-sheet").nth(500).waitFor();
  assert.equal(await page.locator(".ticket-sheet").count(), 501);
  assert.equal(await page.locator(".ticket-bulk-page").count(), 126);
  await waitFonts(page);
  await page.waitForFunction(() => !document.querySelector(".ticket-bulk-print")?.disabled);
  await page.locator(".ticket-bulk-print").evaluate((button) => button.click());
  await waitPrinted(page);
  await assertNoOverflow(page);
  const allCodes = await page.locator(".ticket-sheet").evaluateAll((nodes) => nodes.map((node) => node.dataset.ticketId));
  assert.deepEqual(allCodes.sort(), student.slice(0, 501).map((row) => row.code).sort());
  const bigPdf = await page.pdf({ path: join(artifacts, "all-501-tickets-126-a4.pdf"), printBackground: true, preferCSSPageSize: true, timeout: 120_000 });
  assertPaperSize(bigPdf, 210, 297);
  assert.equal(countPdfPages(bigPdf), 126, "all 501 selected paid tickets must print continuously, with physical four-up page breaks only");
  console.log("PASS 501 selected paid tickets in one continuous view and exactly 126 physical A4 PDF sheets");
  assert.deepEqual(errors, [], "no client runtime/hydration errors");
  console.log(`All browser/HTTP checks passed. Local ignored artifacts: ${artifacts}`);
  // Close the browser once; the Lambda headless build uses a single renderer process.
} finally { await browser.close(); }
