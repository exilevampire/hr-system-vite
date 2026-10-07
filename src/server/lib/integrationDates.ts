const THAI_DATE = /^(\d{2})-(\d{2})-(\d{4})$/;

export function parseThaiDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = THAI_DATE.exec(value);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const buddhistYear = Number(match[3]);
  const year = buddhistYear - 543;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

export function bangkokDayStart(date: Date): Date {
  return new Date(date.getTime() - 7 * 60 * 60 * 1000);
}

export function bangkokDayAfter(date: Date): Date {
  return new Date(date.getTime() + 17 * 60 * 60 * 1000);
}
