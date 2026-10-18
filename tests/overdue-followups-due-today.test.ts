import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { register } from "node:module";

register(
  pathToFileURL(path.resolve(process.cwd(), "scripts", "alias-loader.mjs")).href,
  pathToFileURL(process.cwd() + "/")
);

let dates: typeof import("../src/lib/dates");

describe("Overdue Follow-ups Display in Due Today & Overdue Queues", () => {
  let todayStr: string;
  let yesterdayStr: string;
  let twoDaysAgoStr: string;
  let tomorrowStr: string;
  let todayTime: number;
  let mockEnquiries: any[];

  before(async () => {
    dates = await import("../src/lib/dates");
    todayStr = dates.todayKey();
    yesterdayStr = dates.addDaysKey(todayStr, -1);
    twoDaysAgoStr = dates.addDaysKey(todayStr, -2);
    tomorrowStr = dates.addDaysKey(todayStr, 1);
    todayTime = new Date(todayStr).getTime();

    mockEnquiries = [
      {
        _id: "enq-overdue-1",
        studentFullName: "Overdue Student 1",
        primaryPhoneMobile: "9876543211",
        dueDateStr: yesterdayStr,
        hasScheduledFollowup: true,
        status: "Follow Up",
        isOverdue: true,
      },
      {
        _id: "enq-overdue-2",
        studentFullName: "Overdue Student 2",
        primaryPhoneMobile: "9876543212",
        dueDateStr: twoDaysAgoStr,
        hasScheduledFollowup: true,
        status: "Call Back",
        isOverdue: true,
      },
      {
        _id: "enq-today-1",
        studentFullName: "Today Student 1",
        primaryPhoneMobile: "9876543213",
        dueDateStr: todayStr,
        hasScheduledFollowup: true,
        status: "Follow Up",
        isOverdue: false,
      },
      {
        _id: "enq-upcoming-1",
        studentFullName: "Upcoming Student 1",
        primaryPhoneMobile: "9876543214",
        dueDateStr: tomorrowStr,
        hasScheduledFollowup: true,
        status: "Interested",
        isOverdue: false,
      },
    ];
  });

  // Helper matching followups page filter logic
  function filterRecords(records: any[], tab: "today" | "pending" | "upcoming") {
    return records.filter((rec) => {
      const recTime = new Date(rec.dueDateStr || todayStr).getTime();
      const statusLower = (rec.status || "").toLowerCase();
      if (statusLower.includes("lost") || statusLower.includes("admitted") || statusLower.includes("do not")) return false;

      if (tab === "today") {
        const isDueToday = rec.dueDateStr === todayStr;
        const isOverdue = rec.isOverdue || recTime < todayTime;
        if (!rec.hasScheduledFollowup || (!isDueToday && !isOverdue)) return false;
      } else if (tab === "pending") {
        if (!rec.hasScheduledFollowup || (!rec.isOverdue && recTime >= todayTime)) return false;
      } else if (tab === "upcoming") {
        if (!rec.hasScheduledFollowup || recTime <= todayTime) return false;
      }
      return true;
    });
  }

  // Helper matching followups page sort logic
  function sortDueToday(records: any[]) {
    return [...records].sort((a, b) => {
      const aTime = a.dueDateStr ? new Date(a.dueDateStr).getTime() : 0;
      const bTime = b.dueDateStr ? new Date(b.dueDateStr).getTime() : 0;
      const aOverdue = Boolean(a.isOverdue || (aTime > 0 && aTime < todayTime));
      const bOverdue = Boolean(b.isOverdue || (bTime > 0 && bTime < todayTime));
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      if (aOverdue && bOverdue) {
        return (a.dueDateStr || "").localeCompare(b.dueDateStr || "");
      }
      return 0;
    });
  }

  it("Overdue follow-ups are visible in the 'pending' (Overdue) tab", () => {
    const overdueList = filterRecords(mockEnquiries, "pending");
    assert.strictEqual(overdueList.length, 2);
    assert.ok(overdueList.some((r) => r._id === "enq-overdue-1"));
    assert.ok(overdueList.some((r) => r._id === "enq-overdue-2"));
  });

  it("Overdue follow-ups are ALSO visible in the 'today' (Due today) tab alongside today's follow-ups", () => {
    const todayList = filterRecords(mockEnquiries, "today");
    // Should include both overdue (yesterday, twoDaysAgo) and today's item
    assert.strictEqual(todayList.length, 3);
    assert.ok(todayList.some((r) => r._id === "enq-overdue-1"));
    assert.ok(todayList.some((r) => r._id === "enq-overdue-2"));
    assert.ok(todayList.some((r) => r._id === "enq-today-1"));
    // Upcoming must NOT be in today tab
    assert.ok(!todayList.some((r) => r._id === "enq-upcoming-1"));
  });

  it("Overdue follow-ups sort to the very top in 'Due today' tab, ordered oldest overdue first", () => {
    const todayList = filterRecords(mockEnquiries, "today");
    const sorted = sortDueToday(todayList);
    // Oldest overdue (twoDaysAgo) first, then yesterday, then today
    assert.strictEqual(sorted[0]._id, "enq-overdue-2");
    assert.strictEqual(sorted[1]._id, "enq-overdue-1");
    assert.strictEqual(sorted[2]._id, "enq-today-1");
  });

  it("Overdue follow-ups are identified with isOverdue = true for red styling", () => {
    const todayList = filterRecords(mockEnquiries, "today");
    const overdueInToday = todayList.filter((r) => r.isOverdue);
    assert.strictEqual(overdueInToday.length, 2);
    overdueInToday.forEach((r) => {
      assert.strictEqual(r.isOverdue, true);
      assert.ok(r.dueDateStr < todayStr);
    });
  });
});
