import { ActivityRecord } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

// Storage provider that supports per-user activity logs with a secure remote option (Supabase) and a local fallback.
// Remote (preferred): Supabase with RLS policies (see notes below).
// Fallback: localStorage per-user namespace (dev only; not suitable for sensitive data).

export type StorageProvider = {
  recordActivity: (rec: ActivityRecord) => Promise<void>;
  listActivities: (userId: string, limit?: number) => Promise<ActivityRecord[]>;
};

let _provider: StorageProvider | null = null;

function getEnv(name: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const envAny = import.meta as any;
  return envAny?.env?.[name];
}

async function createSupabaseProvider(): Promise<StorageProvider> {
  const url = getEnv('VITE_SUPABASE_URL');
  const anon = getEnv('VITE_SUPABASE_ANON_KEY');
  if (!url || !anon) throw new Error('Supabase env not configured');
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, anon, { auth: { persistSession: false } });

  return {
    async recordActivity(rec: ActivityRecord) {
      const { error } = await supabase.from('activities').insert({
        user_id: rec.userId,
        type: rec.type,
        timestamp: rec.timestamp,
        data: rec.data ?? null,
      });
      if (error) throw new Error(error.message);
    },
    async listActivities(userId: string, limit = 50) {
      const { data, error } = await supabase
        .from('activities')
        .select('id,user_id,type,timestamp,data')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return (data || []).map((r: any) => ({ id: String(r.id), userId: r.user_id, type: r.type, timestamp: r.timestamp, data: r.data ?? undefined }));
    }
  };
}

function createLocalProvider(): StorageProvider {
  function key(userId: string) { return `activities_v1_${userId}`; }
  return {
    async recordActivity(rec) {
      try {
        const arr = JSON.parse(localStorage.getItem(key(rec.userId)) || '[]');
        arr.unshift(rec);
        localStorage.setItem(key(rec.userId), JSON.stringify(arr.slice(0, 200)));
      } catch (e) {
        console.warn('Local activity record failed', e);
      }
    },
    async listActivities(userId, limit = 50) {
      try {
        const arr = JSON.parse(localStorage.getItem(key(userId)) || '[]');
        return arr.slice(0, limit);
      } catch {
        return [];
      }
    }
  };
}

export async function getStorageProvider(): Promise<StorageProvider> {
  if (_provider) return _provider;
  try {
    _provider = await createSupabaseProvider();
  } catch {
    _provider = createLocalProvider();
  }
  return _provider;
}

// Convenience hooks/utilities for components
export async function recordActivitySafe(userId: string, type: ActivityRecord['type'], data?: Record<string, unknown>) {
  try {
    const provider = await getStorageProvider();
    await provider.recordActivity({ userId, type, timestamp: new Date().toISOString(), data });
  } catch (e) {
    console.warn('recordActivitySafe failed:', e);
  }
}

// RLS (Supabase) suggested schema:
// create table if not exists public.activities (
//   id bigserial primary key,
//   user_id text not null,
//   type text not null,
//   timestamp timestamptz not null default now(),
//   data jsonb
// );
// alter table public.activities enable row level security;
// create policy "Users can manage own activities" on public.activities
//   for all using (auth.jwt() ->> 'sub' = user_id) with check (auth.jwt() ->> 'sub' = user_id);
