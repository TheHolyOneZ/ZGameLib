export function sqliteWeekKey(d: Date): string {
  const year = d.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const today = Date.UTC(year, d.getUTCMonth(), d.getUTCDate());
  const yday = Math.floor((today - start) / 86400000);
  const wdayMon = (d.getUTCDay() + 6) % 7;
  const week = Math.floor((yday + 7 - wdayMon) / 7);
  return `${year}-${String(week).padStart(2, "0")}`;
}
