import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { pathToFileURL } from "node:url";

// Register custom alias loader so TypeScript and relative imports resolve in Node native ESM
register(pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href, pathToFileURL(process.cwd() + "/"));

let generateOfficialReceiptHtml: any;
let htmlToPdfBuffer: any;
let inlineLocalImages: any;
let getBrowserExecutablePath: any;

before(async () => {
  const receiptHtmlMod = await import("../src/lib/receiptHtmlGenerator");
  generateOfficialReceiptHtml = receiptHtmlMod.generateOfficialReceiptHtml;

  const puppeteerMod = await import("../src/lib/puppeteerPdf");
  htmlToPdfBuffer = puppeteerMod.htmlToPdfBuffer;
  inlineLocalImages = puppeteerMod.inlineLocalImages;
  getBrowserExecutablePath = puppeteerMod.getBrowserExecutablePath;
});

test("Puppeteer executable path discovery", () => {
  const execPath = getBrowserExecutablePath();
  assert.ok(execPath, "Should find a valid Chrome or Edge executable");
  assert.ok(fs.existsSync(execPath), "Discovered browser executable must exist on disk");
});

test("inlineLocalImages inlines public images as base64 data URIs", () => {
  const html = '<p>Test</p><img src="/sicces-logo.png" alt="logo" />';
  const inlined = inlineLocalImages(html);
  assert.ok(inlined.includes("data:image/png;base64,"), "Should convert /sicces-logo.png to base64 data URI");
});

test("generateOfficialReceiptHtml outputs correct modal-matching details", () => {
  const sample = {
    receiptNo: "REC-2026-00222",
    studentName: "Snigdha Dubey",
    admissionId: "ADM000166",
    courseName: "Certificate in Dress Making",
    amountPaid: 5000,
    paymentDate: "30 Sept 2026, 11:03 am",
    paymentMode: "UPI",
    referenceNo: "N/A",
    particulars: "Course Fee / Registration Payment Received",
    brandName: "BRAND B",
    brandAddress: "Shagun Palace , Lucknow",
    companyName: "DESIGNERS CHOICE",
    companyAddress: "G-15 ,Murli Bhawan 10-A Ashok Marg Lucknow -226001",
    batch: "General Batch",
    city: "N/A",
    finalFee: 35000,
    totalPaidToDate: 5000,
    remainingBalance: 30000,
  };

  const html = generateOfficialReceiptHtml(sample);
  assert.ok(html.includes("REC-2026-00222"), "Must contain exact receipt number");
  assert.ok(html.includes("Snigdha Dubey"), "Must contain student name");
  assert.ok(html.includes("ADM000166"), "Must contain ADM000166 (not 566)");
  assert.ok(html.includes("Certificate in Dress Making"), "Must contain full course name without truncation");
  assert.ok(html.includes("35,000"), "Must contain agreed fee ₹35,000");
  assert.ok(html.includes("5,000.00"), "Must contain formatted amount 5,000.00");
  assert.ok(html.includes("General Batch"), "Must contain General Batch");
  assert.ok(html.includes("BRAND B"), "Must contain brand name BRAND B");
  assert.ok(html.includes("DESIGNERS CHOICE"), "Must contain company name DESIGNERS CHOICE");
  assert.ok(html.includes("11. Course Modification Policy"), "Must contain full 11 terms");
});

test("htmlToPdfBuffer generates valid A4 PDF buffer", async () => {
  const sample = {
    receiptNo: "REC-2026-00222",
    studentName: "Snigdha Dubey",
    admissionId: "ADM000166",
    courseName: "Certificate in Dress Making",
    amountPaid: 5000,
    paymentDate: "30 Sept 2026, 11:03 am",
    paymentMode: "UPI",
    referenceNo: "N/A",
    particulars: "Course Fee / Registration Payment Received",
    brandName: "BRAND B",
    brandAddress: "Shagun Palace , Lucknow",
    companyName: "DESIGNERS CHOICE",
    companyAddress: "G-15 ,Murli Bhawan 10-A Ashok Marg Lucknow -226001",
    batch: "General Batch",
    city: "N/A",
    finalFee: 35000,
    totalPaidToDate: 5000,
    remainingBalance: 30000,
  };

  const html = generateOfficialReceiptHtml(sample);
  const pdfBuffer = await htmlToPdfBuffer(html);
  assert.ok(pdfBuffer.length > 5000, `PDF buffer length (${pdfBuffer.length}) must be substantial`);
  const header = pdfBuffer.slice(0, 5).toString("utf-8");
  assert.equal(header, "%PDF-", "Generated buffer must have valid PDF header %PDF-");
});
