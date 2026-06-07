import { api } from '@/services/api';
import type { User } from '@/types/auth';
import type {
  ActivityItem,
  DashboardStats,
  Department,
  DocumentItem,
  DownloadHistoryItem,
  Paginated,
  SettingsOverview,
} from '@/types/docvault';

export const docvaultService = {
  dashboard: async () => (await api.get<DashboardStats>('/dashboard')).data,
  departments: async () => (await api.get<Department[]>('/departments')).data,
  documents: async (params: Record<string, string | number | undefined>) =>
    (await api.get<Paginated<DocumentItem>>('/documents', { params })).data,
  uploadDocument: async (formData: FormData) =>
    (await api.post<DocumentItem>('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })).data,
  deleteDocument: async (id: string) => (await api.delete(`/documents/${id}`)).data,
  history: async (params: Record<string, string | number | undefined>) =>
    (await api.get<Paginated<DownloadHistoryItem>>('/history', { params })).data,
  clearHistory: async () => (await api.delete('/history')).data,
  activity: async (params: Record<string, string | number | undefined>) =>
    (await api.get<Paginated<ActivityItem>>('/activity', { params })).data,
  users: async (search?: string) => (await api.get<User[]>('/users', { params: { search } })).data,
  createUser: async (payload: Record<string, unknown>) => (await api.post<User>('/users', payload)).data,
  updateUser: async (id: string, payload: Record<string, unknown>) => (await api.patch<User>(`/users/${id}`, payload)).data,
  deleteUser: async (id: string) => (await api.delete(`/users/${id}`)).data,
  createDepartment: async (payload: Pick<Department, 'name' | 'description'>) =>
    (await api.post<Department>('/departments', payload)).data,
  updateDepartment: async (id: string, payload: Partial<Pick<Department, 'name' | 'description'>>) =>
    (await api.patch<Department>(`/departments/${id}`, payload)).data,
  deleteDepartment: async (id: string) => (await api.delete(`/departments/${id}`)).data,
  settingsOverview: async () => (await api.get<SettingsOverview>('/settings/overview')).data,
};

export const fileUrl = (path: string) => `${api.defaults.baseURL}${path}`;

export function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function parseApiDate(value: string) {
  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

export function formatDateTime(value: string) {
  return parseApiDate(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(value: string) {
  return parseApiDate(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
