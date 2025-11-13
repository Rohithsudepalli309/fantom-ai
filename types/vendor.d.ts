declare module 'firebase/app' {
  export const initializeApp: any;
  export const getApps: any;
}

declare module 'firebase/auth' {
  export const getAuth: any;
  export const setPersistence: any;
  export const browserLocalPersistence: any;
  export const createUserWithEmailAndPassword: any;
  export const signInWithEmailAndPassword: any;
  export const signOut: any;
}

// Minimal shims to prevent editor-types errors before dependencies are installed
declare module '@google/genai' {
  export type GenerateContentResponse = any;
  export type Modality = any;
  export class GoogleGenAI {
    constructor(opts: any);
    models: any;
    chats: any;
  }
}

declare module 'react-dom/client' {
  const createRoot: (container: any) => { render: (el: any) => void };
  export default { createRoot } as any;
}

declare module '@supabase/supabase-js' {
  export type SupabaseClient = any;
  export function createClient(url: string, key: string, options?: any): SupabaseClient;
}

// Toast system ambient types (lightweight for our simplified react type stubs)
declare module '@/components/Toaster' {
  import type React from 'react';
  export type ToastVariant = 'info' | 'success' | 'error';
  export interface ToastOptions { title?: string; message: string; variant?: ToastVariant; duration?: number }
  export interface ToastContextType { show: (opts: ToastOptions) => string; dismiss: (id: string) => void }
  export const ToastProvider: React.FC<{ children: React.ReactNode }>;
  export function useToast(): ToastContextType;
}
