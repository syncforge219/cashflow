import { computeBatchStatus, isBatchActiveOnDate, getLocalDateStr } from "../src/lib/batchHelper.js";

console.log("=== Testing Batch Lifecycle & Status Logic ===");

const refDate = new Date("2026-08-10"); // Reference "Today" = Aug 10, 2026

// Test 1: Batch with past start date and future end date -> "Active"
const batch1 = {
  batchName: "Primavera P6",
  startDate: "2026-07-27",
  endDate: "2026-08-20",
  days: ["Mon", "Wed", "Fri"],
  status: "Upcoming" // current status in DB
};
const status1 = computeBatchStatus(batch1.startDate, batch1.endDate, batch1.status, refDate);
console.log(`Test 1 (Active Date Range): Expected "Active", Got "${status1}" ->`, status1 === "Active" ? "PASS" : "FAIL");

// Test 2: Batch with past end date (crossed) -> "Completed"
const batch2 = {
  batchName: "Revit Finished",
  startDate: "2026-06-01",
  endDate: "2026-08-05",
  days: ["Mon", "Tue"],
  status: "Upcoming"
};
const status2 = computeBatchStatus(batch2.startDate, batch2.endDate, batch2.status, refDate);
console.log(`Test 2 (End Date Crossed): Expected "Completed", Got "${status2}" ->`, status2 === "Completed" ? "PASS" : "FAIL");

// Test 3: Batch with future start date -> "Upcoming"
const batch3 = {
  batchName: "Future 3ds Max",
  startDate: "2026-09-01",
  endDate: "2026-10-01",
  days: ["Mon", "Wed"],
  status: "Active"
};
const status3 = computeBatchStatus(batch3.startDate, batch3.endDate, batch3.status, refDate);
console.log(`Test 3 (Future Start Date): Expected "Upcoming", Got "${status3}" ->`, status3 === "Upcoming" ? "PASS" : "FAIL");

// Test 4: Batch with no end date and past start date -> "Active"
const batch4 = {
  batchName: "Ongoing AutoCAD",
  startDate: "2026-08-01",
  endDate: null,
  days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
  status: "Upcoming"
};
const status4 = computeBatchStatus(batch4.startDate, batch4.endDate, batch4.status, refDate);
console.log(`Test 4 (No End Date & Past Start Date): Expected "Active", Got "${status4}" ->`, status4 === "Active" ? "PASS" : "FAIL");

// Test 5: Cancelled batch remains Cancelled
const batch5 = {
  startDate: "2026-06-01",
  endDate: "2026-07-01",
  status: "Cancelled"
};
const status5 = computeBatchStatus(batch5.startDate, batch5.endDate, batch5.status, refDate);
console.log(`Test 5 (Explicitly Cancelled): Expected "Cancelled", Got "${status5}" ->`, status5 === "Cancelled" ? "PASS" : "FAIL");

console.log("\n=== Testing Faculty Calendar Date Visibility ===");

// Test 6: Calendar date within active range on matching day -> true
const activeOnAug10 = isBatchActiveOnDate(batch1, "2026-08-10", "Mon");
console.log(`Test 6 (Aug 10, Mon - Within Range): Expected true, Got ${activeOnAug10} ->`, activeOnAug10 === true ? "PASS" : "FAIL");

// Test 7: Calendar date within active range on non-matching day -> false
const activeOnAug09 = isBatchActiveOnDate(batch1, "2026-08-09", "Sun");
console.log(`Test 7 (Aug 9, Sun - Wrong Day): Expected false, Got ${activeOnAug09} ->`, activeOnAug09 === false ? "PASS" : "FAIL");

// Test 8: Calendar date AFTER batch end date (crossed) -> false
const activeOnAug24 = isBatchActiveOnDate(batch1, "2026-08-24", "Mon");
console.log(`Test 8 (Aug 24, Mon - After End Date Aug 20): Expected false, Got ${activeOnAug24} ->`, activeOnAug24 === false ? "PASS" : "FAIL");

// Test 9: Calendar date BEFORE batch start date -> false
const activeOnJul20 = isBatchActiveOnDate(batch1, "2026-07-20", "Mon");
console.log(`Test 9 (Jul 20, Mon - Before Start Date Jul 27): Expected false, Got ${activeOnJul20} ->`, activeOnJul20 === false ? "PASS" : "FAIL");

// Test 10: Batch with crossed end date (batch2 ends Aug 05) on Aug 10 -> false
const batch2OnAug10 = isBatchActiveOnDate(batch2, "2026-08-10", "Mon");
console.log(`Test 10 (Completed Batch on Aug 10): Expected false, Got ${batch2OnAug10} ->`, batch2OnAug10 === false ? "PASS" : "FAIL");
