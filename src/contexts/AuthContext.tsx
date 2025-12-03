import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { recordActivitySafe } from '@/services/storageService';
import { authenticatedFetch } from '@/lib/api';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

type AuthUser = {
  uid: string;
  email: string;
  displayName?: string | null;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Lightweight, client-side only mock provider with hashed password storage for development.
// For production, configure Firebase (VITE_FIREBASE_*) and replace with a server-backed session.
async function sha256(input: string): Promise<string> {
  if (window.crypto?.subtle) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
    const arr = Array.from(new Uint8Array(buf));
    return arr.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback (not cryptographically strong, dev only)
  let h = 0; for (let i = 0; i < input.length; i++) { h = (h << 5) - h + input.charCodeAt(i); h |= 0; }
  return String(h >>> 0);
}

type LocalUserRecord = { email: string; salt: string; hash: string; uid: string };

function getUserStore(): LocalUserRecord[] {
  try { return JSON.parse(localStorage.getItem('auth_users') || '[]'); } catch { return []; }
}
function setUserStore(users: LocalUserRecord[]) {
  localStorage.setItem('auth_users', JSON.stringify(users));
}

async function localSignUp(email: string, password: string): Promise<string> {
  const users = getUserStore();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) throw new Error('An account with this email already exists.');
  const salt = Math.random().toString(36).slice(2);
  const hash = await sha256(password + ':' + salt);
  const uid = 'local_' + Math.random().toString(36).slice(2);
  users.push({ email, salt, hash, uid });
  setUserStore(users);
  return uid;
}

async function localSignIn(email: string, password: string) {
  const users = getUserStore();
  const rec = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!rec) throw new Error('Invalid email or password.');
  const actual = await sha256(password + ':' + rec.salt);
  if (actual !== rec.hash) throw new Error('Invalid email or password.');
  localStorage.setItem('auth_session', JSON.stringify({ uid: rec.uid, email: rec.email }));
}

async function localSignOut() {
  localStorage.removeItem('auth_session');
}

function getSession(): AuthUser | null {
  try {
    const s = JSON.parse(localStorage.getItem('auth_session') || 'null');
    return s ? { uid: s.uid, email: s.email } : null;
  } catch { return null; }
}

// --- Backend abstraction for auth (server-ready) ---
type AuthBackend = {
  signUp: (email: string, password: string) => Promise<{ uid: string }>;
  signIn: (email: string, password: string) => Promise<{ uid: string; email: string }>;
  signOut: () => Promise<void>;
  getSession: () => AuthUser | null;
};

function getBackend(): AuthBackend {
  // Helper to read env
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envAny = import.meta as any;
  const getEnv = (k: string) => envAny?.env?.[k] || import.meta.env[k];
  const providerRaw = 'jwt'; // FORCE JWT FOR DEBUGGING
  const hasSupabase = !!(getEnv('VITE_SUPABASE_URL') && getEnv('VITE_SUPABASE_ANON_KEY'));
  const hasFirebase = !!(getEnv('VITE_FIREBASE_API_KEY') && getEnv('VITE_FIREBASE_AUTH_DOMAIN') && getEnv('VITE_FIREBASE_PROJECT_ID') && getEnv('VITE_FIREBASE_APP_ID'));
  const provider = 'jwt'; // FORCE JWT

  console.log(`[AuthContext] ProviderRaw: ${providerRaw}, Selected: ${provider}`);

  // Local backend (default)
  const localBackend: AuthBackend = {
    async signUp(email: string, password: string) {
      const uid = await localSignUp(email, password);
      return { uid };
    },
    async signIn(email: string, password: string) {
      await localSignIn(email, password);
      const s = getSession();
      if (!s) throw new Error('Failed to establish session.');
      return { uid: s.uid, email: s.email };
    },
    async signOut() {
      await localSignOut();
    },
    getSession,
  };

  if (provider === 'supabase') {
    const url = getEnv('VITE_SUPABASE_URL');
    const anon = getEnv('VITE_SUPABASE_ANON_KEY');
    if (url && anon) {
      let supabase: SupabaseClient | null = null;
      const ensure = (): SupabaseClient => {
        if (!supabase) supabase = createClient(url, anon, { auth: { persistSession: true } });
        return supabase;
      };
      const supabaseBackend: AuthBackend = {
        async signUp(email: string, password: string) {
          const client = ensure();
          const { data, error } = await client.auth.signUp({ email, password });
          if (error) throw new Error(error.message);
          const uid = data.user?.id || 'sb_' + Math.random().toString(36).slice(2);
          // Do not set local session here; higher layer decides whether to auto-login
          return { uid };
        },
        async signIn(email: string, password: string) {
          const client = ensure();
          const { data, error } = await client.auth.signInWithPassword({ email, password });
          if (error) throw new Error(error.message);
          const uid = data.user?.id;
          if (!uid) throw new Error('Sign-in succeeded but no user id');
          // Mirror a minimal session for our AuthGate
          localStorage.setItem('auth_session', JSON.stringify({ uid, email }));
          return { uid, email };
        },
        async signOut() {
          const client = ensure();
          await client.auth.signOut();
          localStorage.removeItem('auth_session');
        },
        getSession,
      };
      return supabaseBackend;
    }
  }

  if (provider === 'firebase') {
    const apiKey = getEnv('VITE_FIREBASE_API_KEY');
    const authDomain = getEnv('VITE_FIREBASE_AUTH_DOMAIN');
    const projectId = getEnv('VITE_FIREBASE_PROJECT_ID');
    const appId = getEnv('VITE_FIREBASE_APP_ID');
    if (apiKey && authDomain && projectId && appId) {
      let initialized = false;
      async function ensureAuth() {
        // Build module ids dynamically so Vite won't try to resolve them unless provider=firebase
        const fbAppId = 'firebase' + '/app';
        const fbAuthId = 'firebase' + '/auth';
        // @vite-ignore ensures no pre-bundle attempt; dynamic ids avoid static resolution
        const appMod: any = await import(/* @vite-ignore */ fbAppId);
        const authMod: any = await import(/* @vite-ignore */ fbAuthId);
        if (!initialized) {
          if (appMod.getApps().length === 0) {
            appMod.initializeApp({ apiKey, authDomain, projectId, appId });
          }
          const auth = authMod.getAuth();
          await authMod.setPersistence(auth, authMod.browserLocalPersistence);
          initialized = true;
        }
        return {
          appMod,
          authMod,
          auth: authMod.getAuth(),
        };
      }
      const firebaseBackend: AuthBackend = {
        async signUp(email: string, password: string) {
          const { authMod, auth } = await ensureAuth();
          const cred = await authMod.createUserWithEmailAndPassword(auth, email, password);
          const uid = cred.user?.uid || 'fb_' + Math.random().toString(36).slice(2);
          return { uid };
        },
        async signIn(email: string, password: string) {
          const { authMod, auth } = await ensureAuth();
          const cred = await authMod.signInWithEmailAndPassword(auth, email, password);
          const uid = cred.user?.uid;
          if (!uid) throw new Error('Sign-in succeeded but no user id');
          localStorage.setItem('auth_session', JSON.stringify({ uid, email }));
          return { uid, email };
        },
        async signOut() {
          const { authMod, auth } = await ensureAuth();
          await authMod.signOut(auth);
          localStorage.removeItem('auth_session');
        },
        getSession,
      };
      return firebaseBackend;
    }
  }

  if (provider === 'jwt') {
    const jwtBackend: AuthBackend = {
      async signUp(email: string, password: string) {
        const resp = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(data?.error || `Signup failed (${resp.status})`);
        }
        // Server returns { insertedId }
        return { uid: data.insertedId || 'jwt_' + Math.random().toString(36).slice(2) };
      },
      async signIn(email: string, password: string) {
        const resp = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(data?.error || `Login failed (${resp.status})`);
        }
        // Server returns { token }
        const token = data.token;
        if (!token) throw new Error('No token received');

        // We need to get the user details (uid, email)
        // We can decode the token or fetch profile
        // For now, let's fetch profile to get email
        const profileResp = await fetch('/api/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const profile = await profileResp.json();

        // Store token in localStorage (AuthContext usually manages session, but we need to store the token for requests)
        // The current AuthContext uses 'auth_session' for user info. 
        // We should probably store the token separately or include it in auth_session.
        // For simplicity, let's store it in a separate key 'auth_token'
        console.log('Login successful. Storing token in localStorage:', token.substring(0, 20) + '...');
        localStorage.setItem('auth_token', token);

        const uid = profile.id || 'jwt_' + Math.random().toString(36).slice(2); // Profile might not return ID, use fallback or decode token
        const userEmail = profile.email || email;

        localStorage.setItem('auth_session', JSON.stringify({ uid, email: userEmail }));
        return { uid, email: userEmail };
      },
      async signOut() {
        // Client-side only
        localStorage.removeItem('auth_session');
        localStorage.removeItem('auth_token');
      },
      getSession,
    };
    return jwtBackend;
  }

  return localBackend;
}

// --- Login throttle/lockout helpers (client-side) ---
type FailInfo = { count: number; lockUntil?: number };
function getFailKey(email: string) { return `auth_fail_${email.toLowerCase()}`; }
function getFailInfo(email: string): FailInfo {
  try { return JSON.parse(localStorage.getItem(getFailKey(email)) || '{"count":0}'); } catch { return { count: 0 }; }
}
function setFailInfo(email: string, info: FailInfo) { localStorage.setItem(getFailKey(email), JSON.stringify(info)); }
function clearFailInfo(email: string) { localStorage.removeItem(getFailKey(email)); }
function getRemainingLockSeconds(email: string): number {
  const info = getFailInfo(email);
  const now = Date.now();
  if (info.lockUntil && info.lockUntil > now) return Math.ceil((info.lockUntil - now) / 1000);
  return 0;
}
function registerFailedAttempt(email: string) {
  const info = getFailInfo(email);
  const count = (info.count || 0) + 1;
  let lockUntil: number | undefined = info.lockUntil;
  if (count >= 3) {
    // Exponential backoff: 10s, 20s, 40s... capped at 300s
    const step = count - 2;
    const delaySec = Math.min(300, 10 * Math.pow(2, step - 1));
    lockUntil = Date.now() + delaySec * 1000;
  }
  setFailInfo(email, { count, lockUntil });
  return getRemainingLockSeconds(email);
}
function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length <= 2) return `${local[0] || ''}***@${domain}`;
  const first = local[0];
  const last = local[local.length - 1];
  return `${first}${'*'.repeat(Math.max(1, local.length - 2))}${last}@${domain}`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const envAny = import.meta as any;
  const allowSignup = (envAny?.env?.VITE_AUTH_ALLOW_SIGNUP ?? 'true') !== 'false';
  const idleMinutes = Number(envAny?.env?.VITE_AUTH_IDLE_TIMEOUT_MIN || '');

  useEffect(() => {
    const handleUnauthorized = () => {
      console.log('Session expired or invalid token. Logging out...');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_session');
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  // Attempt to load session on mount
  useEffect(() => {
    const s = getSession();
    setUser(s);
    setLoading(false);
    // Sync with JWT backend cookie session if configured
    try {
      const envAny = import.meta as any;
      const providerRaw = String(envAny?.env?.VITE_AUTH_PROVIDER || 'auto').toLowerCase();
      if (providerRaw === 'jwt') {
        const checkAuth = async () => {
          try {
            const token = localStorage.getItem('auth_token');
            if (!token) return;

            console.log('Found persisted token in localStorage, validating...');

            const r = await authenticatedFetch('/api/profile', {
              method: 'GET'
            });

            if (!r.ok) {
              // Token invalid or expired
              // The authenticatedFetch helper will dispatch the event, but we handle it here too for initial load
              localStorage.removeItem('auth_token');
              localStorage.removeItem('auth_session');
              setUser(null);
              return;
            }

            const d = await r.json();
            if (d?.email) {
              const sess = { uid: d.id || 'jwt_user', email: d.email };
              localStorage.setItem('auth_session', JSON.stringify(sess));
              setUser({ uid: sess.uid, email: sess.email });
            }
          } catch { /* ignore */ }
        };
        checkAuth();
      }
    } catch { /* ignore */ }
  }, []);

  // Optional inactivity sign-out
  useEffect(() => {
    if (!idleMinutes || isNaN(idleMinutes) || idleMinutes <= 0) return;
    let last = Date.now();
    const onAny = () => { last = Date.now(); };
    const handler = setInterval(async () => {
      if (!user) return; // only when signed in
      const diffMin = (Date.now() - last) / 60000;
      if (diffMin >= idleMinutes) {
        try { await getBackend().signOut(); } catch { }
        setUser(null);
      }
    }, 30_000);
    window.addEventListener('mousemove', onAny, { passive: true });
    window.addEventListener('keydown', onAny, { passive: true });
    window.addEventListener('click', onAny, { passive: true });
    return () => {
      clearInterval(handler);
      window.removeEventListener('mousemove', onAny);
      window.removeEventListener('keydown', onAny);
      window.removeEventListener('click', onAny);
    };
  }, [user, idleMinutes]);

  const value: AuthContextType = {
    user,
    loading,
    signIn: async (email: string, password: string) => {
      // Try firebase if configured (dynamic import), else local
      // Firebase path skipped (module not guaranteed). For production integrate server auth here.
      const remain = getRemainingLockSeconds(email);
      if (remain > 0) {
        throw new Error(`Too many failed attempts. Try again in ${remain}s.`);
      }
      try {
        const backend = getBackend();
        await backend.signIn(email, password);
      } catch (e) {
        const wait = registerFailedAttempt(email);
        if (wait > 0) throw new Error(`Too many failed attempts. Try again in ${wait}s.`);
        throw e as Error;
      }
      clearFailInfo(email);
      const s = getBackend().getSession();
      setUser(s);
      if (s) {
        await recordActivitySafe(s.uid, 'auth.signin', { method: 'local', maskedEmail: maskEmail(email) });
      }
    },
    signUp: async (email: string, password: string) => {
      if (!allowSignup) {
        throw new Error('Signups are disabled. Contact administrator.');
      }
      const env = import.meta as any;
      const hasFirebase = !!env?.env?.VITE_FIREBASE_API_KEY;
      const requireLoginAfterSignup = env?.env?.VITE_REQUIRE_LOGIN_AFTER_SIGNUP !== 'false';
      // Firebase path skipped. Use local mock.
      const backend = getBackend();
      const { uid: newUid } = await backend.signUp(email, password);
      try {
        const emailHash = await sha256(email.toLowerCase());
        await recordActivitySafe(newUid, 'auth.signup', { method: 'local', emailHash, maskedEmail: maskEmail(email) });
      } catch { }
      if (requireLoginAfterSignup) {
        // Do not auto-login after signup. Ensure any stray session is cleared.
        await getBackend().signOut();
        setUser(null);
      } else {
        // Auto-login path for experimentation
        await backend.signIn(email, password);
        clearFailInfo(email);
        const s = getBackend().getSession();
        setUser(s);
        if (s) {
          await recordActivitySafe(s.uid, 'auth.signin', { method: 'local', auto: true, maskedEmail: maskEmail(email) });
        }
      }
    },
    signOut: async () => {
      const env = import.meta as any;
      const hasFirebase = !!env?.env?.VITE_FIREBASE_API_KEY;
      // Firebase path skipped.
      await getBackend().signOut();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) return { user: null, loading: true, signIn: async () => { }, signUp: async () => { }, signOut: async () => { } };
  return ctx as AuthContextType;
}
