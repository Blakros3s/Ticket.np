'use client';

import { useEffect, useState, useCallback } from 'react';
import { attendanceApi, Attendance, TeamAttendance, OfficeSettings, AttendanceLog, AttendanceStats } from '@/lib/attendance';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

export default function AttendancePage() {
  const { user, isLoading: authLoading } = useAuth();
  const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

  const [loading, setLoading] = useState(true);
  const [myAttendance, setMyAttendance] = useState<Attendance | null>(null);
  const [teamAttendance, setTeamAttendance] = useState<TeamAttendance[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<Attendance[]>([]);
  const [officeSettings, setOfficeSettings] = useState<OfficeSettings | null>(null);
  const [dailyLogs, setDailyLogs] = useState<{ summary: any; records: any[] } | null>(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [teamStats, setTeamStats] = useState<AttendanceStats | null>(null);

  // Date Range State (Default: Today)
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = {
        start_date: dateRange.start,
        end_date: dateRange.end
      };

      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      const historyStart = sevenDaysAgo.toISOString().split('T')[0];
      const historyEnd = today.toISOString().split('T')[0];

      const promises: Promise<any>[] = [
        attendanceApi.getMyAttendance(),
        attendanceApi.getTeamAttendance(),
        attendanceApi.getAttendanceHistory(historyStart, historyEnd),
        attendanceApi.getOfficeSettings(),
        attendanceApi.getAttendanceStats(params)
      ];

      if (isAdminOrManager) {
        promises.push(attendanceApi.getDailyAttendanceLogs());
        promises.push(attendanceApi.getAttendanceStats({ ...params, all_employees: true }));
      }

      const results = await Promise.all(promises);

      setMyAttendance(results[0]);
      setTeamAttendance(results[1]);
      setAttendanceHistory(results[2]);
      setOfficeSettings(results[3]);
      setAttendanceStats(results[4]);

      if (isAdminOrManager) {
        setDailyLogs(results[5]);
        setTeamStats(results[6]);
      }
    } catch (error) {
      console.error('Failed to load attendance data:', error);
      if (!silent) showToastMessage('Failed to load attendance data', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [isAdminOrManager, dateRange]);

  useEffect(() => {
    if (authLoading || !user) return;
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, [fetchData, authLoading, user]);

  const handleToggleAvailable = async () => {
    try {
      await attendanceApi.toggleAvailability('available');
      showToastMessage('Marked as available!', 'success');
      fetchData();
    } catch (error: any) {
      showToastMessage(error.response?.data?.detail || 'Failed to update status', 'error');
    }
  };

  const handleToggleUnavailable = async () => {
    try {
      await attendanceApi.toggleAvailability('unavailable');
      showToastMessage('Marked as unavailable!', 'success');
      fetchData();
    } catch (error: any) {
      showToastMessage(error.response?.data?.detail || 'Failed to update status', 'error');
    }
  };

  const handleViewLogs = (record: any) => {
    setSelectedEmployee(record);
    setShowLogsModal(true);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'unavailable': return 'bg-amber-500';
      case 'leave': return 'bg-purple-500';
      case 'absent': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const canToggle = myAttendance?.can_toggle_status && officeSettings?.is_within_office_hours;
  const isOnLeave = myAttendance?.status === 'leave';
  const isAvailable = myAttendance?.current_availability === 'available';
  const isUnavailable = myAttendance?.current_availability === 'unavailable';
  const officeHoursEnded = officeSettings?.has_office_hours_ended;

  // Team availability groups
  const teamGroups = [
    {
      key: 'available',
      label: 'Available',
      dotClass: 'bg-green-500 animate-pulse',
      badgeClass: 'bg-green-500/20 text-green-400',
      members: teamAttendance.filter(m => m.current_availability === 'available'),
    },
    {
      key: 'unavailable',
      label: 'Unavailable',
      dotClass: 'bg-amber-500',
      badgeClass: 'bg-amber-500/20 text-amber-400',
      members: teamAttendance.filter(m => m.current_availability === 'unavailable'),
    },
    {
      key: 'leave',
      label: 'On Leave',
      dotClass: 'bg-purple-500',
      badgeClass: 'bg-purple-500/20 text-purple-400',
      members: teamAttendance.filter(m => m.status === 'leave' && m.current_availability !== 'available'),
    },
    {
      key: 'notset',
      label: 'Not Set',
      dotClass: 'bg-slate-500',
      badgeClass: 'bg-slate-500/20 text-slate-400',
      members: teamAttendance.filter(m =>
        m.current_availability !== 'available' &&
        m.current_availability !== 'unavailable' &&
        m.status !== 'leave'
      ),
    },
  ];

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {toast && (
        <div className={`fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/protected/dashboard" className="text-slate-400 hover:text-white">Dashboard</Link>
          <span className="text-slate-500">/</span>
          <span className="text-white">Attendance</span>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Attendance</h1>
            <p className="text-slate-400 mt-1">Manage your availability and view team status</p>
          </div>
          {officeSettings && (
            <div className="text-right">
              <p className="text-sm text-slate-400">Office Hours</p>
              <p className="text-lg font-semibold text-white">
                {formatTime(officeSettings.office_start_time)} - {formatTime(officeSettings.office_end_time)}
              </p>
              {officeHoursEnded && <span className="text-xs text-red-400 block">Office hours have ended</span>}
              {officeSettings.is_within_office_hours && <span className="text-xs text-green-400 block">● Currently within office hours</span>}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
        </div>
      ) : (
        <>
          {/* 1. My Status Today - TOP */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${myAttendance?.current_availability === 'available' ? 'bg-green-500/20' :
                  myAttendance?.current_availability === 'unavailable' ? 'bg-amber-500/20' :
                    myAttendance?.status === 'leave' ? 'bg-purple-500/20' :
                      myAttendance?.status === 'absent' ? 'bg-red-500/20' : 'bg-slate-500/20'
                  }`}>
                  <div className={`w-4 h-4 rounded-full ${getStatusColor(myAttendance?.current_availability || 'neutral')}`}></div>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">My Status Today</h2>
                  <div className="flex items-center gap-2 mt-1">
                    {isAvailable ? (
                      <span className="text-green-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>Available
                      </span>
                    ) : isUnavailable ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>Unavailable
                      </span>
                    ) : isOnLeave ? (
                      <span className="text-purple-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>On Leave
                      </span>
                    ) : (
                      <span className="text-slate-400">Not marked</span>
                    )}
                    {myAttendance?.first_available_time && (
                      <span className="text-slate-500 text-sm">(First available: {myAttendance.first_available_time})</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                {isAdminOrManager ? (
                  canToggle && !isOnLeave ? (
                    <>
                      {!isAvailable && (
                        <button onClick={handleToggleAvailable} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Mark Available
                        </button>
                      )}
                      {isAvailable && (
                        <button onClick={handleToggleUnavailable} className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          Mark Unavailable
                        </button>
                      )}
                    </>
                  ) : isOnLeave ? (
                    <div className="px-6 py-3 bg-purple-500/20 text-purple-400 rounded-lg font-medium flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      On Leave
                    </div>
                  ) : officeHoursEnded ? (
                    <div className="px-6 py-3 bg-red-500/20 text-red-400 rounded-lg font-medium flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Office Hours Ended
                    </div>
                  ) : (
                    <div className="px-6 py-3 bg-slate-600 text-slate-400 rounded-lg font-medium flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Outside Office Hours
                    </div>
                  )
                ) : (
                  // Regular user view: same toggle buttons
                  <div className="flex items-center gap-2">
                    {canToggle && !isOnLeave ? (
                      <>
                        {!isAvailable && (
                          <button onClick={handleToggleAvailable} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Mark Available
                          </button>
                        )}
                        {isAvailable && (
                          <button onClick={handleToggleUnavailable} className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            Mark Unavailable
                          </button>
                        )}
                      </>
                    ) : isOnLeave ? (
                      <div className="px-6 py-3 bg-purple-500/20 text-purple-400 rounded-lg font-medium flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        On Leave
                      </div>
                    ) : officeHoursEnded ? (
                      <div className="px-6 py-3 bg-red-500/20 text-red-400 rounded-lg font-medium flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Office Hours Ended
                      </div>
                    ) : (
                      <div className="px-6 py-3 bg-slate-600 text-slate-400 rounded-lg font-medium flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Outside Office Hours
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2. Team Availability Today - Kanban columns */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-6">Team Availability Today</h2>
            {teamAttendance.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No team members found</p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {teamGroups.map(g => (
                  <div key={g.key} className="bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
                    {/* Column Header */}
                    <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${g.dotClass}`}></div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{g.label}</p>
                      <span className="ml-auto text-xs font-bold text-slate-500 bg-slate-800 rounded-full px-2 py-0.5">{g.members.length}</span>
                    </div>
                    {/* Users under this column */}
                    <div className="p-3 space-y-2 min-h-[60px]">
                      {g.members.length === 0 ? (
                        <p className="text-slate-600 text-xs text-center py-3">None</p>
                      ) : (
                        g.members.map(member => (
                          <div key={member.id} className="p-2 bg-slate-800/60 rounded-lg">
                            <p className="text-white text-sm font-medium truncate">{member.employee_name || member.employee_username}</p>
                            {member.last_changed_time && (
                              <p className="text-[10px] text-slate-500 mt-0.5">{member.last_changed_time}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>


          {/* 3. My Activity Timeline */}
          {myAttendance?.daily_logs && myAttendance.daily_logs.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-8">
              <h2 className="text-xl font-semibold text-white mb-4">My Activity Timeline Today</h2>
              <div className="space-y-4">
                {myAttendance.daily_logs.map((log: AttendanceLog) => (
                  <div key={log.id} className="flex items-start gap-4">
                    <div className={`w-3 h-3 rounded-full mt-1.5 ${log.status === 'available' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{log.status === 'available' ? 'Available' : 'Unavailable'}</span>
                        <span className="text-slate-500 text-sm">at {log.time_display}</span>
                        {log.is_auto && <span className="px-2 py-0.5 bg-slate-600 text-slate-300 text-xs rounded">Auto</span>}
                      </div>
                      {log.note && <p className="text-slate-400 text-sm mt-1">{log.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. My Attendance History */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              My Attendance History
              <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md">(last 7 days)</span>
            </h2>
            <div className="grid grid-cols-7 gap-2">
              {attendanceHistory.slice(0, 28).map((record) => {
                const date = new Date(record.date);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = date.getDate();
                return (
                  <div key={record.id} className={`p-3 rounded-lg text-center ${record.status === 'present' ? 'bg-green-500/20 border border-green-500/40' :
                    record.status === 'leave' ? 'bg-purple-500/20 border border-purple-500/40' :
                      record.status === 'absent' ? 'bg-red-500/20 border border-red-500/40' :
                        'bg-slate-700/30 border border-slate-600/30'
                    }`}>
                    <p className="text-xs text-slate-400">{dayName}</p>
                    <p className="text-lg font-bold text-white">{dayNum}</p>
                    <div className={`w-2 h-2 rounded-full mx-auto mt-1 ${record.status === 'present' ? 'bg-green-500' :
                      record.status === 'leave' ? 'bg-purple-500' :
                        record.status === 'absent' ? 'bg-red-500' : 'bg-slate-500'
                      }`}></div>
                    {record.first_available_time && <p className="text-xs text-green-400 mt-1">{record.first_available_time}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4b. Attendance Period Filter - right after history */}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 flex flex-wrap items-center justify-between gap-6 mb-8">
            <div>
              <h3 className="text-white font-semibold mb-1">Attendance Period</h3>
              <p className="text-xs text-slate-500">Filter history and statistics by date range</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">From</label>
                <input type="date" name="start" value={dateRange.start} onChange={handleDateChange} className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-sky-500 focus:border-sky-500 outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">To</label>
                <input type="date" name="end" value={dateRange.end} onChange={handleDateChange} className="bg-slate-900 border border-slate-700 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-sky-500 focus:border-sky-500 outline-none" />
              </div>
              <button onClick={() => fetchData()} className="px-6 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg transition-all active:scale-95 shadow-lg shadow-sky-900/20">
                Update Statistics
              </button>
            </div>
          </div>

          {/* 5. Attendance Statistics */}
          {attendanceStats && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5">
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Working Days</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-white">{attendanceStats.total_working_days}</p>
                  <p className="text-xs text-slate-500">days</p>
                </div>
                <p className="text-[10px] text-slate-600 mt-1">Days attendance was recorded</p>
              </div>
              <div className="bg-green-500/5 rounded-xl border border-green-500/20 p-5">
                <p className="text-green-500/70 text-xs font-semibold uppercase tracking-wider mb-1">Present</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-green-400">{attendanceStats.present_days}</p>
                  <p className="text-xs text-green-500/50">marked</p>
                </div>
              </div>
              <div className="bg-red-500/5 rounded-xl border border-red-500/20 p-5">
                <p className="text-red-500/70 text-xs font-semibold uppercase tracking-wider mb-1">Absent</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-red-400">{attendanceStats.absent_days}</p>
                  <p className="text-xs text-red-500/50">missed</p>
                </div>
              </div>
              <div className="bg-purple-500/5 rounded-xl border border-purple-500/20 p-5">
                <p className="text-purple-500/70 text-xs font-semibold uppercase tracking-wider mb-1">Leaves</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-purple-400">{attendanceStats.leave_days}</p>
                  <p className="text-xs text-purple-500/50">requests</p>
                </div>
              </div>
              <div className="bg-sky-500/5 rounded-xl border border-sky-500/20 p-5">
                <p className="text-sky-500/70 text-xs font-semibold uppercase tracking-wider mb-1">Presence Rate</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-sky-400">{attendanceStats.percentage.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          )}

          {/* 6. Admin: Team Performance Report */}
          {isAdminOrManager && teamStats?.stats && (
            <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-6 mb-8 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">Team Performance Report</h2>
                  <p className="text-xs text-slate-500 mt-1">Aggregated attendance metrics across the selected period</p>
                </div>
                <span className="px-3 py-1 bg-sky-500/10 text-sky-400 text-[10px] uppercase tracking-widest font-bold rounded-full border border-sky-500/20">Administrative View</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Employee</th>
                      <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Working Days</th>
                      <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Present</th>
                      <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Absent</th>
                      <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Leaves</th>
                      <th className="pb-3 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Activity Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30">
                    {teamStats.stats.map((emp) => (
                      <tr key={emp.employee_id} className="hover:bg-slate-700/20 transition-colors group">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                              {emp.username.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-white group-hover:text-sky-400 transition-colors line-clamp-1">{emp.full_name || emp.username}</p>
                              <p className="text-[10px] text-slate-500 line-clamp-1">@{emp.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4"><span className="text-sm font-semibold text-white">{emp.working_days}</span><span className="text-[10px] text-slate-500 ml-1">d</span></td>
                        <td className="py-4"><span className="text-sm font-semibold text-green-400">{emp.present_days}</span><span className="text-[10px] text-slate-500 ml-1">d</span></td>
                        <td className="py-4"><span className="text-sm font-semibold text-red-500">{emp.absent_days}</span><span className="text-[10px] text-slate-500 ml-1">d</span></td>
                        <td className="py-4"><span className="text-sm font-semibold text-purple-400">{emp.leave_days}</span><span className="text-[10px] text-slate-500 ml-1">d</span></td>
                        <td className="py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <div className="w-20 bg-slate-700 h-1.5 rounded-full overflow-hidden hidden sm:block">
                              <div className={`h-full rounded-full ${emp.percentage > 85 ? 'bg-green-500' : emp.percentage > 60 ? 'bg-sky-500' : 'bg-red-500'}`} style={{ width: `${emp.percentage}%` }}></div>
                            </div>
                            <span className="text-sm font-bold text-white tabular-nums">{emp.percentage.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}


        </>
      )
      }

      {/* Logs Modal */}
      {
        showLogsModal && selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Activity Logs: {selectedEmployee.employee_name}</h2>
                  <button onClick={() => setShowLogsModal(false)} className="text-slate-400 hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
              <div className="p-6">
                {selectedEmployee.logs?.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No activity logs for today</p>
                ) : (
                  <div className="space-y-4">
                    {selectedEmployee.logs.map((log: AttendanceLog) => (
                      <div key={log.id} className="flex items-start gap-4 p-3 bg-slate-700/30 rounded-lg">
                        <div className={`w-3 h-3 rounded-full mt-1 ${log.status === 'available' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{log.status_display}</span>
                            <span className="text-slate-500 text-sm">{log.time_display}</span>
                            {log.is_auto && <span className="px-2 py-0.5 bg-slate-600 text-slate-300 text-xs rounded">Auto</span>}
                          </div>
                          {log.note && <p className="text-slate-400 text-sm mt-1">{log.note}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
