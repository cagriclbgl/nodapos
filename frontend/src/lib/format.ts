const TRY_FORMATTER = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number): string => TRY_FORMATTER.format(value);

const DATE_FORMATTER = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "short",
  timeStyle: "short",
});

export const formatDateTime = (iso: string): string =>
  DATE_FORMATTER.format(new Date(iso));

export function startOfDayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function endOfDayIso(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

/** ISO timestamp `daysAgo` whole days before today's local 00:00. */
export function startOfDayDaysAgoIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

const SHORT_DAY = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "2-digit",
});

const SHORT_HOUR = new Intl.DateTimeFormat("tr-TR", {
  hour: "2-digit",
  minute: "2-digit",
});

export const formatShortDate = (iso: string): string =>
  SHORT_DAY.format(new Date(iso));

export const formatShortHour = (iso: string): string =>
  SHORT_HOUR.format(new Date(iso));
