declare module 'react' {
  export function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  export function useRef<T>(initialValue: T): { current: T };
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  export function useMemo<T>(factory: () => T, deps: any[]): T;
  export function useContext<T>(context: any): T;
  export function useReducer<R, I>(reducer: (state: R, action: any) => R, initialArg: I, init?: (arg: I) => R): [R, (action: any) => void];
  export function createContext<T>(defaultValue: T): any;
  export function createElement(type: any, props?: any, ...children: any[]): any;
  export const Fragment: any;
  export interface ErrorInfo { componentStack: string }
  export class Component<P = {}, S = {}> {
    props: P;
    state: S;
    context: any;
    refs: Record<string, any>;
    constructor(props: P);
    setState(state: Partial<S>): void;
    forceUpdate(): void;
    render(): any;
  }
  export class PureComponent<P = {}, S = {}> extends Component<P, S> {}
  export function memo<T>(component: T): T;
  export function forwardRef<T, P = {}>(render: (props: P, ref: any) => any): any;
  export function lazy<T>(factory: () => Promise<{ default: T }>): T;
  export const Suspense: any;
  export const StrictMode: any;
  export type FC<P = {}> = (props: P) => any;
  export type ReactNode = any;
  export default React;
  
  // Ensure JSX supports `key` on all elements/components
  namespace JSX {
    interface IntrinsicAttributes { key?: any }
  }
  
  namespace React {
    export function useState<T>(initialState: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void];
    export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
    export function useRef<T>(initialValue: T): { current: T };
    export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
    export function useMemo<T>(factory: () => T, deps: any[]): T;
    export function useContext<T>(context: any): T;
    export function useReducer<R, I>(reducer: (state: R, action: any) => R, initialArg: I, init?: (arg: I) => R): [R, (action: any) => void];
    export function createContext<T>(defaultValue: T): any;
    export function createElement(type: any, props?: any, ...children: any[]): any;
    export const Fragment: any;
    export interface ErrorInfo { componentStack: string }
    export class Component<P = {}, S = {}> {
      props: P;
      state: S;
      context: any;
      refs: Record<string, any>;
      constructor(props: P);
      setState(state: Partial<S>): void;
      forceUpdate(): void;
      render(): any;
    }
    export class PureComponent<P = {}, S = {}> extends Component<P, S> {}
    export function memo<T>(component: T): T;
    export function forwardRef<T, P = {}>(render: (props: P, ref: any) => any): any;
    export function lazy<T>(factory: () => Promise<{ default: T }>): T;
    export const Suspense: any;
    export const StrictMode: any;
    export type FC<P = {}> = (props: P) => any;
    export type ReactNode = any;
    namespace JSX {
      interface IntrinsicAttributes { key?: any }
    }
    export interface KeyboardEvent<T = any> { key: string; shiftKey: boolean; preventDefault(): void; target: T }
  }
}

declare module 'react-dom' {
  export function render(element: any, container: any): void;
  export function createRoot(container: any): any;
  export default ReactDOM;
  namespace ReactDOM {
    export function render(element: any, container: any): void;
    export function createRoot(container: any): any;
  }
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}