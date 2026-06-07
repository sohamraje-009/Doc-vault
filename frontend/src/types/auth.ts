export interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: 'admin' | 'employee';
  status: 'active' | 'inactive';
  department_id: string | null;
  department_name: string | null;
  phone_number: string | null;
  profile_picture: string | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
  remember_me: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
