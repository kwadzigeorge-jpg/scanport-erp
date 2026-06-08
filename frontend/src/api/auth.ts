import client from './client';
import type { User } from '../types';

export const login = (email: string, password: string) =>
  client.post<{ token: string; user: User }>('/auth/login', { email, password }).then((r) => r.data);

export const register = (data: { email: string; password: string; name: string; role?: string }) =>
  client.post<{ user: User }>('/auth/register', data).then((r) => r.data);

export const getMe = () =>
  client.get<{ user: User }>('/auth/me').then((r) => r.data);

export const listUsers = () =>
  client.get<User[]>('/auth/users').then((r) => r.data);

export const deleteUser = (id: string) =>
  client.delete(`/auth/users/${id}`).then((r) => r.data);
