import { type Feature } from '@/types';
import { TextIcon, ChatIcon, ImageIcon, VisionIcon, StatusIcon, ToolsIcon, HistoryIcon } from '@/components/Icons';

export const FEATURES: Record<Feature, { id: Feature; name: string; icon: React.FC<{ className?: string }>; description?: string }> = {
  text: { id: 'text', name: 'Text Generation', icon: TextIcon, description: 'Turn your ideas into text with a simple prompt.' },
  chat: { id: 'chat', name: 'Chat', icon: ChatIcon, description: 'Have a conversation with the AI.' },
  image: { id: 'image', name: 'Image Generation', icon: ImageIcon, description: 'Create stunning visuals from text.' },
  vision: { id: 'vision', name: 'Vision', icon: VisionIcon, description: 'Ask questions about your images.' },
  status: { id: 'status', name: 'System Status', icon: StatusIcon },
  settings: { id: 'settings', name: 'Settings', icon: ToolsIcon, description: 'Configure keys and feature behavior.' },
  activity: { id: 'activity', name: 'Activity', icon: HistoryIcon, description: 'View your recent app activity.' },
  profile: { id: 'profile', name: 'Profile', icon: ToolsIcon, description: 'Manage your account and session.' },
};

// Feature groupings used across the app
export const MAIN_FEATURES: Feature[] = ['text', 'chat', 'image', 'vision'];
// Sidebar navigation order (top section). Settings moved to footer to appear after System Status.
export const SIDEBAR_NAV: Feature[] = ['text', 'chat', 'image', 'vision'];
export const SIDEBAR_FOOTER: Feature[] = ['status', 'settings', 'profile'];
