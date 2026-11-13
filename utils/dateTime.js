// Shared date and time checks.
// A regex alone accepts impossible dates such as 2027-02-31, and new Date() silently
// rolls them over (Feb 31 becomes Mar 3), so the calendar is checked explicitly.

export function isRealDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function isValidTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// Throws a 400 error with a clear message when the date or time is not real.
export function assertRealDateTime(date, time) {
  if (!isRealDate(date)) {
    throw Object.assign(new Error("That date does not exist. Check the day and month."), { statusCode: 400 });
  }
  if (!isValidTime(time)) {
    throw Object.assign(new Error("That time is not valid. Use HH:mm (24-hour)."), { statusCode: 400 });
  }
}
