import { api, tokenStorage } from './api';
import type { LoginCredentials, TokenResponse, User } from '@/types/auth';

export const authService = {
  login: async (credentials: LoginCredentials): Promise<TokenResponse> => {
    const { data } = await api.post<TokenResponse>('/auth/login', credentials);
    tokenStorage.setTokens(data.access_token, data.refresh_token, credentials.remember_me);
    return data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } finally {
      tokenStorage.clearTokens();
    }
  },

  getCurrentUser: async (): Promise<User> => {
    const { data } = await api.get<User>('/auth/me');
    return data;
  },

  updateProfile: async (payload: {
    full_name: string;
    email: string;
    phone_number: string | null;
    profile_picture: string | null;
  }): Promise<User> => {
    const { data } = await api.patch<User>('/auth/me', payload);
    return data;
  },

  changePassword: async (payload: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }): Promise<{ message: string }> => {
    const { data } = await api.post('/auth/change-password', payload);
    return data;
  },

  forgotPassword: async (identifier: string): Promise<{ message: string }> => {
    const { data } = await api.post('/auth/forgot-password', { identifier });
    return data;
  },

  resetPassword: async (code: string, newPassword: string): Promise<{ message: string }> => {
    const { data } = await api.post('/auth/reset-password', {
      code,
      new_password: newPassword,
    });
    return data;
  },
};
