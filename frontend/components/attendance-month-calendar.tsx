'use client';

import { useEffect, useMemo, useState } from 'react';
import { attendanceApi, AttendanceCalendarDay } from '@/lib/attendance';
import {
  CalendarMonth,
  CalendarSystem,
  formatMonthTitle,
  getAdMonth,
  getAdMonthAdRange,
  getBsDayLabels,
  getBsMonth,
  getBsMonthAdRange,
  shiftMonth,
} from '@/lib/nepali-date';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const statusStyles: Record<string, string> = {
  present: 'bg-green-500/20 border-green-500/50 text-green-300',
  absent: 'bg-red-500/20 border-red-500/50 text-red-300',
  leave: 'bg-purple-500/20 border-purple-500/50 text-purple-300',
  none: 'bg-slate-700/40 border-slate-600/40 text-slate-400',
  off: 'bg-slate-800/60 border-slate-700/40 text-slate-500',
};

interface CalendarCell {
  key: string;
  label: number;
  status: AttendanceCalendarDay['status'];
  isWorkingDay: boolean;
  subtitle?: string | null;
}

export function AttendanceMonthCalendar() {
  const [calendarSystem, setCalendarSystem] = useState<CalendarSystem>('ad');
  const [currentMonth, setCurrentMonth] = useState<CalendarMonth>(() => getAdMonth());
  const [days, setDays] = useState<AttendanceCalendarDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (calendarSystem === 'ad') {
      setCurrentMonth(getAdMonth());
    } else {
      setCurrentMonth(getBsMonth());
    }
  }, [calendarSystem]);

  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      try {
        const range = calendarSystem === 'ad'
          ? getAdMonthAdRange(currentMonth.year, currentMonth.month)
          : getBsMonthAdRange(currentMonth.year, currentMonth.month);

        const data = await attendanceApi.getAttendanceCalendar({
          start_date: range.start,
          end_date: range.end,
        });
        setDays(data.days);
      } catch (error) {
        console.error('Failed to load attendance calendar:', error);
        setDays([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendar();
  }, [calendarSystem, currentMonth]);

  const dayMap = useMemo(() => {
    return new Map(days.map((day) => [day.date, day]));
  }, [days]);

  const cells = useMemo((): CalendarCell[] => {
    if (calendarSystem === 'ad') {
      const range = getAdMonthAdRange(currentMonth.year, currentMonth.month);
      const firstWeekday = new Date(currentMonth.year, currentMonth.month - 1, 1).getDay();
      const grid: CalendarCell[] = [];

      for (let i = 0; i < firstWeekday; i += 1) {
        grid.push({ key: `pad-${i}`, label: 0, status: 'off', isWorkingDay: false });
      }

      for (let day = 1; day <= range.daysInMonth; day += 1) {
        const dateStr = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const record = dayMap.get(dateStr);
        grid.push({
          key: dateStr,
          label: day,
          status: record?.status ?? 'none',
          isWorkingDay: record?.is_working_day ?? true,
          subtitle: record?.first_available_time,
        });
      }

      return grid;
    }

    const bsDays = getBsDayLabels(currentMonth.year, currentMonth.month);
    const firstWeekday = new Date(bsDays[0].adDate).getDay();
    const grid: CalendarCell[] = [];

    for (let i = 0; i < firstWeekday; i += 1) {
      grid.push({ key: `pad-${i}`, label: 0, status: 'off', isWorkingDay: false });
    }

    bsDays.forEach(({ bsDay, adDate }) => {
      const record = dayMap.get(adDate);
      grid.push({
        key: adDate,
        label: bsDay,
        status: record?.status ?? 'none',
        isWorkingDay: record?.is_working_day ?? true,
        subtitle: record?.first_available_time,
      });
    });

    return grid;
  }, [calendarSystem, currentMonth, dayMap]);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-8">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Attendance History</h2>
          <p className="text-xs text-slate-500 mt-1">Monthly calendar view with present/absent status</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg overflow-hidden border border-slate-700">
            <button
              type="button"
              onClick={() => setCalendarSystem('ad')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${calendarSystem === 'ad' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
            >
              AD
            </button>
            <button
              type="button"
              onClick={() => setCalendarSystem('bs')}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${calendarSystem === 'bs' ? 'bg-sky-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
            >
              BS
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => shiftMonth(prev, calendarSystem, -1))}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="min-w-[160px] text-center text-white font-medium">
              {formatMonthTitle(currentMonth, calendarSystem)}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => shiftMonth(prev, calendarSystem, 1))}
              className="p-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs font-semibold text-slate-500 uppercase tracking-wider py-1">
            {day}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-400"></div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {cells.map((cell) => {
            if (cell.label === 0) {
              return <div key={cell.key} className="aspect-square" />;
            }

            return (
              <div
                key={cell.key}
                title={cell.status}
                className={`aspect-square rounded-lg border p-2 flex flex-col items-center justify-center ${statusStyles[cell.status]}`}
              >
                <span className="text-sm font-bold">{cell.label}</span>
                {cell.status === 'present' && cell.subtitle && (
                  <span className="text-[9px] mt-0.5 opacity-80">{cell.subtitle}</span>
                )}
                {cell.status === 'off' && (
                  <span className="text-[9px] mt-0.5 opacity-70">Off</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-4 mt-6 pt-4 border-t border-slate-700/50">
        {[
          { label: 'Present', className: 'bg-green-500' },
          { label: 'Absent', className: 'bg-red-500' },
          { label: 'Leave', className: 'bg-purple-500' },
          { label: 'Pending', className: 'bg-slate-500' },
          { label: 'Off Day', className: 'bg-slate-700' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-xs text-slate-400">
            <span className={`w-3 h-3 rounded-full ${item.className}`} />
            {item.label}
          </div>
        ))}
      </div>
    </div>
  );
}
