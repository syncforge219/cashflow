/**
 * Faculty Availability & 1-Hour Slot Calculation Utilities (8:00 AM - 7:00 PM)
 */

export interface HourlySlot {
  id: string;
  label: string; // e.g. "08:00 AM - 09:00 AM"
  shortLabel: string; // e.g. "8 AM - 9 AM"
  timeHeader: string; // e.g. "8:00 AM"
  startHour: number; // 8
  endHour: number; // 9
  startMin: number; // 480 (minutes from midnight)
  endMin: number; // 540
  period: "morning" | "afternoon" | "evening";
}

export const HOURLY_SLOTS_8_TO_7: HourlySlot[] = [
  { id: "08-09", label: "08:00 AM - 09:00 AM", shortLabel: "8 AM - 9 AM", timeHeader: "08:00 AM", startHour: 8, endHour: 9, startMin: 480, endMin: 540, period: "morning" },
  { id: "09-10", label: "09:00 AM - 10:00 AM", shortLabel: "9 AM - 10 AM", timeHeader: "09:00 AM", startHour: 9, endHour: 10, startMin: 540, endMin: 600, period: "morning" },
  { id: "10-11", label: "10:00 AM - 11:00 AM", shortLabel: "10 AM - 11 AM", timeHeader: "10:00 AM", startHour: 10, endHour: 11, startMin: 600, endMin: 660, period: "morning" },
  { id: "11-12", label: "11:00 AM - 12:00 PM", shortLabel: "11 AM - 12 PM", timeHeader: "11:00 AM", startHour: 11, endHour: 12, startMin: 660, endMin: 720, period: "morning" },
  { id: "12-13", label: "12:00 PM - 01:00 PM", shortLabel: "12 PM - 1 PM", timeHeader: "12:00 PM", startHour: 12, endHour: 13, startMin: 720, endMin: 780, period: "afternoon" },
  { id: "13-14", label: "01:00 PM - 02:00 PM", shortLabel: "1 PM - 2 PM", timeHeader: "01:00 PM", startHour: 13, endHour: 14, startMin: 780, endMin: 840, period: "afternoon" },
  { id: "14-15", label: "02:00 PM - 03:00 PM", shortLabel: "2 PM - 3 PM", timeHeader: "02:00 PM", startHour: 14, endHour: 15, startMin: 840, endMin: 900, period: "afternoon" },
  { id: "15-16", label: "03:00 PM - 04:00 PM", shortLabel: "3 PM - 4 PM", timeHeader: "03:00 PM", startHour: 15, endHour: 16, startMin: 900, endMin: 960, period: "afternoon" },
  { id: "16-17", label: "04:00 PM - 05:00 PM", shortLabel: "4 PM - 5 PM", timeHeader: "04:00 PM", startHour: 16, endHour: 17, startMin: 960, endMin: 1020, period: "evening" },
  { id: "17-18", label: "05:00 PM - 06:00 PM", shortLabel: "5 PM - 6 PM", timeHeader: "05:00 PM", startHour: 17, endHour: 18, startMin: 1020, endMin: 1080, period: "evening" },
  { id: "18-19", label: "06:00 PM - 07:00 PM", shortLabel: "6 PM - 7 PM", timeHeader: "06:00 PM", startHour: 18, endHour: 19, startMin: 1080, endMin: 1140, period: "evening" },
];

/**
 * Parses any time string token into total minutes from midnight (0..1439)
 * e.g., "11:00 AM" -> 660, "2:30 PM" -> 870, "12:00 PM" -> 720, "14:00" -> 840
 */
export function parseTimeToMinutes(timeStr: string, isEnd = false): number | null {
  if (!timeStr) return null;
  const clean = timeStr.trim().toUpperCase();

  const match = clean.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/);
  if (!match) return null;

  let hour = parseInt(match[1], 10);
  const min = match[2] ? parseInt(match[2], 10) : 0;
  const meridiem = match[3];

  if (meridiem === "PM") {
    if (hour < 12) hour += 12;
  } else if (meridiem === "AM") {
    if (hour === 12) {
      // In everyday Indian coaching & class scheduling, "12:00 AM" is almost universally entered
      // when users mean 12:00 Noon (12 PM), since classes are never held at 12 midnight (00:00).
      hour = 12;
    }
  } else if (!meridiem) {
    // If no AM/PM provided: standard coaching center context assumption:
    // Hours 1..7 without meridiem are afternoon/evening (1 PM to 7 PM => 13 to 19)
    // Hours 8..11 are morning (8 AM to 11 AM)
    // 12 is 12 PM (Noon => 12)
    if (hour >= 1 && hour <= 7) {
      hour += 12;
    }
  }

  return hour * 60 + min;
}

/**
 * Parses batch timing range strings:
 * e.g., "11:00 AM - 12:00 PM", "12:00 AM - 1:00 PM", "2:00 PM - 3:00 PM", "10:00 AM to 1:00 PM"
 */
export function parseBatchTimingRange(timingStr: string): { startMin: number; endMin: number } | null {
  if (!timingStr) return null;

  // Split on "-", "to", "–", "—"
  const parts = timingStr.split(/[-–—]|(?:\s+to\s+)/i);
  if (parts.length < 2) return null;

  const startPart = parts[0].trim();
  const endPart = parts[1].trim();

  let startMin = parseTimeToMinutes(startPart, false);
  let endMin = parseTimeToMinutes(endPart, true);

  if (startMin === null || endMin === null) return null;

  // If start part didn't have AM/PM explicitly, but end has PM:
  const endHasPM = /PM/i.test(endPart);
  const startHasMeridiem = /AM|PM/i.test(startPart);

  if (!startHasMeridiem && endHasPM) {
    const rawStartHour = parseInt(startPart, 10);
    if (rawStartHour >= 1 && rawStartHour < 12) {
      const endHour24 = Math.floor(endMin / 60);
      if (rawStartHour < 8 || rawStartHour <= (endHour24 - 12)) {
        startMin = (rawStartHour + 12) * 60 + (startMin % 60);
      }
    }
  }

  // If start was calculated as 0 (midnight) but end is daytime:
  if (startMin === 0 && endMin > 0 && endMin <= 1200) {
    startMin = 720;
  }

  // Handle wrap-around or 12-hour span ambiguity
  if (endMin <= startMin) {
    if (endMin < 12 * 60) {
      endMin += 12 * 60;
    }
  }

  // Sanity check: If calculated duration is > 6 hours (unrealistic for a single coaching batch),
  // check if start was 12:00 (720 min)
  if (endMin - startMin > 360) {
    if (startMin < 480 && endMin >= 720) {
      startMin = 720;
    }
  }

  return { startMin, endMin };
}

/**
 * Checks if a batch runs on a specific day of week (e.g. "Mon", "Tue")
 */
export function isBatchScheduledOnDay(batch: any, targetDayOfWeek?: string): boolean {
  if (!targetDayOfWeek || targetDayOfWeek === "All" || targetDayOfWeek === "All Days") {
    return true;
  }

  if (!Array.isArray(batch.days) || batch.days.length === 0) {
    // If no specific days listed, batch is treated as running all standard days
    return true;
  }

  const targetClean = targetDayOfWeek.slice(0, 3).toLowerCase();
  return batch.days.some((d: string) => d.slice(0, 3).toLowerCase() === targetClean);
}

/**
 * Evaluates whether a 1-hour slot overlaps with any active batch
 */
export function doesBatchOverlapSlot(
  slot: HourlySlot,
  batch: any,
  dayFilter?: string
): boolean {
  if (!batch || batch.status === "Cancelled" || batch.status === "Completed") {
    return false;
  }

  // Day filter match
  if (!isBatchScheduledOnDay(batch, dayFilter)) {
    return false;
  }

  const parsed = parseBatchTimingRange(batch.timing);
  if (!parsed) return false;

  // Overlap condition: max(start1, start2) < min(end1, end2)
  return Math.max(slot.startMin, parsed.startMin) < Math.min(slot.endMin, parsed.endMin);
}

export interface FacultySlotStatus {
  slot: HourlySlot;
  isFree: boolean;
  occupyingBatches: any[];
}

export interface FacultyAvailabilityProfile {
  facultyId: string;
  facultyName: string;
  email?: string;
  phone?: string;
  photoUrl?: string;
  designation?: string;
  brandScope?: string;
  subject?: string;
  subjects?: string[];
  slots: FacultySlotStatus[];
  totalSlotsCount: number; // 11
  freeSlotsCount: number;
  busySlotsCount: number;
  utilizationPercentage: number;
  freePercentage: number;
  assignedBatches: any[];
}

/**
 * Computes the full 8:00 AM - 7:00 PM availability profile for a faculty member
 */
export function calculateFacultyAvailability(
  faculty: any,
  allBatches: any[],
  dayFilter: string = "Today"
): FacultyAvailabilityProfile {
  const fId = String(faculty._id || faculty.id || faculty.teacherId || "");
  const fName = String(faculty.name || faculty.teacherName || "").trim().toLowerCase();

  // Find all batches assigned to this faculty
  const facultyBatches = allBatches.filter((b) => {
    if (b.status === "Cancelled" || b.status === "Completed") return false;
    const bTeacherId = String(b.teacherId || "");
    const bTeacherName = String(b.teacherName || "").trim().toLowerCase();
    return (fId && bTeacherId === fId) || (fName && bTeacherName === fName);
  });

  const slots: FacultySlotStatus[] = HOURLY_SLOTS_8_TO_7.map((slot) => {
    const overlapping = facultyBatches.filter((b) => doesBatchOverlapSlot(slot, b, dayFilter));
    return {
      slot,
      isFree: overlapping.length === 0,
      occupyingBatches: overlapping,
    };
  });

  const freeCount = slots.filter((s) => s.isFree).length;
  const busyCount = slots.filter((s) => !s.isFree).length;
  const totalSlots = HOURLY_SLOTS_8_TO_7.length; // 11
  const utilization = Math.round((busyCount / totalSlots) * 100);
  const freePct = Math.round((freeCount / totalSlots) * 100);

  return {
    facultyId: fId,
    facultyName: faculty.name || faculty.teacherName || "Faculty Instructor",
    email: faculty.email,
    phone: faculty.phone,
    photoUrl: faculty.photoUrl,
    designation: faculty.designation || "Faculty",
    brandScope: faculty.brandScope || "CADD Mantra",
    subject: faculty.subject,
    subjects: faculty.subjects,
    slots,
    totalSlotsCount: totalSlots,
    freeSlotsCount: freeCount,
    busySlotsCount: busyCount,
    utilizationPercentage: utilization,
    freePercentage: freePct,
    assignedBatches: facultyBatches,
  };
}

export interface BatchSlotInfo {
  slotKey: "morning" | "afternoon" | "evening" | "flexible";
  label: string;
  timeRange: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  startMin: number;
}

/**
 * Computes the start minutes from midnight for any batch timing string.
 * Returns 9999 if timing is unparseable or absent, so flexible/unslotted batches sort to the bottom.
 */
export function getBatchStartMinutes(timing?: string): number {
  if (!timing || !timing.trim()) return 9999;
  const parsed = parseBatchTimingRange(timing);
  if (parsed) return parsed.startMin;

  const firstToken = timing.split(/[-–—]|(?:\s+to\s+)/i)[0]?.trim();
  const min = parseTimeToMinutes(firstToken, false);
  return min !== null ? min : 9999;
}

/**
 * Classifies a batch into a time slot: Morning (< 12:00 PM), Afternoon (12:00 PM - 4:00 PM), Evening (4:00 PM+), or Flexible.
 */
export function getBatchSlotInfo(timing?: string): BatchSlotInfo {
  const startMin = getBatchStartMinutes(timing);

  if (startMin === 9999) {
    return {
      slotKey: "flexible",
      label: "Flexible Slot",
      timeRange: "Flexible / Not Fixed",
      icon: "⏱️",
      badgeBg: "bg-slate-50",
      badgeText: "text-slate-700",
      badgeBorder: "border-slate-200",
      startMin: 9999,
    };
  }

  // Morning Slot: Before 12:00 PM (0..719 min)
  if (startMin < 720) {
    return {
      slotKey: "morning",
      label: "Morning Slot",
      timeRange: "08:00 AM - 12:00 PM",
      icon: "🌅",
      badgeBg: "bg-amber-50",
      badgeText: "text-amber-700",
      badgeBorder: "border-amber-200",
      startMin,
    };
  }

  // Afternoon Slot: 12:00 PM to 04:00 PM (720..959 min)
  if (startMin < 960) {
    return {
      slotKey: "afternoon",
      label: "Afternoon Slot",
      timeRange: "12:00 PM - 04:00 PM",
      icon: "☀️",
      badgeBg: "bg-sky-50",
      badgeText: "text-sky-700",
      badgeBorder: "border-sky-200",
      startMin,
    };
  }

  // Evening Slot: 04:00 PM to 08:00 PM+ (960..1439 min)
  return {
    slotKey: "evening",
    label: "Evening Slot",
    timeRange: "04:00 PM - 08:00 PM",
    icon: "🌆",
    badgeBg: "bg-indigo-50",
    badgeText: "text-indigo-700",
    badgeBorder: "border-indigo-200",
    startMin,
  };
}

/**
 * Sorts batches strictly in chronological order by their timing slot start minutes.
 * Batches starting earlier appear first (e.g., 8:00 AM -> 9:00 AM -> 10:00 AM -> 1:00 PM -> 5:00 PM).
 */
export function sortBatchesByTiming<T extends { timing?: string; batchName?: string; startDate?: any; [key: string]: any } = any>(
  batches: T[]
): T[] {
  return [...batches].sort((a, b) => {
    const minA = getBatchStartMinutes(a.timing);
    const minB = getBatchStartMinutes(b.timing);
    if (minA !== minB) return minA - minB;

    // Secondary sort: startDate ascending
    if (a.startDate && b.startDate) {
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
        return dateA - dateB;
      }
    }

    return (a.batchName || "").localeCompare(b.batchName || "");
  });
}

/**
 * Groups batches into morning, afternoon, evening, and flexible slot buckets.
 */
export function groupBatchesBySlot<T extends { timing?: string; batchName?: string; [key: string]: any } = any>(
  batches: T[]
): {
  morning: T[];
  afternoon: T[];
  evening: T[];
  flexible: T[];
} {
  const sorted = sortBatchesByTiming(batches);
  const groups: { morning: T[]; afternoon: T[]; evening: T[]; flexible: T[] } = {
    morning: [],
    afternoon: [],
    evening: [],
    flexible: [],
  };

  for (const b of sorted) {
    const slot = getBatchSlotInfo(b.timing);
    groups[slot.slotKey].push(b);
  }

  return groups;
}
