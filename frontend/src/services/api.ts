import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Создание экземпляра axios с базовой конфигурацией
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Интерцептор для добавления токена к запросам
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Интерцептор для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API для аутентификации
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (email: string, password: string, firstName: string, lastName: string) => {
    const response = await api.post('/auth/register', { email, password, firstName, lastName });
    return response.data;
  },

  refreshToken: async () => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  updateProfile: async (firstName?: string, lastName?: string) => {
    const response = await api.put('/users/profile', { firstName, lastName });
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/auth/change-password', { currentPassword, newPassword });
    return response.data;
  },
};

// API для запросов
export const queriesApi = {
  getQueries: async (params?: { page?: number; limit?: number; status?: string; tag?: string }) => {
    const response = await api.get('/queries', { params });
    return response.data;
  },

  getQuery: async (id: string) => {
    const response = await api.get(`/queries/${id}`);
    return response.data;
  },

  createTextQuery: async (text: string) => {
    const response = await api.post('/queries/text', { text });
    return response.data;
  },

  createVoiceQuery: async (audioFile: File) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    const response = await api.post('/queries/voice', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  createFilesQuery: async (files: File[], text?: string) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (text) formData.append('text', text);
    const response = await api.post('/queries/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteQuery: async (id: string) => {
    const response = await api.delete(`/queries/${id}`);
    return response.data;
  },
};

// API для ответов
export const responsesApi = {
  getResponse: async (queryId: string) => {
    const response = await api.get(`/responses/${queryId}`);
    return response.data;
  },

  rateResponse: async (queryId: string, rating: number) => {
    const response = await api.post(`/responses/${queryId}/rate`, { rating });
    return response.data;
  },

  publishResponse: async (queryId: string, isPublished: boolean) => {
    const response = await api.post(`/responses/${queryId}/publish`, { isPublished });
    return response.data;
  },

  getResponseStats: async () => {
    const response = await api.get('/responses/stats/overview');
    return response.data;
  },

  getTagStats: async () => {
    const response = await api.get('/responses/stats/tags');
    return response.data;
  },

  exportToPDF: async (queryId: string) => {
    const response = await api.post(`/responses/${queryId}/export-pdf`);
    return response.data;
  },

  getSimilarResponses: async (queryId: string, limit?: number) => {
    const response = await api.get(`/responses/${queryId}/similar`, { params: { limit } });
    return response.data;
  },

  requestConsultation: async (queryId: string, message?: string) => {
    const response = await api.post(`/responses/${queryId}/request-consultation`, { message });
    return response.data;
  },
};

// API для файлов
export const filesApi = {
  getQueryFiles: async (queryId: string) => {
    const response = await api.get(`/files/query/${queryId}`);
    return response.data;
  },

  downloadFile: async (fileId: string) => {
    const response = await api.get(`/files/download/${fileId}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  deleteFile: async (fileId: string) => {
    const response = await api.delete(`/files/${fileId}`);
    return response.data;
  },
};

// API для пользователей
export const usersApi = {
  getProfile: async () => {
    const response = await api.get('/users/profile');
    return response.data;
  },

  updateProfile: async (firstName?: string, lastName?: string) => {
    const response = await api.put('/users/profile', { firstName, lastName });
    return response.data;
  },

  getUserStats: async () => {
    const response = await api.get('/users/stats');
    return response.data;
  },

  getUserActivity: async (params?: { page?: number; limit?: number }) => {
    const response = await api.get('/users/activity', { params });
    return response.data;
  },

  // Админские функции
  getAllUsers: async (params?: { page?: number; limit?: number; role?: string; isActive?: boolean }) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  updateUser: async (userId: string, data: { role?: string; isActive?: boolean }) => {
    const response = await api.put(`/users/${userId}`, data);
    return response.data;
  },

  deleteUser: async (userId: string) => {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },

  getUserOverviewStats: async () => {
    const response = await api.get('/users/stats/overview');
    return response.data;
  },
};

// API для webhooks
export const webhooksApi = {
  triggerNewQuery: async (data: { queryId: string; userId: string; type: string }) => {
    const response = await api.post('/webhooks/new-query', data);
    return response.data;
  },

  triggerResponseCompleted: async (data: { queryId: string; userId: string; response: any }) => {
    const response = await api.post('/webhooks/response-completed', data);
    return response.data;
  },

  triggerHighRatedResponse: async (data: { queryId: string; userId: string; rating: number }) => {
    const response = await api.post('/webhooks/high-rated-response', data);
    return response.data;
  },

  triggerPublishArticle: async (data: { queryId: string; seoArticle: string }) => {
    const response = await api.post('/webhooks/publish-article', data);
    return response.data;
  },

  triggerConsultationRequest: async (data: { queryId: string; userId: string; message?: string }) => {
    const response = await api.post('/webhooks/consultation-request', data);
    return response.data;
  },

  triggerSystemHealth: async (data: { status: string; metrics: any }) => {
    const response = await api.post('/webhooks/system-health', data);
    return response.data;
  },
};

export default api;

