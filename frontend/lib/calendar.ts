import api from './api';

export interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  date: string;
  category: 'holiday' | 'programme' | 'meeting' | 'deadline' | 'birthday' | 'other';
  category_display: string;
  color: string;
  is_full_day: boolean;
  start_time?: string;
  end_time?: string;
  created_by?: {
    id: number;
    username: string;
    first_name: string;
    last_name: string;
  };
  created_at: string;
  updated_at: string;
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  date: string;
  category: 'holiday' | 'programme' | 'meeting' | 'deadline' | 'birthday' | 'other';
  color?: string;
  is_full_day?: boolean;
  start_time?: string;
  end_time?: string;
}

export interface CalendarCategory {
  value: string;
  label: string;
  color: string;
}

export interface MonthEventsResponse {
  year: number;
  month: number;
  events: CalendarEvent[];
}

export const calendarApi = {
  // Get all events
  getEvents: async (): Promise<CalendarEvent[]> => {
    const response = await api.get('/calendar/events/');
    return response.data.results;
  },

  // Get single event
  getEvent: async (id: number): Promise<CalendarEvent> => {
    const response = await api.get(`/calendar/events/${id}/`);
    return response.data;
  },

  // Get events for a specific month
  getEventsByMonth: async (year: number, month: number): Promise<MonthEventsResponse> => {
    const response = await api.get('/calendar/events/month/', {
      params: { year, month }
    });
    return response.data;
  },

  // Get events for a date range
  getEventsByRange: async (start: string, end: string): Promise<{ events: CalendarEvent[]; count: number }> => {
    const response = await api.get('/calendar/events/range/', {
      params: { start, end }
    });
    return response.data;
  },

  // Create event (admin only)
  createEvent: async (data: CalendarEventInput): Promise<CalendarEvent> => {
    // Remove empty time fields to avoid validation errors
    const cleanedData = { ...data };
    if (!cleanedData.start_time) {
      delete cleanedData.start_time;
    }
    if (!cleanedData.end_time) {
      delete cleanedData.end_time;
    }
    const response = await api.post('/calendar/events/', cleanedData);
    return response.data;
  },

  // Update event (admin only)
  updateEvent: async (id: number, data: Partial<CalendarEventInput>): Promise<CalendarEvent> => {
    // Remove empty time fields to avoid validation errors
    const cleanedData = { ...data };
    if (!cleanedData.start_time) {
      delete cleanedData.start_time;
    }
    if (!cleanedData.end_time) {
      delete cleanedData.end_time;
    }
    const response = await api.patch(`/calendar/events/${id}/`, cleanedData);
    return response.data;
  },

  // Delete event (admin only)
  deleteEvent: async (id: number): Promise<void> => {
    await api.delete(`/calendar/events/${id}/`);
  },

  // Get all categories
  getCategories: async (): Promise<CalendarCategory[]> => {
    const response = await api.get('/calendar/events/categories/');
    return response.data;
  },
};
