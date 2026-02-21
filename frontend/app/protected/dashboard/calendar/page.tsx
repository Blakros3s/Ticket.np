'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { calendarApi, CalendarEvent, CalendarEventInput, CalendarCategory } from '@/lib/calendar';

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
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showEventDetail, setShowEventDetail] = useState<CalendarEvent | null>(null);

  // Form state
  const [formData, setFormData] = useState<CalendarEventInput>({
    title: '',
    description: '',
    date: '',
    category: 'other',
    is_full_day: true,
    start_time: '',
    end_time: '',
  });

  // Fetch events for current month
  useEffect(() => {
    fetchEvents();
    fetchCategories();
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

  // Calendar navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get calendar grid data
  const getCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay(); // 0 = Sunday

    const days: (Date | null)[] = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDay; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => event.date === dateStr);
  };

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is Saturday (holiday in Nepali calendar)
  const isSaturday = (date: Date) => {
    return date.getDay() === 6;
  };

  // Modal handlers
  const openAddModal = (date?: Date) => {
    if (!isAdmin) return;

    const selected = date || new Date();
    setSelectedDate(selected);
    setFormData({
      title: '',
      description: '',
      date: selected.toISOString().split('T')[0],
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

  // Form handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (isEditing && selectedEvent) {
        await calendarApi.updateEvent(selectedEvent.id, formData);
      } else {
        await calendarApi.createEvent(formData);
      }

      closeModal();
      fetchEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Error saving event. Please try again.');
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !selectedEvent) return;

    if (confirm('Are you sure you want to delete this event?')) {
      try {
        await calendarApi.deleteEvent(selectedEvent.id);
        closeModal();
        fetchEvents();
      } catch (error) {
        console.error('Error deleting event:', error);
        alert('Error deleting event. Please try again.');
      }
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const calendarDays = getCalendarDays();

  return (
    <div className="min-h-screen bg-slate-900/50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Calendar</h1>
            <p className="text-slate-400">View company events, holidays, and important dates</p>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => openAddModal()}
                className="px-4 py-2 bg-gradient-to-r from-sky-400 to-violet-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Event
              </button>
            )}
          </div>
        </div>

        {/* Calendar Navigation */}
        <div className="glass-card rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={goToPreviousMonth}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className="text-xl font-semibold text-white">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <button
                onClick={goToNextMonth}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <button
              onClick={goToToday}
              className="px-4 py-2 text-sky-400 hover:text-sky-300 transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-6">
          {categories.map(cat => (
            <div key={cat.value} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-sm text-slate-300">{cat.label}</span>
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="glass-card rounded-xl overflow-hidden">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-slate-700/50">
            {weekDays.map(day => (
              <div key={day} className="p-4 text-center text-sm font-medium text-slate-400">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          {loading ? (
            <div className="p-12 text-center text-slate-400">Loading calendar...</div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((date, index) => {
                if (!date) {
                  return (
                    <div key={`empty-${index}`} className="min-h-[120px] border-b border-r border-slate-700/30 bg-slate-800/20" />
                  );
                }

                const dayEvents = getEventsForDate(date);
                const today = isToday(date);
                const saturday = isSaturday(date);
                const primaryEvent = dayEvents.length > 0 ? dayEvents[0] : null;

                let cellStyle: React.CSSProperties = {};
                if (primaryEvent) {
                  cellStyle = { backgroundColor: `${primaryEvent.color}15` };
                }

                return (
                  <div
                    key={date.toISOString()}
                    onClick={() => {
                      if (primaryEvent) {
                        setShowEventDetail(primaryEvent);
                      } else if (isAdmin) {
                        openAddModal(date);
                      }
                    }}
                    className={`min-h-[120px] border-b border-r border-slate-700/30 flex flex-col p-3 cursor-pointer transition-colors hover:opacity-80 ${today && !primaryEvent ? 'bg-sky-500/10' : ''
                      } ${saturday && !primaryEvent ? 'bg-red-500/5' : ''}`}
                    style={cellStyle}
                  >
                    <div className={`text-sm font-medium mb-1 ${today ? 'text-sky-400' : saturday ? 'text-red-400' : 'text-slate-300'
                      }`}>
                      {date.getDate()}
                      {saturday && !primaryEvent && <span className="ml-1 text-xs text-red-500/70">(Holiday)</span>}
                    </div>
                    <div className="flex-1 flex flex-col gap-3 mt-1">
                      {dayEvents.map(event => (
                        <div
                          key={event.id}
                          className="w-full text-left"
                          style={{ color: event.color }}
                          title={event.title}
                          onClick={(e) => {
                            if (dayEvents.length > 1) {
                              e.stopPropagation();
                              setShowEventDetail(event);
                            }
                          }}
                        >
                          <div className="font-bold text-[15px] leading-tight break-words">{event.title}</div>
                          {!event.is_full_day && event.start_time && (
                            <div className="font-semibold text-xs opacity-90 mt-1">{event.start_time.substring(0, 5)}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="glass-card rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {isEditing ? 'Edit Event' : 'Add Event'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                    placeholder="e.g., Independence Day"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                    placeholder="Add details about this event..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Category *
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    name="is_full_day"
                    id="is_full_day"
                    checked={formData.is_full_day}
                    onChange={handleInputChange}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500"
                  />
                  <label htmlFor="is_full_day" className="text-sm text-slate-300">
                    Full Day Event
                  </label>
                </div>

                {!formData.is_full_day && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Start Time *
                      </label>
                      <input
                        type="time"
                        name="start_time"
                        value={formData.start_time}
                        onChange={handleInputChange}
                        required={!formData.is_full_day}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        name="end_time"
                        value={formData.end_time}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-sky-400 to-violet-500 text-white rounded-lg hover:opacity-90 transition-opacity"
                  >
                    {isEditing ? 'Update Event' : 'Add Event'}
                  </button>

                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500/30 transition-colors"
                    >
                      Delete
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Event Detail View Modal */}
      {showEventDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-2xl w-full max-w-lg overflow-hidden border-t-4 shadow-2xl" style={{ borderTopColor: showEventDetail.color }}>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">{showEventDetail.title}</h2>
                  <div
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide"
                    style={{ backgroundColor: `${showEventDetail.color}20`, color: showEventDetail.color }}
                  >
                    {categories.find(c => c.value === showEventDetail.category)?.label || showEventDetail.category}
                  </div>
                </div>
                <button
                  onClick={() => setShowEventDetail(null)}
                  className="text-slate-400 hover:text-white transition-colors p-1 bg-slate-800/50 rounded-full hover:bg-slate-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-3 text-slate-300">
                  <div className="p-2 bg-slate-800 rounded-lg text-sky-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{new Date(showEventDetail.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    <div className="text-xs text-slate-400">
                      {showEventDetail.is_full_day ? 'All Day Event' : `${showEventDetail.start_time?.substring(0, 5) || ''} - ${showEventDetail.end_time?.substring(0, 5) || ''}`.replace(/ - $/, '')}
                    </div>
                  </div>
                </div>

                {showEventDetail.description && (
                  <div className="text-sm text-slate-300 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                    {showEventDetail.description}
                  </div>
                )}
              </div>

              {isAdmin && (
                <div className="flex gap-3 pt-4 border-t border-slate-700/50">
                  <button
                    onClick={() => {
                      setShowEventDetail(null);
                      openEditModal(showEventDetail);
                    }}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Event
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this event?')) {
                        calendarApi.deleteEvent(showEventDetail.id).then(() => {
                          setShowEventDetail(null);
                          fetchEvents();
                        }).catch(err => {
                          console.error('Error deleting event:', err);
                          alert('Failed to delete event');
                        });
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Event
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
