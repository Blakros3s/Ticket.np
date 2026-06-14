import NepaliDate from 'nepali-date-converter';

export const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
] as const;

export const AD_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export type CalendarSystem = 'ad' | 'bs';

export interface CalendarMonth {
  year: number;
  month: number;
  label: string;
}

export const getAdMonth = (date: Date = new Date()): CalendarMonth => ({
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  label: AD_MONTHS[date.getMonth()],
});

export const getBsMonth = (date: Date = new Date()): CalendarMonth => {
  const bs = new NepaliDate(date);
  const monthIndex = bs.getMonth();
  return {
    year: bs.getYear(),
    month: monthIndex + 1,
    label: BS_MONTHS[monthIndex],
  };
};

export const getBsDateLabel = (dateStr: string): string => {
  const bs = new NepaliDate(parseAdDate(dateStr));
  return `${bs.getDate()} ${BS_MONTHS[bs.getMonth()]}`;
};

const parseAdDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getBsDaysInMonth = (bsYear: number, bsMonth: number): number => {
  let day = 1;
  while (day < 32) {
    const current = new NepaliDate(bsYear, bsMonth - 1, day);
    try {
      const next = new NepaliDate(bsYear, bsMonth - 1, day + 1);
      if (next.getMonth() !== current.getMonth()) {
        return day;
      }
      day += 1;
    } catch {
      return day;
    }
  }
  return day;
};

export const shiftMonth = (
  current: CalendarMonth,
  system: CalendarSystem,
  delta: number
): CalendarMonth => {
  if (system === 'ad') {
    const date = new Date(current.year, current.month - 1 + delta, 1);
    return getAdMonth(date);
  }

  let year = current.year;
  let month = current.month + delta;
  while (month < 1) {
    month += 12;
    year -= 1;
  }
  while (month > 12) {
    month -= 12;
    year += 1;
  }
  return { year, month, label: BS_MONTHS[month - 1] };
};

export const getBsMonthAdRange = (bsYear: number, bsMonth: number): { start: string; end: string; daysInMonth: number } => {
  const daysInMonth = getBsDaysInMonth(bsYear, bsMonth);
  const startNd = new NepaliDate(bsYear, bsMonth - 1, 1);
  const endNd = new NepaliDate(bsYear, bsMonth - 1, daysInMonth);
  return {
    start: toLocalDateString(startNd.toJsDate()),
    end: toLocalDateString(endNd.toJsDate()),
    daysInMonth,
  };
};

export const getBsDayLabels = (bsYear: number, bsMonth: number): Array<{ bsDay: number; adDate: string }> => {
  const daysInMonth = getBsDaysInMonth(bsYear, bsMonth);
  const labels: Array<{ bsDay: number; adDate: string }> = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const nd = new NepaliDate(bsYear, bsMonth - 1, day);
    labels.push({ bsDay: day, adDate: toLocalDateString(nd.toJsDate()) });
  }
  return labels;
};

export const getAdMonthAdRange = (year: number, month: number): { start: string; end: string; daysInMonth: number } => {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: toLocalDateString(start),
    end: toLocalDateString(end),
    daysInMonth: end.getDate(),
  };
};

export const formatMonthTitle = (calendarMonth: CalendarMonth, system: CalendarSystem): string => {
  return `${calendarMonth.label} ${calendarMonth.year}`;
};
