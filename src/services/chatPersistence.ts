import { ChatMessage } from '@/types';

export interface ChatPersistence {
    saveHistory: (userId: string, messages: ChatMessage[]) => Promise<void>;
    loadHistory: (userId: string) => Promise<ChatMessage[]>;
    clearHistory: (userId: string) => Promise<void>;
}

let _persistence: ChatPersistence | null = null;

function getEnv(name: string): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const envAny = import.meta as any;
    return envAny?.env?.[name];
}

async function createSupabasePersistence(): Promise<ChatPersistence> {
    const url = getEnv('VITE_SUPABASE_URL');
    const anon = getEnv('VITE_SUPABASE_ANON_KEY');
    if (!url || !anon) throw new Error('Supabase env not configured');
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(url, anon, { auth: { persistSession: false } });

    return {
        async saveHistory(userId: string, messages: ChatMessage[]) {
            // Upsert into chat_history table. Assumes table exists:
            // create table chat_history (user_id text primary key, messages jsonb, updated_at timestamptz default now());
            const { error } = await supabase
                .from('chat_history')
                .upsert({ user_id: userId, messages, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });

            if (error) throw new Error(error.message);
        },
        async loadHistory(userId: string) {
            const { data, error } = await supabase
                .from('chat_history')
                .select('messages')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
                console.warn('Supabase load error:', error);
            }
            return data?.messages || [];
        },
        async clearHistory(userId: string) {
            const { error } = await supabase
                .from('chat_history')
                .delete()
                .eq('user_id', userId);
            if (error) throw new Error(error.message);
        }
    };
}

function createLocalPersistence(): ChatPersistence {
    const KEY = 'chatHistory_v2';
    return {
        async saveHistory(userId: string, messages: ChatMessage[]) {
            localStorage.setItem(KEY, JSON.stringify(messages));
        },
        async loadHistory(userId: string) {
            const stored = localStorage.getItem(KEY);
            return stored ? JSON.parse(stored) : [];
        },
        async clearHistory(userId: string) {
            localStorage.removeItem(KEY);
        }
    };
}

export async function getChatPersistence(): Promise<ChatPersistence> {
    if (_persistence) return _persistence;
    try {
        _persistence = await createSupabasePersistence();
    } catch {
        _persistence = createLocalPersistence();
    }
    return _persistence;
}
