'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { calendarApi, CalendarEvent, CalendarEventInput, CalendarCategory } from '@/lib/calendar';
import { attendanceApi, WeekendHolidays } from '@/lib/attendance';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatEventDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatEventDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function CalendarPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [categories, setCategories] = useState<CalendarCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showEventDetail, setShowEventDetail] = useState<CalendarEvent | null>(null);
  const [weekendHolidays, setWeekendHolidays] = useState<WeekendHolidays>('saturday');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [formData, setFormData] = useState<CalendarEventInput>({
    title: '',
    description: '',
    date: '',
    category: 'other',
    is_full_day: true,
    start_time: '',
    end_time: '',
  });

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchEvents();
    fetchCategories();
    attendanceApi.getOfficeSettings()
      .then((settings) => setWeekendHolidays(settings.weekend_holidays ?? 'saturday'))
      .catch(() => setWeekendHolidays('saturday'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      const response = await calendarApi.getEventsByMonth(year, month);
      setEvents(response.events);
    } catch (error) {
      console.error('Error fetching events:', error);
      showToastMessage('Failed to load calendar events', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const cats = await calendarApi.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = toDateKey(date);
    return events.filter((event) => event.date === dateStr);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isWeekendOff = (date: Date) => {
    const day = date.getDay();
    if (weekendHolidays === 'saturday') return day === 6;
    if (weekendHolidays === 'sunday') return day === 0;
    return day === 0 || day === 6;
  };

  const openAddModal = (date?: Date) => {
    if (!isAdmin) return;

    const selected = date || new Date();
    setFormData({
      title: '',
      description: '',
      date: toDateKey(selected),
      category: 'other',
      is_full_day: true,
      start_time: '',
      end_time: '',
    });
    setIsEditing(false);
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const openEditModal = (event: CalendarEvent) => {
    if (!isAdmin) return;

    setSelectedEvent(event);
    setFormData({
      title: event.title,
      description: event.description,
      date: event.date,
      category: event.category,
      is_full_day: event.is_full_day,
      start_time: event.start_time || '',
      end_time: event.end_time || '',
    });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedEvent(null);
    setIsEditing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEditing && selectedEvent) {
        await calendarApi.updateEvent(selectedEvent.id, formData);
        showToastMessage('Event updated successfully', 'success');
      } else {
        await calendarApi.createEvent(formData);
        showToastMessage('Event created successfully', 'success');
      }

      closeModal();
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      showToastMessage('Failed to save event', 'error');
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !selectedEvent) return;

    if (confirm('Are you sure you want to delete this event?')) {
      try {
        await calendarApi.deleteEvent(selectedEvent.id);
        showToastMessage('Event deleted', 'success');
        closeModal();
        fetchEvents();
      } catch (error) {
        console.error('Error deleting event:', error);
        showToastMessage('Failed to delete event', 'error');
      }
    }
  };

  const handleDeleteFromDetail = async (event: CalendarEvent) => {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      await calendarApi.deleteEvent(event.id);
      setShowEventDetail(null);
      showToastMessage('Event deleted', 'success');
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      showToastMessage('Failed to delete event', 'error');
    }
  };

  const calendarDays = getCalendarDays();
  const todayKey = toDateKey(new Date());

  const monthStats = useMemo(() => {
    const holidays = events.filter((e) => e.category === 'holiday').length;
    const upcoming = events.filter((e) => e.date >= todayKey).length;
    return { total: events.length, holidays, upcoming };
  }, [events, todayKey]);

  const upcomingEvents = useMemo(() => {
    return [...events]
      .filter((e) => e.date >= todayKey)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || ''))
      .slice(0, 5);
  }, [events, todayKey]);

  const getCategoryLabel = (value: string) =>
    categories.find((c) => c.value === value)?.label || value;

  return (
    <div className="page-container calendar-page">
      {toast && (
        <div className={`toast ${toast.type === 'success' ? 'toast-success' : 'toast-error'}`}>
          {toast.message}
        </div>
      )}

      <header className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <nav className="breadcrumb">
              <Link href="/protected/dashboard">Dashboard</Link>
              <span className="breadcrumb-sep">/</span>
              <span>Calendar</span>
            </nav>
            <h1 className="page-title">Calendar</h1>
          </div>
          {isAdmin && (
            <button type="button" onClick={() => openAddModal()} className="btn-primary px-3 py-1.5 text-sm shrink-0 self-start sm:self-center">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add event
            </button>
          )}
        </div>
      </header>

      <div className="calendar-page-layout">
        <div className="surface-panel overflow-hidden p-0">
          <div className="calendar-toolbar">
            <div className="calendar-toolbar-nav">
              <button type="button" onClick={goToPreviousMonth} className="icon-btn" aria-label="Previous month">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="calendar-month-label">
                {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <button type="button" onClick={goToNextMonth} className="icon-btn" aria-label="Next month">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="calendar-compact-stats">
              <span className="calendar-stat-pill"><strong>{monthStats.total}</strong> events</span>
              <span className="calendar-stat-pill"><strong>{monthStats.holidays}</strong> holidays</span>
              <span className="calendar-stat-pill"><strong>{monthStats.upcoming}</strong> upcoming</span>
            </div>

            <button type="button" onClick={goToToday} className="btn-secondary px-2.5 py-1 text-xs">
              Today
            </button>
          </div>

          <div className="calendar-grid">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="calendar-weekday">{day}</div>
            ))}

            {loading ? (
              <div className="col-span-7 empty-state py-10">
                <div
                  className="animate-spin rounded-full h-8 w-8 border-2 mx-auto mb-4"
                  style={{ borderColor: 'var(--border-default)', borderTopColor: 'var(--accent)' }}
                />
                <p>Loading calendar...</p>
              </div>
            ) : (
              calendarDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="calendar-day calendar-day--empty" />;
                }

                const dayEvents = getEventsForDate(date);
                const today = isToday(date);
                const weekendOff = isWeekendOff(date);
                const visibleEvents = dayEvents.slice(0, 1);
                const hiddenCount = dayEvents.length - visibleEvents.length;
                const canAdd = isAdmin && dayEvents.length === 0;

                return (
                  <div
                    key={toDateKey(date)}
                    onClick={() => {
                      if (dayEvents.length === 1) {
                        setShowEventDetail(dayEvents[0]);
                      } else if (canAdd) {
                        openAddModal(date);
                      }
                    }}
                    className={`calendar-day${today ? ' calendar-day--today' : ''}${weekendOff && dayEvents.length === 0 ? ' calendar-day--weekend' : ''}${dayEvents.length > 0 || canAdd ? ' calendar-day--interactive' : ''}`}
                  >
                    <div className="calendar-day-header">
                      <span className="calendar-day-number">{date.getDate()}</span>
                      {weekendOff && dayEvents.length === 0 && (
                        <span className="calendar-day-off">Off</span>
                      )}
                    </div>

                    <div className="calendar-day-events">
                      {visibleEvents.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          className="calendar-event-pill"
                          style={{ '--event-color': event.color } as React.CSSProperties}
                          title={event.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEventDetail(event);
                          }}
                        >
                          <span className="calendar-event-pill__dot" />
                          <span className="calendar-event-pill__text">
                            <span className="calendar-event-pill__title">{event.title}</span>
                          </span>
                        </button>
                      ))}
                      {hiddenCount > 0 && (
                        <button
                          type="button"
                          className="calendar-day-more"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowEventDetail(dayEvents[0]);
                          }}
                        >
                          +{hiddenCount} more
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside>
          <div className="surface-panel calendar-sidebar-panel">
            <h3 className="calendar-sidebar-title">Upcoming</h3>
            {upcomingEvents.length === 0 ? (
              <p className="meta-text text-xs">No upcoming events.</p>
            ) : (
              <div className="calendar-upcoming-list">
                {upcomingEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    className="calendar-upcoming-item"
                    onClick={() => setShowEventDetail(event)}
                  >
                    <p className="calendar-upcoming-item__date">{formatEventDate(event.date)}</p>
                    <p className="calendar-upcoming-item__title">{event.title}</p>
                    <div className="calendar-upcoming-item__meta">
                      <span
                        className="calendar-legend-dot"
                        style={{ backgroundColor: event.color }}
                      />
                      <span className="truncate">{getCategoryLabel(event.category)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {categories.length > 0 && (
              <div className="calendar-legend">
                {categories.map((cat) => (
                  <span key={cat.value} className="calendar-legend-item">
                    <span className="calendar-legend-dot" style={{ backgroundColor: cat.color }} />
                    {cat.label}
                  </span>
                ))}
              </div>
            )}

            <p className="calendar-weekend-note">
              {weekendHolidays === 'saturday' && 'Weekly off: Saturday'}
              {weekendHolidays === 'sunday' && 'Weekly off: Sunday'}
              {weekendHolidays === 'both' && 'Weekly off: Sat & Sun'}
            </p>
          </div>
        </aside>
      </div>

      {isModalOpen && isAdmin && (
        <div className="modal-overlay">
          <div className="modal-panel max-h-[90vh] overflow-y-auto">
            <div className="modal-header">
              <h2 className="modal-title">{isEditing ? 'Edit event' : 'Add event'}</h2>
              <button type="button" onClick={closeModal} className="icon-btn" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="input-field"
                    placeholder="e.g. Independence Day"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="input-field resize-none"
                    placeholder="Add details about this event..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                    Category *
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                    className="input-field"
                  >
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    name="is_full_day"
                    checked={formData.is_full_day}
                    onChange={handleInputChange}
                  />
                  Full day event
                </label>

                {!formData.is_full_day && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        Start time *
                      </label>
                      <input
                        type="time"
                        name="start_time"
                        value={formData.start_time}
                        onChange={handleInputChange}
                        required={!formData.is_full_day}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        End time
                      </label>
                      <input
                        type="time"
                        name="end_time"
                        value={formData.end_time}
                        onChange={handleInputChange}
                        className="input-field"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                {isEditing && (
                  <button type="button" onClick={handleDelete} className="btn-secondary text-red-500 border-red-200">
                    Delete
                  </button>
                )}
                <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {isEditing ? 'Update event' : 'Add event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEventDetail && (
        <div className="modal-overlay">
          <div className="modal-panel max-w-lg">
            <div
              className="h-1 rounded-t-xl"
              style={{ backgroundColor: showEventDetail.color }}
            />
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{showEventDetail.title}</h2>
                <span
                  className="calendar-detail-badge mt-2"
                  style={{
                    backgroundColor: `${showEventDetail.color}20`,
                    color: showEventDetail.color,
                  }}
                >
                  {getCategoryLabel(showEventDetail.category)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowEventDetail(null)}
                className="icon-btn"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body space-y-4">
              <div className="calendar-detail-row">
                <div className="calendar-detail-row__icon">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {formatEventDateLong(showEventDetail.date)}
                  </p>
                  <p className="meta-text text-xs mt-0.5">
                    {showEventDetail.is_full_day
                      ? 'All day'
                      : `${showEventDetail.start_time?.substring(0, 5) || ''}${showEventDetail.end_time ? ` – ${showEventDetail.end_time.substring(0, 5)}` : ''}`}
                  </p>
                </div>
              </div>

              {showEventDetail.description && (
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {showEventDetail.description}
                </p>
              )}
            </div>

            {isAdmin && (
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => handleDeleteFromDetail(showEventDetail)}
                  className="btn-secondary"
                  style={{ color: 'var(--danger)' }}
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEventDetail(null);
                    openEditModal(showEventDetail);
                  }}
                  className="btn-primary flex-1"
                >
                  Edit event
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
