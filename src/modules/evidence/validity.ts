import type { AccessRule, Evidence, TimeWindow } from "@/contracts/types";

const ZONE = "Asia/Ho_Chi_Minh";

export function hoChiMinhMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return hour * 60 + minute;
}

export function parseClockMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Giờ không hợp lệ: ${value}`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error(`Giờ không hợp lệ: ${value}`);
  }
  return hour * 60 + minute;
}

/** [start, end) theo phút địa phương. */
export function windowContainsInstant(window: TimeWindow, at: Date): boolean {
  const minutes = hoChiMinhMinutes(at);
  const start = parseClockMinutes(window.start);
  const end = parseClockMinutes(window.end);
  if (start === end) return false;
  if (start < end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

/** [valid_from, valid_to). `valid_to` null nghĩa là chưa biết lúc kết thúc. */
export function isRuleActiveAt(rule: AccessRule, at: Date): boolean {
  const time = at.getTime();
  if (Number.isNaN(time)) return false;
  if (time < Date.parse(rule.valid_from)) return false;
  if (rule.valid_to !== null && time >= Date.parse(rule.valid_to)) return false;
  if (rule.time_windows.length === 0) return true;
  return rule.time_windows.some((window) => windowContainsInstant(window, at));
}

/** Đến hạn kiểm tra thì hết hạn. Lệnh cấm không dùng hàm này để tự mở lại. */
export function isEvidenceStale(evidence: Evidence, at: Date): boolean {
  if (evidence.review_status === "needs_review") return true;
  if (!evidence.review_due_at) return false;
  return at.getTime() >= Date.parse(evidence.review_due_at);
}
