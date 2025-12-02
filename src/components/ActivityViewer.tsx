import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getStorageProvider } from '@/services/storageService';
import type { ActivityRecord, ActivityType } from '@/types';
import { ChatIcon, ImageIcon, VisionIcon, ToolsIcon, StatusIcon, HistoryIcon } from '@/components/Icons';

const typeMeta: Record<ActivityType, { label: string; icon: React.FC<{ className?: string }>; color: string }> = {
  'auth.signup': { label: 'Sign up', icon: StatusIcon, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  'auth.signin': { label: 'Sign in', icon: StatusIcon, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  'chat.message': { label: 'Chat', icon: ChatIcon, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  'image.generate': { label: 'Image', icon: ImageIcon, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  'vision.query': { label: 'Vision', icon: VisionIcon, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  'settings.change': { label: 'Settings', icon: ToolsIcon, color: 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300' },
};

function formatSummary(rec: ActivityRecord): string {
  const d = (rec.data || {}) as Record<string, unknown>;
  switch (rec.type) {
    case 'chat.message': {
      const role = String(d.role || 'user');
      const len = typeof d.length === 'number' ? d.length : undefined;
      const sourcesCount = typeof d.sourcesCount === 'number' ? d.sourcesCount : undefined;
      const model = typeof d.model === 'string' ? d.model : undefined;
      if (role === 'user') {
        return `You sent a message${len ? ` (${len} chars)` : ''}${model ? ` • ${model}` : ''}${d.useWebSearch ? ' • web search' : ''}`;
      }
      if (d.isError) {
        return `Assistant error${model ? ` • ${model}` : ''}${d.error ? ` • ${String(d.error)}` : ''}`;
      }
      return `Assistant replied${len ? ` (${len} chars)` : ''}${sourcesCount ? ` • ${sourcesCount} sources` : ''}${model ? ` • ${model}` : ''}`;
    }
    case 'image.generate': {
      const model = typeof d.model === 'string' ? d.model : undefined;
      const provider = typeof d.provider === 'string' ? d.provider : undefined;
      const ok = d.success !== false;
      return `${ok ? 'Generated' : 'Failed to generate'} image${model ? ` • ${model}` : ''}${provider ? ` • ${provider}` : ''}`;
    }
    case 'vision.query': {
      const ok = d.success !== false;
      return ok ? 'Analyzed image' : 'Vision query failed';
    }
    case 'settings.change': {
      const k = typeof d.key === 'string' ? d.key : undefined;
      return `Changed settings${k ? ` • ${k}` : ''}`;
    }
    case 'auth.signup': {
      const masked = typeof d.maskedEmail === 'string' ? d.maskedEmail : undefined;
      return `Account created${masked ? ` (${masked})` : ''}`;
    }
    case 'auth.signin': {
      const masked = typeof d.maskedEmail === 'string' ? d.maskedEmail : undefined;
      const auto = d.auto ? ' • auto-login' : '';
      return `Signed in${masked ? ` (${masked})` : ''}${auto}`;
    }
    default:
      return rec.type;
  }
}

const ActivityViewer: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = React.useState<ActivityRecord[] | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchActivities = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const provider = await getStorageProvider();
      const list = await provider.listActivities(user.uid, 50);
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  if (!user) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-900/50 rounded-2xl shadow-lg p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <HistoryIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Your Activity</h3>
        </div>
        <button
          onClick={fetchActivities}
          disabled={loading}
          className={`px-3 py-1.5 text-xs font-semibold rounded-full border shadow-sm transition ${loading ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white border-violet-700'}`}
        >{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>
      {error && (
        <div className="p-3 mb-3 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300 text-sm" role="alert">
          {error}
        </div>
      )}
      {items == null && (
        <div className="text-sm text-slate-500 dark:text-slate-400">Loading…</div>
      )}
      {items && items.length === 0 && !error && (
        <div className="text-sm text-slate-500 dark:text-slate-400">No activity yet. Your recent chat messages, image generations, and more will appear here.</div>
      )}
      {items && items.length > 0 && (
        <ul className="divide-y divide-slate-200 dark:divide-slate-700/50">
          {items.map((rec) => {
            const m = typeMeta[rec.type];
            const Icon = m?.icon || StatusIcon;
            const ts = new Date(rec.timestamp);
            return (
              <li key={(rec.id || rec.timestamp) + rec.type} className="py-3 flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m?.color || 'bg-slate-200 text-slate-700 dark:bg-slate-700/60 dark:text-slate-300'}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-800 dark:text-slate-200">{formatSummary(rec)}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{ts.toLocaleString()}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ActivityViewer;
