import axios from 'axios';
import type {
  JobsResponse,
  JobWithOutreach,
  Stats,
  IpeStats,
  ScrapeRun,
  Company,
  JobFilters,
  Document,
  Profile,
  ProfileCreate,
  ProfileUpdate,
} from './types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

/* ── Active user tracking ── */

let activeUserId: number | null = null;
export function setActiveUserId(id: number) { activeUserId = id; }
export function getActiveUserId() { return activeUserId; }

api.interceptors.request.use((config) => {
  if (activeUserId) config.headers['X-User-Id'] = String(activeUserId);
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 412 && error.response?.data?.error === 'setup_required') {
      window.location.href = '/#setup';
      return Promise.reject(error);
    }
    const message = error.response?.data?.error || error.message;
    console.error('API Error:', message);
    return Promise.reject(error);
  }
);

/* ── Setup Wizard ── */

export const setupApi = {
  createUser: (data: { name: string; avatarColor: string }) =>
    api.post('/setup/user', data).then(r => r.data),

  setArchetype: (data: { archetype: string; userId: number }) =>
    api.post('/setup/archetype', data).then(r => r.data),

  uploadDocument: (file: File, type: string, userId: number) => {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    form.append('userId', String(userId));
    return api.post('/setup/documents', form).then(r => r.data);
  },

  updateSkills: (data: { userId: number; add?: { category: string; term: string }[]; remove?: { category: string; term: string }[] }) =>
    api.post('/setup/skills', data).then(r => r.data),

  updateProfile: (data: any) =>
    api.post('/setup/profile', data).then(r => r.data),

  loadCompanies: () =>
    api.post('/setup/companies').then(r => r.data),

  complete: (triggerScrape: boolean) =>
    api.post('/setup/complete', { triggerScrape }).then(r => r.data),
};

export const configApi = {
  export: () => api.get('/config/export').then(r => r.data),
  import: (config: any) => api.post('/config/import', config).then(r => r.data),
  importConfirm: (config: any) => api.post('/config/import/confirm', config).then(r => r.data),
};

/* ── Users ── */

export const usersApi = {
  list: () => api.get('/users').then(r => r.data),
  create: (data: { name: string; avatarColor?: string }) => api.post('/users', data).then(r => r.data),
  update: (id: number, data: any) => api.patch(`/users/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/users/${id}`).then(r => r.data),
};

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
  get: (profileId?: number) =>
    api.get<IpeStats & Stats>('/stats', { params: profileId ? { profileId } : undefined }).then(r => r.data),
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

/* ── IPE: Documents ── */

export const documentsApi = {
  list: () => api.get<Document[]>('/documents').then(r => r.data),
  upload: (file: File, type: 'resume' | 'linkedin') => {
    const form = new FormData();
    form.append('file', file);
    form.append('type', type);
    return api.post<Document>('/documents/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data);
  },
  remove: (id: number) => api.delete(`/documents/${id}`).then(r => r.data),
};

/* ── IPE: Profiles ── */

export const profilesApi = {
  list: () => api.get<Profile[]>('/profiles').then(r => r.data),
  get: (id: number) => api.get<Profile>(`/profiles/${id}`).then(r => r.data),
  create: (data: ProfileCreate) => api.post<Profile>('/profiles', data).then(r => r.data),
  update: (id: number, data: ProfileUpdate) => api.patch<Profile>(`/profiles/${id}`, data).then(r => r.data),
  remove: (id: number) => api.delete(`/profiles/${id}`).then(r => r.data),
  autoPopulate: (id: number) => api.post<Profile>(`/profiles/${id}/auto-populate`).then(r => r.data),
};

/* ── IPE: Scoring ── */

export const scoreApi = {
  runIpe: (profileId: number, force = false) => api.post(`/score/ipe/${profileId}${force ? '?force=true' : ''}`).then(r => r.data),
  runAi: (profileId: number) => api.post(`/score/ai/${profileId}`).then(r => r.data),
  runAiSingle: (profileId: number, jobId: number) => api.post(`/score/ai/${profileId}/${jobId}`).then(r => r.data),
  runAll: async (profileId: number) => {
    await api.post(`/score/ipe/${profileId}`);
    return api.post(`/score/ai/${profileId}`).then(r => r.data);
  },
};

/* ── Enrichment ── */

export const enrichApi = {
  trigger: () => api.post('/enrich').then(r => r.data),
  status: () => api.get('/enrich/status').then(r => r.data),
  enrichJob: (jobId: number) => api.post(`/enrich/${jobId}`).then(r => r.data),
};
