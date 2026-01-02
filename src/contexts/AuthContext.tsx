import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  roles: string[];
  refreshRoles: (userId?: string) => Promise<string[]>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);

  const fetchRoles = async (userId?: string): Promise<string[]> => {
    try {
      const id = userId || user?.id;
      if (!id) {
        setRoles([]);
        return [];
      }
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', id);
      if (error) {
        console.warn('Warning fetching roles:', error.message);
        // Keep existing roles on error instead of clearing them
        return roles;
      }
      const loadedRoles = data?.map((r: any) => r.role) || [];
      setRoles(loadedRoles);
      return loadedRoles;
    } catch (err) {
      console.warn('Warning fetching roles:', err);
      // Keep existing roles on error instead of clearing them
      return roles;
    }
  };

  const refreshRoles = async (userId?: string): Promise<string[]> => {
    return await fetchRoles(userId);
  };

  useEffect(() => {
    const checkUserStatus = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('employment_status')
          .eq('id', userId)
          .single();

        if (error) {
          console.warn('Warning checking user status:', error.message);
          // If we can't determine status, assume active to avoid blocking
          return true;
        }

        if (data?.employment_status === 'inativo') {
          try {
            await supabase.auth.signOut();
          } catch (err) {
            console.warn('Warning signing out inactive user:', err);
          }
          return false;
        }
        return true;
      } catch (err) {
        console.warn('Warning checking user status:', err);
        // Don't crash on network errors, assume user is still valid
        return true;
      }
    };

    // Set up auth state listener FIRST
    const onAuth = (event: string, session: any) => {
      // Only synchronous state updates here
      setSession(session);
      setUser(session?.user ?? null);

      // Defer Supabase calls with setTimeout to prevent deadlock
      if (session?.user) {
        setTimeout(() => {
          checkUserStatus(session.user.id)
            .then((isActive) => {
              if (!isActive) {
                setSession(null);
                setUser(null);
                setRoles([]);
              } else {
                fetchRoles(session.user.id);
              }
            })
            .catch((err) => {
              console.warn('Warning checking user status:', err);
              // Don't clear session on network errors
            });
        }, 0);
      } else {
        setRoles([]);
      }

      setIsLoading(false);
    };

    let subscription: any;
    try {
      const { data } = supabase.auth.onAuthStateChange(onAuth);
      subscription = data?.subscription;
    } catch (err) {
      console.warn('Warning setting up auth listener:', err);
    }

    // THEN check for existing session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer Supabase calls with setTimeout to prevent deadlock
        if (session?.user) {
          setTimeout(() => {
            checkUserStatus(session.user.id)
              .then((isActive) => {
                if (!isActive) {
                  setSession(null);
                  setUser(null);
                  setRoles([]);
                } else {
                  fetchRoles(session.user.id);
                }
              })
              .catch((err) => {
                console.warn('Warning checking user status:', err);
                // Don't clear session on network errors
              })
              .finally(() => {
                setIsLoading(false);
              });
          }, 0);
        } else {
          setRoles([]);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Warning getting session:', err);
        // On fetch error, allow user to see the app but not authenticated
        // They can try refreshing the page later
        setIsLoading(false);
      });

    return () => {
      try {
        subscription?.unsubscribe?.();
      } catch (err) {
        console.warn('Warning unsubscribing from auth changes:', err);
      }
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Warning signing out:', err);
      // Even if signOut fails (network error), clear local state
    } finally {
      // Always clear local state regardless of signOut result
      setUser(null);
      setSession(null);
      setRoles([]);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, roles, refreshRoles, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
