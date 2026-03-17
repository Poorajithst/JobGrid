import axios from 'axios';
import type {
  JobsResponse,
  JobWithOutreach,
  Stats,
  ScrapeRun,
  Company,
  JobFilters,
} from './types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message;
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

export const jobsApi = {
  list: (filters: JobFilters = {}) =>
    api.get<JobsResponse>('/jobs', { params: filters }).then(r => r.data),

  get: (id: number) =>
    api.get<JobWithOutreach>(`/jobs/${id}`).then(r => r.data),

  updateStatus: (id: number, status: string) =>
    api.patch(`/jobs/${id}/status`, { status }).then(r => r.data),

  updateNotes: (id: number, data: { notes?: string; next_action?: string }) =>
    api.patch(`/jobs/${id}/notes`, data).then(r => r.data),
};

export const outreachApi = {
  generate: (jobId: number, type: 'connection' | 'email' | 'inmail') =>
    api.post(`/outreach/${jobId}`, { type }).then(r => r.data),
};

export const statsApi = {
  get: () => api.get<Stats>('/stats').then(r => r.data),
};

export const scrapeApi = {
  trigger: () => api.post<{ runId: number }>('/scrape').then(r => r.data),
  getRun: (runId: number) => api.get<ScrapeRun>(`/scrape/${runId}`).then(r => r.data),
  getLog: () => api.get<ScrapeRun[]>('/scrape/log').then(r => r.data),
};

export const companiesApi = {
  list: () => api.get<Company[]>('/companies').then(r => r.data),
  add: (data: { name: string; greenhouse_slug?: string; lever_slug?: string }) =>
    api.post('/companies', data).then(r => r.data),
  update: (id: number, data: Partial<Company>) =>
    api.patch(`/companies/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/companies/${id}`).then(r => r.data),
};
