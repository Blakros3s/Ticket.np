/** Format a Date as YYYY-MM-DD in local timezone (avoids UTC shift from toISOString). */
export const toLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Parse YYYY-MM-DD as local date (not UTC). */
export const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/** First day of current month as YYYY-MM-DD. */
export const getMonthStartDate = (date: Date = new Date()): string => {
  return toLocalDateString(new Date(date.getFullYear(), date.getMonth(), 1));
};

/** Last day of month for given year/month (1-indexed). */
export const getMonthEndDate = (year: number, month: number): string => {
  return toLocalDateString(new Date(year, month, 0));
};
