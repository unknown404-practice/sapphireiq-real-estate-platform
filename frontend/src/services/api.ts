import { ApiResponse, FilterParams, Property, PropertyImage, Appointment, AppointmentStatus, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...((options.headers as Record<string, string>) || {}),
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
    let data: any;

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      data = { error: text || `HTTP ${res.status}` };
    }

    // Auto-refresh access token on 401 if refresh session is active
    if (
      res.status === 401 &&
      endpoint !== '/auth/refresh' &&
      endpoint !== '/auth/login' &&
      endpoint !== '/auth/register'
    ) {
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          if (refreshData.token) {
            localStorage.setItem('token', refreshData.token);
            // Replay original request with refreshed access token
            const retryHeaders = {
              ...headers,
              Authorization: `Bearer ${refreshData.token}`,
            };
            const retryRes = await fetch(url, {
              ...options,
              headers: retryHeaders,
              credentials: 'include',
            });
            if (retryRes.headers.get('content-type')?.includes('application/json')) {
              return await retryRes.json();
            }
          }
        }
      } catch {
        // Refresh attempt failed, continue to return original 401 error
      }
    }

    if (!res.ok) {
      return {
        success: false,
        error: data.error || data.message || `Request failed with status ${res.status}`,
      };
    }

    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network error occurred. Please verify your connection.',
    };
  }
}

export const api = {
  // Authentication
  auth: {
    async register(payload: { name: string; email: string; password: string; phone?: string }) {
      return request<{ user: User; token: string; refreshToken?: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async login(payload: { email: string; password: string }) {
      return request<{ user: User; token: string; refreshToken?: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },

    async logout() {
      return request<{ message: string }>('/auth/logout', {
        method: 'POST',
      });
    },

    async refresh() {
      return request<{ user: User; token: string; refreshToken?: string }>('/auth/refresh', {
        method: 'POST',
      });
    },

    async getMe() {
      return request<{ user: User }>('/auth/me', {
        method: 'GET',
      });
    },

    async forgotPassword(email: string) {
      return request<{ message: string; devResetToken?: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    async resetPassword(token: string, password: string) {
      return request<{ message: string }>(`/auth/reset-password/${token}`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
    },
  },

  // Properties
  properties: {
    async getAll(params: FilterParams = {}) {
      const query = new URLSearchParams();
      if (params.city) query.append('city', params.city);
      if (params.propertyType) query.append('propertyType', params.propertyType);
      if (params.listingType) query.append('listingType', params.listingType);
      if (params.minPrice) query.append('minPrice', String(params.minPrice));
      if (params.maxPrice) query.append('maxPrice', String(params.maxPrice));
      if (params.bedrooms) query.append('bedrooms', String(params.bedrooms));
      if (params.search) query.append('search', params.search);
      if (params.sort) query.append('sort', params.sort);
      if (params.page) query.append('page', String(params.page));
      if (params.limit) query.append('limit', String(params.limit));

      const qs = query.toString();
      return request<Property[]>(`/properties${qs ? `?${qs}` : ''}`);
    },

    async getById(id: string) {
      return request<Property>(`/properties/${id}`);
    },

    async create(propertyData: Partial<Property>) {
      return request<Property>('/properties', {
        method: 'POST',
        body: JSON.stringify(propertyData),
      });
    },

    async update(id: string, propertyData: Partial<Property>) {
      return request<Property>(`/properties/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(propertyData),
      });
    },

    async delete(id: string) {
      return request<{ message: string }>(`/properties/${id}`, {
        method: 'DELETE',
      });
    },

    async getMyProperties() {
      return request<Property[]>('/properties/user/mine');
    },

    async uploadImages(files: File[]): Promise<ApiResponse<PropertyImage[]>> {
      try {
        const formData = new FormData();
        files.forEach((file) => formData.append('images', file));

        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE_URL}/properties/upload-images`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        let data: any;
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          data = { error: text || `HTTP ${res.status}` };
        }

        if (!res.ok) {
          return {
            success: false,
            error: data.error || data.message || `Upload failed with status ${res.status}`,
          };
        }

        return data;
      } catch (err: any) {
        return {
          success: false,
          error: err.message || 'Image upload network failure',
        };
      }
    },
  },

  // Appointments
  appointments: {
    async createGuest(data: {
      property: string;
      guestName: string;
      guestEmail: string;
      guestPhone: string;
      scheduledAt: string;
      notes?: string;
    }) {
      return request<Appointment>('/appointments/guest', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async createAuth(data: {
      property: string;
      scheduledAt: string;
      notes?: string;
      phone?: string;
    }) {
      return request<Appointment>('/appointments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getMyAppointments() {
      return request<Appointment[]>('/appointments/mine');
    },

    async cancel(id: string) {
      return request<Appointment>(`/appointments/${id}/cancel`, {
        method: 'PATCH',
      });
    },

    async updateStatus(id: string, status: AppointmentStatus) {
      return request<Appointment>(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
    },
  },

  // Health
  health: {
    async check() {
      return request<{ status: string; database: string }>('/health');
    },
  },
};
