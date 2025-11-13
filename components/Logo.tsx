import React, { useEffect, useMemo, useRef, useState } from 'react';

// Default logo size (in pixels). You can override per-usage via the `size` prop for hero/landing.
const FIXED_LOGO_SIZE = 40; // px

type Props = {
  altText?: string;
  srcPath?: string; // override, defaults to /logo.png in public/
  priority?: boolean; // if true, load eagerly with high priority (hero)
  // Optional per-usage size override (in px). Defaults to FIXED_LOGO_SIZE.
  size?: number;
  /**
   * How the image should fit inside the square box.
   * - 'contain' (default): preserves full image, may leave padding.
   * - 'cover': fills the square by cropping overflow, useful for narrow logos.
   */
  fitMode?: 'contain' | 'cover';
  /**
   * Enable direct 3D animation on the logo image itself (no slate/card wrapper).
   * Includes idle wobble and pointer-based tilt. Respects prefers-reduced-motion.
   */
  animate3D?: boolean;
  /**
   * Whether pointer interaction (tilt on hover/touch) is enabled when animate3D is true.
   */
  interactive3D?: boolean;
  /**
   * If true, rotate the image continuously (CSS-based). Takes precedence over animate3D.
   * Respects prefers-reduced-motion via Tailwind's motion-reduce variant.
   */
  spin?: boolean;
  /**
   * If true, perform a slow 3D coin-like rotation (rotateY with perspective).
   * Takes precedence over both spin and animate3D to avoid transform conflicts.
   */
  coinSpin?: boolean;
} & Record<string, any>;

/**
 * Centralized app logo component.
 * - Default source: /public/logo.png (served as "/logo.png").
 * - Size with Tailwind via className (e.g., "w-8 h-8").
 * - Uses object-contain to avoid distortion across placements (chat avatar, headers, hero).
 * - Optional priority for LCP areas.
 */
export const Logo: React.FC<Props> = ({ altText = 'FANTOM AI', srcPath = '/logo.png', priority = false, size, fitMode = 'contain', animate3D = false, interactive3D = true, spin = false, coinSpin = false, ...rest }) => {
  // Treat incoming className/style as wrapper props so we can reliably square the box
  const wrapperClass = useMemo(() => {
    const extra = rest.className ? String(rest.className) : '';
    // Ensure square box and avoid inline image baseline gap
    const base = ['inline-block', 'shrink-0', 'aspect-square'];
    // Do NOT add any width/height classes here; size is locked via inline style.
    if (extra) base.push(extra);
    return base.join(' ').trim();
  }, [rest.className]);

  // Enforce a square size via inline styles; allow per-usage override through `size`
  const resolvedSize = typeof size === 'number' && size > 0 ? size : FIXED_LOGO_SIZE;
  const wrapperStyle = { ...(rest.style || {}), width: resolvedSize, height: resolvedSize };

  const loading = priority ? 'eager' : 'lazy';
  const fetchPriority = priority ? 'high' : 'auto';
  const imgRef = useRef<HTMLImageElement | null>(null);
  const prefersReduced = (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
  // If spin or coinSpin is enabled, suppress JS-driven 3D animation to avoid transform conflicts.
  const shouldAnimate = animate3D && !prefersReduced && !spin && !coinSpin;

  // 3D animation state (applied to the IMG element itself)
  const target = useRef({ rx: 0, ry: 0, rz: 0, scale: 1.03 });
  const current = useRef({ rx: 0, ry: 0, rz: 0, scale: 1.03 });
  const rafRef = useRef<number | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const lastMoveRef = useRef<number>(Date.now() - 10000);

  const animate = () => {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    current.current.rx = lerp(current.current.rx, target.current.rx, 0.12);
    current.current.ry = lerp(current.current.ry, target.current.ry, 0.12);
    current.current.rz = lerp(current.current.rz, target.current.rz, 0.12);
    current.current.scale = lerp(current.current.scale, target.current.scale, 0.12);

    const el = imgRef.current;
    if (el) {
      const { rx, ry, rz, scale } = current.current;
      el.style.transform = `perspective(1000px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg) scale(${scale})`;
      el.style.willChange = 'transform';
      el.style.transformStyle = 'preserve-3d';
    }
    rafRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    if (!shouldAnimate) return;
    rafRef.current = requestAnimationFrame(animate);
    const idle = setInterval(() => {
      const now = Date.now();
      if (!isInteracting) {
        const t = now / 1000;
        target.current.rx = Math.sin(t * 0.8) * 8;
        target.current.ry = Math.cos(t * 0.9) * 12;
        target.current.rz = Math.sin(t * 0.6) * 3;
        target.current.scale = 1.04 + Math.sin(t * 0.7) * 0.015;
      }
    }, 80);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      clearInterval(idle);
      // Clean transform to avoid sticking if component unmounts
      if (imgRef.current) imgRef.current.style.transform = '';
    };
  }, [shouldAnimate, isInteracting]);

  const onMove = (clientX: number, clientY: number) => {
    if (!shouldAnimate || !interactive3D || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (clientX - cx) / (rect.width / 2);
    const dy = (clientY - cy) / (rect.height / 2);
    const maxTilt = 15;
    target.current.ry = Math.max(-1, Math.min(1, dx)) * maxTilt;
    target.current.rx = Math.max(-1, Math.min(1, -dy)) * maxTilt;
    target.current.rz = dx * -2;
    target.current.scale = 1.06;
  };

  const handleMouseMove = (e: any) => {
    if (!shouldAnimate || !interactive3D) return;
    setIsInteracting(true);
    lastMoveRef.current = Date.now();
    onMove(e.clientX, e.clientY);
  };
  const handleMouseLeave = () => {
    if (!shouldAnimate || !interactive3D) return;
    setIsInteracting(false);
  };
  const handleTouchMove = (e: any) => {
    if (!shouldAnimate || !interactive3D) return;
    const t = e.touches?.[0];
    if (!t) return;
    setIsInteracting(true);
    lastMoveRef.current = Date.now();
    onMove(t.clientX, t.clientY);
  };
  const handleTouchEnd = () => {
    if (!shouldAnimate || !interactive3D) return;
    setIsInteracting(false);
  };

  // Fallback strategy: if PNG missing, try /logo.svg once; else keep a transparent pixel.
  const handleError = (e: any) => {
    const el = e?.currentTarget as HTMLImageElement | undefined;
    if (!el) return;
    if (!el.dataset.fallbackTried) {
      el.dataset.fallbackTried = '1';
      el.src = '/logo.svg';
    } else {
      el.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
    }
  };

  // Separate rest props: don't forward wrapper props (className/style) to the img element
  const { className: _c, style: _s, ...imgProps } = rest;
  const imgClass = [
    fitMode === 'cover' ? 'object-cover' : 'object-contain',
    'w-full',
    'h-full',
    'block',
  ];
  if (coinSpin) {
    imgClass.push('coin-rotate-slow');
  } else if (spin) {
    // Use Tailwind animate-spin
    imgClass.push('animate-spin');
  }

  return (
    <div className={wrapperClass} style={wrapperStyle} aria-label={altText} role="img">
      <img
        ref={imgRef}
        src={srcPath}
        alt={altText}
        className={imgClass.join(' ')}
        decoding="async"
        loading={loading}
        fetchPriority={fetchPriority}
        onError={handleError}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        {...imgProps}
      />
    </div>
  );
};

export default Logo;
