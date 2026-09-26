export function localDayKey(now: Date, dayStartHour: number): string {
  const date = new Date(now.getTime());
  if (date.getHours() < dayStartHour) date.setDate(date.getDate() - 1);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, "0")))
    .join("-");
}
