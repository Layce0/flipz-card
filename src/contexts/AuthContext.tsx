import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import {
  hydrateSessionFromNativeStorage,
  markAuthBootstrapReady,
  syncSessionToNativeStorage,
} from '@/lib/capacitorSession';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isModerator: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check admin status from database
  const checkRoles = async (userId: string) => {
    try {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      setIsAdmin(roleData?.some(r => r.role === 'admin') ?? false);
      setIsModerator(roleData?.some(r => r.role === 'moderator' || r.role === 'admin') ?? false);
    } catch {
      setIsAdmin(false);
      setIsModerator(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const initializeAuth = async () => {
      try {
        await hydrateSessionFromNativeStorage();

        // Set up auth state listener FIRST
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          (_event, nextSession) => {
            if (!isMounted) return;

            setSession(nextSession);
            setUser(nextSession?.user ?? null);
            void syncSessionToNativeStorage(nextSession);

            // Check admin status from database
            if (nextSession?.user) {
              // Defer to avoid potential deadlocks with Supabase client
              // Keep loading until roles are known so admin guards don't redirect early
              setTimeout(() => {
                void checkRoles(nextSession.user.id).finally(() => {
                  if (!isMounted) return;
                  markAuthBootstrapReady();
                  setIsLoading(false);
                });
              }, 0);
            } else {
              setIsAdmin(false);
              setIsModerator(false);
              markAuthBootstrapReady();
              setIsLoading(false);
            }
          }
        );

        authSubscription = subscription;

        // THEN check for existing session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!isMounted) return;

        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        void syncSessionToNativeStorage(initialSession);

        if (initialSession?.user) {
          // Await roles so route guards don't redirect before admin status is known
          await checkRoles(initialSession.user.id);
        } else {
          setIsAdmin(false);
          setIsModerator(false);
        }
      } catch {
        // fall through
      } finally {
        markAuthBootstrapReady();
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initializeAuth();

    return () => {
      isMounted = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isAdmin, isModerator, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
