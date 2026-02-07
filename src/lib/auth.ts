import { supabase } from '@/integrations/supabase/client';

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  avatar_url?: string;
  created_at?: string;
}

export interface AuthResponse {
  user: User | null;
  token: string | null;
  error: string | null;
}

export async function signUp(email: string, password: string, fullName?: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      return { user: null, token: null, error: error.message };
    }

    if (!data.user) {
      return { user: null, token: null, error: 'Failed to create account' };
    }

    const token = data.session?.access_token || null;
    const user: User = {
      id: data.user.id,
      email: data.user.email || '',
      full_name: fullName,
      created_at: data.user.created_at,
    };

    return { user, token, error: null };
  } catch (error) {
    console.error('Sign up error:', error);
    return { user: null, token: null, error: 'Failed to create account' };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { user: null, token: null, error: error.message };
    }

    if (!data.user || !data.session) {
      return { user: null, token: null, error: 'Invalid credentials' };
    }

    const user: User = {
      id: data.user.id,
      email: data.user.email || '',
      full_name: data.user.user_metadata?.full_name,
      created_at: data.user.created_at,
    };

    return { user, token: data.session.access_token, error: null };
  } catch (error) {
    console.error('Sign in error:', error);
    return { user: null, token: null, error: 'Failed to sign in' };
  }
}

export async function verifyToken(token: string): Promise<User | null> {
  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email || '',
      full_name: data.user.user_metadata?.full_name,
      created_at: data.user.created_at,
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, created_at')
      .eq('id', userId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      email: data.email || '',
      full_name: data.full_name,
      created_at: data.created_at,
    };
  } catch (error) {
    console.error('Get user error:', error);
    return null;
  }
}

export function getStoredToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setStoredToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

export function removeStoredToken(): void {
  localStorage.removeItem('auth_token');
}
