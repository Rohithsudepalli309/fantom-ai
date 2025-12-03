import { type Feature } from '@/types';
import { TextIcon, ChatIcon, ImageIcon, VisionIcon, StatusIcon, ToolsIcon, HistoryIcon } from '@/components/Icons';

export const FEATURES: Record<Feature, { id: Feature; name: string; icon: React.FC<{ className?: string }>; description?: string }> = {
  text: { id: 'text', name: 'Text Generation', icon: TextIcon, description: 'Generate high-quality text for any purpose. From creative writing to technical documentation.' },
  chat: { id: 'chat', name: 'Chat', icon: ChatIcon, description: 'Experience intelligent conversations powered by advanced AI. Ask questions, get advice, and explore ideas.' },
  image: { id: 'image', name: 'Image Generation', icon: ImageIcon, description: 'Create stunning visuals from text. Powered by advanced diffusion models.' },
  vision: { id: 'vision', name: 'Vision', icon: VisionIcon, description: 'Analyze and understand images with state-of-the-art vision models. Upload images for instant insights.' },
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
