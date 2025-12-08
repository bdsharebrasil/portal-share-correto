import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://jilmlmdgeyzubylncpjy.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppbG1sbWRnZXl6dWJ5bG5jcGp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MjUxOTAsImV4cCI6MjA3NzUwMTE5MH0.YBh3If3-sKSJfALTOL3illiIT4BboOlCGrRqJcFeXY0";

// Create the base client
const baseClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Export a more permissive client to avoid type errors with strict Supabase types
export const supabase = baseClient as any;
