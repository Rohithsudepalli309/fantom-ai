import React, { useEffect, useMemo, useRef, useState } from 'react';
import Logo from '@/components/Logo';

type Props = {
  size?: number; // px
  altText?: string;
  className?: string;
};

// A lightweight interactive 3D logo with idle animation and reduced-motion fallback.
const HeroLogo3D: React.FC<Props> = ({ size = 120, altText = 'FANTOM AI', className }) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const target = useRef({ rx: 0, ry: 0, rz: 0, scale: 1.03 });
  const current = useRef({ rx: 0, ry: 0, rz: 0, scale: 1.03 });
  // Initialize last interaction far in the past so idle animation starts immediately.
  const lastMoveRef = useRef<number>(Date.now() - 10000);
  const prefersReduced = useMemo(() => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);

  // Smoothly interpolate current transform toward target
  const animate = () => {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    current.current.rx = lerp(current.current.rx, target.current.rx, 0.12);
    current.current.ry = lerp(current.current.ry, target.current.ry, 0.12);
    current.current.rz = lerp(current.current.rz, target.current.rz, 0.12);
    current.current.scale = lerp(current.current.scale, target.current.scale, 0.12);

    if (wrapperRef.current) {
      const { rx, ry, rz, scale } = current.current;
      wrapperRef.current.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`;
    }
    rafRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (prefersReduced) return; // respect reduced motion
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [prefersReduced]);

  const updateFromPointer = (clientX: number, clientY: number) => {
    if (!wrapperRef.current) return;
    const parent = wrapperRef.current.parentElement;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxTilt = 15; // deg
    const dx = (clientX - cx) / (rect.width / 2); // -1..1
    const dy = (clientY - cy) / (rect.height / 2); // -1..1
    // Invert Y for natural tilt (move up -> tilt back)
    target.current.ry = Math.max(-1, Math.min(1, dx)) * maxTilt;
    target.current.rx = Math.max(-1, Math.min(1, -dy)) * maxTilt;
    target.current.rz = dx * -2; // tiny roll for depth
    target.current.scale = 1.05;
  };

  const onMouseMove = (e: any) => {
    if (prefersReduced) return;
    setIsInteracting(true);
    lastMoveRef.current = Date.now();
    updateFromPointer(e.clientX, e.clientY);
  };

  const onMouseLeave = () => {
    setIsInteracting(false);
  };

  const onTouchMove = (e: any) => {
    if (prefersReduced) return;
    const t = e.touches[0];
    if (!t) return;
    setIsInteracting(true);
    lastMoveRef.current = Date.now();
    updateFromPointer(t.clientX, t.clientY);
  };

  const onTouchEnd = () => {
    setIsInteracting(false);
  };

  // Continuous idle wobble when not interacting (immediate start) with slightly larger motion for visibility.
  useEffect(() => {
    if (prefersReduced) return;
    const idle = setInterval(() => {
      const now = Date.now();
      if (!isInteracting) {
        const t = now / 1000;
        target.current.rx = Math.sin(t * 0.8) * 8; // increased amplitude
        target.current.ry = Math.cos(t * 0.9) * 12;
        target.current.rz = Math.sin(t * 0.6) * 3;
        target.current.scale = 1.04 + Math.sin(t * 0.7) * 0.015;
      }
    }, 80);
    return () => clearInterval(idle);
  }, [isInteracting, prefersReduced]);

  const containerClass = useMemo(() => {
    const base = [
      'relative',
      'mx-auto',
      'select-none',
      'will-change-transform',
      'transition-shadow',
      'duration-300',
      'ease-out',
    ];
    if (className) base.push(className);
    return base.join(' ');
  }, [className]);

  return (
    <div
      className={containerClass}
      style={{ perspective: '1000px' }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      aria-label="Animated FANTOM AI logo"
    >
      {/* Depth glow */}
      <div className="absolute inset-0 blur-2xl rounded-full bg-violet-500/20 dark:bg-violet-400/10 -z-10" />

      {/* Transform target wrapper */}
      <div ref={wrapperRef} className="[transform-style:preserve-3d]">
        <div className="rounded-2xl shadow-xl ring-1 ring-slate-900/5 dark:ring-white/10 bg-white/40 dark:bg-white/5 backdrop-blur-sm p-4">
          <Logo size={size} altText={altText} priority />
        </div>
      </div>
    </div>
  );
};

export default HeroLogo3D;
