export interface Department {
  id: string;
  name: string;
  description: string | null;
  total_documents?: number;
  total_users?: number;
  total_downloads?: number;
}

export interface DocumentItem {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  department_id: string;
  department_name: string;
  uploaded_by_id: string | null;
  uploaded_by_name: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface DownloadHistoryItem {
  id: string;
  user_name: string | null;
  document_name: string;
  department_name: string | null;
  ip_address: string | null;
  downloaded_at: string;
}

export interface ActivityItem {
  id: string;
  user_name: string | null;
  action: string;
  entity_type: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_documents: number;
  total_downloads: number;
  total_departments: number;
  total_users: number;
  documents_by_department: Array<{ name: string; value: number }>;
  monthly_uploads: Array<{ month: string; value: number }>;
  monthly_downloads: Array<{ month: string; value: number }>;
  recent_activity: ActivityItem[];
  recent_uploads: DocumentItem[];
  recent_downloads: DownloadHistoryItem[];
}

export interface SettingsOverview {
  security: {
    account_status: string;
    role: string;
    last_login_time: string | null;
    authentication_method: string;
    active_session_count: number;
  };
  sessions: Array<{
    id: string;
    device: string;
    browser: string;
    last_active: string | null;
  }>;
  system: {
    application_version: string;
    fastapi_version: string;
    database_type: string;
    environment: string;
    docker_status: string;
  };
  storage: {
    total_documents: number;
    total_downloads: number;
    total_users: number;
    storage_usage: number;
  };
  activity: ActivityItem[];
}
