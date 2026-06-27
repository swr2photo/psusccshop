'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, keyframes } from '@mui/material';
import Image from 'next/image';
import { useTranslation } from '@/hooks/useTranslation';
import { useThemeStore } from '@/store/themeStore';
import * as THREE from 'three';

// Animations
const pulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.85; }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const fadeInUp = keyframes`
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const wave = keyframes`
  0% { transform: scaleY(1); }
  50% { transform: scaleY(0.4); }
  100% { transform: scaleY(1); }
`;

interface LoadingScreenProps {
  message?: string;
  showLogo?: boolean;
  variant?: 'fullscreen' | 'inline' | 'overlay';
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingScreen(props: LoadingScreenProps) {
  const { t } = useTranslation();
  const resolvedMode = useThemeStore((s) => s.resolvedMode);
  const isDark = resolvedMode === 'dark';

  const message = props.message ?? t.common.loading;
  const showLogo = props.showLogo ?? true;
  const variant = props.variant ?? 'fullscreen';
  const size = props.size ?? 'md';

  const logoSize = { sm: 48, md: 64, lg: 80 }[size];
  const textSize = { sm: '0.85rem', md: '1rem', lg: '1.1rem' }[size];

  // Canvas and WebGL refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);

  // Check WebGL availability and set up Three.js animation on mount
  useEffect(() => {
    setMounted(true);
    let supportsWebGL = false;
    try {
      const canvas = document.createElement('canvas');
      supportsWebGL = !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
      setHasWebGL(supportsWebGL);
    } catch (e) {
      setHasWebGL(false);
    }

    if (!supportsWebGL || variant !== 'fullscreen' || !canvasRef.current || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    const canvas = canvasRef.current;

    // Dimensions
    let width = container.clientWidth;
    let height = container.clientHeight;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    // Custom Canvas Texture for soft glowing particles
    const createCircleTexture = () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
        grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
      }
      return new THREE.CanvasTexture(c);
    };

    const particleTexture = createCircleTexture();

    // Particle Sphere 1 (Inner core)
    const particleCount1 = 1200;
    const positions1 = new Float32Array(particleCount1 * 3);
    const originalPositions1 = new Float32Array(particleCount1 * 3);
    const randoms1 = new Float32Array(particleCount1);
    const radius1 = 1.6;

    for (let i = 0; i < particleCount1; i++) {
      // Golden ratio distribution for a uniform sphere representation
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      const x = radius1 * Math.sin(phi) * Math.cos(theta);
      const y = radius1 * Math.sin(phi) * Math.sin(theta);
      const z = radius1 * Math.cos(phi);

      const i3 = i * 3;
      positions1[i3] = x;
      positions1[i3 + 1] = y;
      positions1[i3 + 2] = z;

      originalPositions1[i3] = x;
      originalPositions1[i3 + 1] = y;
      originalPositions1[i3 + 2] = z;

      randoms1[i] = Math.random() * Math.PI * 2;
    }

    const geometry1 = new THREE.BufferGeometry();
    geometry1.setAttribute('position', new THREE.BufferAttribute(positions1, 3));

    const material1 = new THREE.PointsMaterial({
      size: 0.05,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points1 = new THREE.Points(geometry1, material1);
    scene.add(points1);

    // Particle Sphere 2 (Outer shell)
    const particleCount2 = 800;
    const positions2 = new Float32Array(particleCount2 * 3);
    const originalPositions2 = new Float32Array(particleCount2 * 3);
    const randoms2 = new Float32Array(particleCount2);
    const radius2 = 2.6;

    for (let i = 0; i < particleCount2; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);

      const x = radius2 * Math.sin(phi) * Math.cos(theta);
      const y = radius2 * Math.sin(phi) * Math.sin(theta);
      const z = radius2 * Math.cos(phi);

      const i3 = i * 3;
      positions2[i3] = x;
      positions2[i3 + 1] = y;
      positions2[i3 + 2] = z;

      originalPositions2[i3] = x;
      originalPositions2[i3 + 1] = y;
      originalPositions2[i3 + 2] = z;

      randoms2[i] = Math.random() * Math.PI * 2;
    }

    const geometry2 = new THREE.BufferGeometry();
    geometry2.setAttribute('position', new THREE.BufferAttribute(positions2, 3));

    const material2 = new THREE.PointsMaterial({
      size: 0.07,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
      opacity: 0.6,
    });

    const points2 = new THREE.Points(geometry2, material2);
    scene.add(points2);

    // Mouse interaction parameters
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      // Normalize coordinates
      targetX = (e.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      targetY = (e.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        targetX = (e.touches[0].clientX - window.innerWidth / 2) / (window.innerWidth / 2);
        targetY = (e.touches[0].clientY - window.innerHeight / 2) / (window.innerHeight / 2);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);

    // Render loop variables
    let animationFrameId: number;
    let clock = new THREE.Clock();

    // Loop
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Theme-based colors (smooth transition)
      const targetColor1 = isDark ? new THREE.Color('#00c6ff') : new THREE.Color('#0071e3');
      const targetColor2 = isDark ? new THREE.Color('#a55eea') : new THREE.Color('#64d2ff');

      material1.color.lerp(targetColor1, 0.05);
      material2.color.lerp(targetColor2, 0.05);

      // Smooth mouse lerping
      mouseX += (targetX - mouseX) * 0.08;
      mouseY += (targetY - mouseY) * 0.08;

      // Apply rotations
      points1.rotation.y = elapsedTime * 0.08 + mouseX * 0.5;
      points1.rotation.x = elapsedTime * 0.04 + mouseY * 0.5;

      points2.rotation.y = -elapsedTime * 0.05 - mouseX * 0.3;
      points2.rotation.z = elapsedTime * 0.03 + mouseY * 0.3;

      // Animate vertices (breathing wave distortion)
      const pos1 = geometry1.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount1; i++) {
        const i3 = i * 3;
        const ox = originalPositions1[i3];
        const oy = originalPositions1[i3 + 1];
        const oz = originalPositions1[i3 + 2];

        // Soft wave formula
        const offset = randoms1[i];
        const waveValue = Math.sin(elapsedTime * 1.5 + offset) * 0.12;

        pos1[i3] = ox * (1 + waveValue);
        pos1[i3 + 1] = oy * (1 + waveValue);
        pos1[i3 + 2] = oz * (1 + waveValue);
      }
      geometry1.attributes.position.needsUpdate = true;

      const pos2 = geometry2.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount2; i++) {
        const i3 = i * 3;
        const ox = originalPositions2[i3];
        const oy = originalPositions2[i3 + 1];
        const oz = originalPositions2[i3 + 2];

        const offset = randoms2[i];
        const waveValue = Math.cos(elapsedTime * 1.0 + offset) * 0.15;

        pos2[i3] = ox * (1 + waveValue);
        pos2[i3 + 1] = oy * (1 + waveValue);
        pos2[i3 + 2] = oz * (1 + waveValue);
      }
      geometry2.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // Handle Resize
    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      width = container.clientWidth;
      height = container.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('resize', handleResize);

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);

      // Clean resources
      geometry1.dispose();
      material1.dispose();
      geometry2.dispose();
      material2.dispose();
      particleTexture.dispose();
      renderer.dispose();
    };
  }, [variant, isDark]);

  // Return a simple container during SSR to prevent hydration mismatch on Emotion styles
  if (!mounted) {
    if (variant === 'inline') {
      return (
        <Box suppressHydrationWarning sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }} />
      );
    }
    if (variant === 'overlay') {
      return (
        <Box suppressHydrationWarning sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.85)', zIndex: 100 }} />
      );
    }
    // fullscreen
    return (
      <Box
        suppressHydrationWarning
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: 'var(--background)',
          zIndex: 9999,
        }}
      />
    );
  }

  const cssLoaderContent = (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
      animation: `${fadeInUp} 0.6s ease-out`,
      zIndex: 10,
      pointerEvents: 'none',
    }}>
      {/* Logo with Pulse Animation */}
      {showLogo && (
        <Box sx={{
          position: 'relative',
          width: logoSize + 24,
          height: logoSize + 24,
          animation: `${pulse} 2s ease-in-out infinite`,
        }}>
          {/* Glow Effect */}
          <Box sx={{
            position: 'absolute',
            inset: -8,
            borderRadius: '20px',
            background: 'radial-gradient(circle, rgba(0,113,227,0.3) 0%, transparent 70%)',
            filter: 'blur(16px)',
            animation: `${pulse} 2s ease-in-out infinite`,
          }} />
          
          {/* Logo Container */}
          <Box sx={{
            width: logoSize + 24,
            height: logoSize + 24,
            borderRadius: '18px',
            background: 'linear-gradient(135deg, rgba(0,113,227,0.15) 0%, rgba(0,113,227,0.15) 100%)',
            border: '2px solid rgba(0,113,227,0.3)',
            display: 'grid',
            placeItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}>
            <Image
              src="/logo.png"
              alt="SCC Shop"
              width={logoSize}
              height={logoSize}
              className="theme-logo"
              style={{ objectFit: 'contain' }}
              priority
            />
            
            {/* Shimmer Overlay */}
            <Box sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
              backgroundSize: '200% 100%',
              animation: `${shimmer} 2s infinite`,
            }} />
          </Box>
        </Box>
      )}

      {/* Brand Name */}
      <Typography sx={{
        fontWeight: 800,
        fontSize: textSize,
        background: 'linear-gradient(135deg, #0071e3 0%, #64d2ff 50%, #0071e3 100%)',
        backgroundSize: '200% auto',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        animation: `${shimmer} 3s linear infinite`,
        letterSpacing: '0.05em',
      }}>
        SCC SHOP
      </Typography>

      {/* Loading Bars */}
      <Box sx={{
        display: 'flex',
        gap: 0.8,
        height: 24,
        alignItems: 'center',
      }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Box
            key={i}
            sx={{
              width: 4,
              height: '100%',
              borderRadius: 2,
              bgcolor: '#0071e3',
              animation: `${wave} 1s ease-in-out infinite`,
              animationDelay: `${i * 0.1}s`,
              boxShadow: '0 0 8px rgba(0,113,227,0.5)',
            }}
          />
        ))}
      </Box>

      {/* Loading Message */}
      <Typography sx={{
        color: 'var(--text-muted)',
        fontSize: '0.85rem',
        fontWeight: 500,
        animation: `${pulse} 2s ease-in-out infinite`,
      }}>
        {message}
      </Typography>
    </Box>
  );

  if (variant === 'inline') {
    return (
      <Box suppressHydrationWarning sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        py: 6,
      }}>
        {cssLoaderContent}
      </Box>
    );
  }

  if (variant === 'overlay') {
    return (
      <Box suppressHydrationWarning sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        bgcolor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
      }}>
        {cssLoaderContent}
      </Box>
    );
  }

  // Fullscreen with 3D WebGL background
  return (
    <Box
      ref={containerRef}
      suppressHydrationWarning
      sx={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        bgcolor: 'var(--background)',
        zIndex: 9999,
        overflow: 'hidden',
        backgroundImage: isDark
          ? 'radial-gradient(circle at 50% 50%, rgba(10,132,255,0.05) 0%, transparent 60%)'
          : 'radial-gradient(circle at 50% 50%, rgba(0,113,227,0.03) 0%, transparent 60%)',
      }}
    >
      {/* WebGL Canvas */}
      {hasWebGL && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Loading Information Layer */}
      {cssLoaderContent}
    </Box>
  );
}

// Enhanced Skeleton Components
interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  variant?: 'rectangular' | 'circular' | 'text' | 'rounded';
  animation?: 'shimmer' | 'pulse' | 'wave';
}

export function ModernSkeleton(props: SkeletonProps) {
  const width = props.width ?? '100%';
  const height = props.height ?? 20;
  const variant = props.variant ?? 'rectangular';
  const animation = props.animation ?? 'shimmer';

  const borderRadius = {
    rectangular: '4px',
    circular: '50%',
    text: '4px',
    rounded: '12px',
  }[variant];

  const animationKeyframes = {
    shimmer: keyframes`
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    `,
    pulse: keyframes`
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.7; }
    `,
    wave: keyframes`
      0% { transform: translateX(-100%); }
      50% { transform: translateX(100%); }
      100% { transform: translateX(100%); }
    `,
  }[animation];

  return (
    <Box sx={{
      width,
      height,
      borderRadius,
      position: 'relative',
      overflow: 'hidden',
      bgcolor: 'var(--skeleton-bg)',
      ...(animation === 'shimmer' && {
        background: 'var(--skeleton-shimmer)',
        backgroundSize: '200% 100%',
        animation: `${animationKeyframes} 1.5s ease-in-out infinite`,
      }),
      ...(animation === 'pulse' && {
        animation: `${animationKeyframes} 1.5s ease-in-out infinite`,
      }),
    }}>
      {animation === 'wave' && (
        <Box sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent, var(--skeleton-highlight), transparent)',
          animation: `${animationKeyframes} 1.5s ease-in-out infinite`,
        }} />
      )}
    </Box>
  );
}

// Product Card Skeleton
export function ProductCardSkeleton() {
  return (
    <Box sx={{
      borderRadius: '16px',
      bgcolor: 'rgba(29,29,31,0.5)',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      <ModernSkeleton width="100%" height={180} variant="rectangular" />
      <Box sx={{ p: 2 }}>
        <ModernSkeleton width="70%" height={20} variant="rounded" />
        <Box sx={{ mt: 1.5 }} />
        <ModernSkeleton width="40%" height={16} variant="rounded" />
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
          <ModernSkeleton width={60} height={28} variant="rounded" />
          <ModernSkeleton width={80} height={36} variant="rounded" />
        </Box>
      </Box>
    </Box>
  );
}

// Order Card Skeleton
export function OrderCardSkeleton() {
  return (
    <Box sx={{
      p: 2,
      borderRadius: '18px',
      bgcolor: 'rgba(29,29,31,0.5)',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <ModernSkeleton width={100} height={18} variant="rounded" />
          <Box sx={{ mt: 1 }} />
          <ModernSkeleton width={140} height={14} variant="rounded" />
        </Box>
        <ModernSkeleton width={70} height={24} variant="rounded" />
      </Box>
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <ModernSkeleton width={56} height={56} variant="rounded" />
        <Box sx={{ flex: 1 }}>
          <ModernSkeleton width="80%" height={16} variant="rounded" />
          <Box sx={{ mt: 1 }} />
          <ModernSkeleton width="40%" height={14} variant="rounded" />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 1.5, borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <ModernSkeleton width={80} height={24} variant="rounded" />
        <ModernSkeleton width={100} height={36} variant="rounded" />
      </Box>
    </Box>
  );
}

// Cart Item Skeleton
export function CartItemSkeleton() {
  return (
    <Box sx={{
      p: 2,
      borderRadius: '16px',
      bgcolor: 'rgba(29,29,31,0.5)',
      border: '1px solid rgba(255,255,255,0.06)',
      display: 'flex',
      gap: 2,
    }}>
      <ModernSkeleton width={60} height={60} variant="rounded" />
      <Box sx={{ flex: 1 }}>
        <ModernSkeleton width="70%" height={18} variant="rounded" />
        <Box sx={{ mt: 1 }} />
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <ModernSkeleton width={40} height={20} variant="rounded" />
          <ModernSkeleton width={50} height={20} variant="rounded" />
        </Box>
        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between' }}>
          <ModernSkeleton width={100} height={28} variant="rounded" />
          <ModernSkeleton width={60} height={20} variant="rounded" />
        </Box>
      </Box>
    </Box>
  );
}
