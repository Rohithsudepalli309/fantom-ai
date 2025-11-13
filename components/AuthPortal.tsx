import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from './Logo';
import { EyeIcon, EyeOffIcon } from './Icons';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AuthPortal: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean; confirm?: boolean }>({});
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const formErrorLiveRef = useRef<HTMLDivElement>(null);

  // Smooth 3D tilt using rAF
  const cardRef = useRef<HTMLDivElement>(null);
  const tiltContainerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (!tiltContainerRef.current || !cardRef.current || prefersReducedMotion) return;
    let raf = 0;
    let targetX = 0, targetY = 0, currentX = 0, currentY = 0;
    const onMove = (e: MouseEvent) => {
      const rect = tiltContainerRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      targetX = (y - 0.5) * -6;
      targetY = (x - 0.5) * 6;
    };
    const onLeave = () => { targetX = 0; targetY = 0; };
    const animate = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      cardRef.current!.style.transform = `rotateX(${currentX}deg) rotateY(${currentY}deg)`;
      raf = requestAnimationFrame(animate);
    };
    tiltContainerRef.current.addEventListener('mousemove', onMove);
    tiltContainerRef.current.addEventListener('mouseleave', onLeave);
    raf = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(raf);
      tiltContainerRef.current?.removeEventListener('mousemove', onMove);
      tiltContainerRef.current?.removeEventListener('mouseleave', onLeave);
    };
  }, [prefersReducedMotion]);

  // Handle switch-account intent sent from Settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem('auth_intent');
      if (!raw) return;
      const intent = JSON.parse(raw);
      if (intent?.action === 'switch-account') {
        setMode('login');
        setInfo('You have signed out. Please log in to continue.');
        setPassword('');
        setConfirm('');
        setTouched({});
        // Focus email field shortly after mount
        setTimeout(() => emailRef.current?.focus(), 50);
      }
      localStorage.removeItem('auth_intent');
    } catch {/* ignore */}
  }, []);

  // Validation helpers
  const passwordScore = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 4); // 0..4
  }, [password]);

  const passwordLabel = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][passwordScore] || 'Very weak';

  const fieldErrors = useMemo(() => {
    const errs: { email?: string; password?: string; confirm?: string } = {};
    if (!email) errs.email = 'Email is required.';
    else if (!emailRegex.test(email)) errs.email = 'Enter a valid email address.';
    if (!password) errs.password = 'Password is required.';
    else if (password.length < 8) errs.password = 'Use at least 8 characters.';
    if (mode === 'signup') {
      if (!confirm) errs.confirm = 'Confirm your password.';
      else if (confirm !== password) errs.confirm = 'Passwords do not match.';
    }
    return errs;
  }, [email, password, confirm, mode]);

  const disabled = useMemo(() => {
    if (pending) return true;
    return Object.keys(fieldErrors).length > 0;
  }, [pending, fieldErrors]);

  const onSubmit = async (e: any) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);
    setTouched({ email: true, password: true, confirm: mode === 'signup' ? true : touched.confirm });
    // Focus first invalid field
    if (Object.keys(fieldErrors).length > 0) {
      setPending(false);
      if (fieldErrors.email) emailRef.current?.focus();
      else if (fieldErrors.password) passwordRef.current?.focus();
      else if (fieldErrors.confirm) confirmRef.current?.focus();
      // Announce error
      if (formErrorLiveRef.current) formErrorLiveRef.current.textContent = 'Please fix the highlighted fields.';
      return;
    }
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        // Signup success: force user to login. Show notice, switch to login tab.
        setInfo('Account created successfully. Please log in to continue.');
        // Switch mode back to login
        setMode('login');
        // Clear password fields for security
        setPassword('');
        setConfirm('');
        // Focus password field after tab switch (wait a tick)
        setTimeout(() => passwordRef.current?.focus(), 50);
      }
    } catch (e: any) {
      setError(e?.message || 'Authentication failed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-100 via-white to-slate-200 dark:from-[#101014] dark:via-[#0f0f14] dark:to-[#0d0d12]">
      {/* Background animation: soft moving gradients + subtle particles (respects reduced motion) */}
      {!prefersReducedMotion && (
        <>
          <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 bg-violet-500/25 blur-3xl rounded-full animate-[float1_12s_ease-in-out_infinite]" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-[28rem] w-[28rem] bg-fuchsia-500/20 blur-3xl rounded-full animate-[float2_14s_ease-in-out_infinite]" />
          <div className="pointer-events-none absolute inset-0 opacity-40 dark:opacity-30">
            <div className="absolute h-1.5 w-1.5 bg-violet-400/60 rounded-full left-[15%] top-[30%] animate-[drift_10s_linear_infinite]" />
            <div className="absolute h-1.5 w-1.5 bg-fuchsia-400/60 rounded-full left-[70%] top-[20%] animate-[drift_13s_linear_infinite]" />
            <div className="absolute h-1.5 w-1.5 bg-sky-400/60 rounded-full left-[40%] top-[70%] animate-[drift_16s_linear_infinite]" />
          </div>
        </>
      )}

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        {/* 3D tilt card (smoothed) */}
        <div ref={tiltContainerRef} className="[perspective:1200px] max-w-md w-full">
          <div ref={cardRef} className="tilt-card transition-transform duration-200 [transform-style:preserve-3d] will-change-transform">
            <div className="relative rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-900/60 shadow-2xl backdrop-blur-xl">
              {/* header */}
              <div className="p-6 border-b border-slate-200/60 dark:border-slate-800/60 flex flex-col items-center justify-center gap-3 text-center">
                <Logo className="w-12 h-12" />
                <h1 className="text-2xl font-bold tracking-wide text-slate-800 dark:text-slate-100">FANTOM AI</h1>
              </div>
              {/* tabs */}
              <div className="p-4 flex gap-2">
                <button
                  onClick={() => setMode('login')}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${mode==='login' ? 'bg-violet-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                >Login</button>
                <button
                  onClick={() => setMode('signup')}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-colors ${mode==='signup' ? 'bg-violet-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                >Sign up</button>
              </div>
              {/* form */}
              <form onSubmit={onSubmit} className="p-6 pt-2 space-y-4" noValidate>
                {/* form live region for screen readers */}
                <div ref={formErrorLiveRef} aria-live="polite" className="sr-only" />
                <div className="transition-all">
                  <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                  <input
                    id="email"
                    ref={emailRef}
                    type="email"
                    value={email}
                    onChange={(e)=> setEmail(e.target.value)}
                    onBlur={() => setTouched(t => ({...t, email: true}))}
                    placeholder="you@example.com"
                    aria-invalid={!!(touched.email && fieldErrors.email)}
                    aria-describedby={touched.email && fieldErrors.email ? 'email-error' : undefined}
                    className={`mt-1 w-full p-3 rounded-md bg-slate-800 border focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-white placeholder-slate-400 ${touched.email && fieldErrors.email ? 'border-red-400 dark:border-red-500' : 'border-slate-600 dark:border-slate-600'}`}
                    required
                  />
                  {touched.email && fieldErrors.email && (
                    <p id="email-error" className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.email}</p>
                  )}
                </div>

                <div className="transition-all">
                  <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      ref={passwordRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e)=> setPassword(e.target.value)}
                      onBlur={() => setTouched(t => ({...t, password: true}))}
                      placeholder="At least 8 characters"
                      aria-invalid={!!(touched.password && fieldErrors.password)}
                      aria-describedby={(touched.password && fieldErrors.password) ? 'password-error password-help' : 'password-help'}
                      className={`mt-1 w-full p-3 pr-10 rounded-md bg-slate-800 border focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-white placeholder-slate-400 ${touched.password && fieldErrors.password ? 'border-red-400 dark:border-red-500' : 'border-slate-600 dark:border-slate-600'}`}
                      required
                    />
                    <button
                      type="button"
                      onClick={()=> setShowPassword(s => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 transition-transform transition-colors hover:scale-105 active:scale-95"
                    >
                      {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                    </button>
                  </div>
                  <div id="password-help" className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Use 8+ chars with a mix of letters, numbers, and symbols.</div>
                  {/* strength bar */}
                  <div className="mt-2">
                    <div className="h-1.5 w-full rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full transition-all ${passwordScore <= 1 ? 'w-1/5 bg-red-500' : passwordScore === 2 ? 'w-2/5 bg-orange-500' : passwordScore === 3 ? 'w-3/5 bg-yellow-500' : 'w-full bg-emerald-500'}`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="text-[11px] mt-1 text-slate-600 dark:text-slate-300">Strength: {password ? passwordLabel : '—'}</div>
                  </div>
                  {touched.password && fieldErrors.password && (
                    <p id="password-error" className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.password}</p>
                  )}
                </div>

                {mode === 'signup' && (
                  <div className="transition-all">
                    <label htmlFor="confirm" className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirm Password</label>
                    <input
                      id="confirm"
                      ref={confirmRef}
                      type={showPassword ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e)=> setConfirm(e.target.value)}
                      onBlur={() => setTouched(t => ({...t, confirm: true}))}
                      aria-invalid={!!(touched.confirm && fieldErrors.confirm)}
                      aria-describedby={touched.confirm && fieldErrors.confirm ? 'confirm-error' : undefined}
                      className={`mt-1 w-full p-3 rounded-md bg-slate-800 border focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-white placeholder-slate-400 ${touched.confirm && fieldErrors.confirm ? 'border-red-400 dark:border-red-500' : 'border-slate-600 dark:border-slate-600'}`}
                      required
                    />
                    {touched.confirm && fieldErrors.confirm && (
                      <p id="confirm-error" className="text-xs text-red-600 dark:text-red-400 mt-1">{fieldErrors.confirm}</p>
                    )}
                  </div>
                )}

                {/* form-level messages */}
                {error && (
                  <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded" role="alert">
                    {error}
                  </div>
                )}
                {info && !error && (
                  <div className="text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded animate-auth-fade" role="status">
                    {info}
                  </div>
                )}

                <button
                  disabled={disabled}
                  className="w-full py-2.5 rounded-md bg-violet-600 text-white font-semibold hover:bg-violet-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                >{pending ? 'Please wait…' : (mode === 'login' ? 'Login' : 'Create account')}</button>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">By continuing you agree to our Terms & Privacy.</p>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Component-scoped animations (no global CSS) */}
      <style>
        {`
          @keyframes float1 { 0%,100%{ transform: translate3d(0,0,0)} 50%{ transform: translate3d(12px, -8px, 0)} }
          @keyframes float2 { 0%,100%{ transform: translate3d(0,0,0)} 50%{ transform: translate3d(-10px, 10px, 0)} }
          @keyframes drift { 0%{ transform: translate3d(0,0,0)} 100%{ transform: translate3d(0,-30vh,0)} }
          @keyframes authFade { 0% { opacity: 0; transform: translateY(4px); } 100% { opacity: 1; transform: translateY(0); } }
          .animate-auth-fade { animation: authFade 320ms cubic-bezier(0.22,0.61,0.36,1); }
        `}
      </style>
    </div>
  );
};

export default AuthPortal;