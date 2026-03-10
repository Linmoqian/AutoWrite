'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  hue: number;
  saturation: number;
}

interface ParticleBackgroundProps {
  particleCount?: number;
}

export function ParticleBackground({ particleCount = 35 }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const animationRef = useRef<number | undefined>(undefined);

  // 创建墨迹粒子
  const createParticle = useCallback((x?: number, y?: number): Particle => {
    const canvas = canvasRef.current;
    // 温暖的色调 - 琥珀色到金色的范围
    const hue = 30 + Math.random() * 30; // 30-60 (琥珀到金色)
    return {
      x: x ?? Math.random() * (canvas?.width ?? 0),
      y: y ?? Math.random() * (canvas?.height ?? 0),
      size: Math.random() * 2.5 + 0.8,
      speedX: (Math.random() - 0.5) * 0.25,
      speedY: -Math.random() * 0.4 - 0.15,
      opacity: Math.random() * 0.35 + 0.12,
      hue,
      saturation: 55 + Math.random() * 30,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 初始化粒子
    particlesRef.current = Array.from({ length: particleCount }, () => createParticle());

    const animate = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((particle, index) => {
        // 鼠标交互 - 轻微吸引
        if (mouseRef.current.active) {
          const dx = mouseRef.current.x - particle.x;
          const dy = mouseRef.current.y - particle.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 180) {
            const force = (180 - dist) / 180;
            particle.speedX += dx * force * 0.0008;
            particle.speedY += dy * force * 0.0008;
          }
        }

        // 更新位置
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // 缓慢减速
        particle.speedX *= 0.998;
        particle.speedY *= 0.998;

        // 边界检测 - 从底部重新进入
        if (particle.y < -10) {
          particlesRef.current[index] = createParticle(
            Math.random() * canvas.width,
            canvas.height + 10
          );
        }
        if (particle.x < -10 || particle.x > canvas.width + 10) {
          particlesRef.current[index] = createParticle(
            Math.random() * canvas.width,
            canvas.height + 10
          );
        }

        // 绘制墨迹粒子
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${particle.hue}, ${particle.saturation}%, 72%, ${particle.opacity})`;
        ctx.fill();

        // 绘制光晕效果 - 更柔和
        const gradient = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 5
        );
        gradient.addColorStop(0, `hsla(${particle.hue}, ${particle.saturation}%, 68%, ${particle.opacity * 0.22})`);
        gradient.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size * 5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      });

      // 绘制连接线 - 更淡更优雅
      particlesRef.current.forEach((p1, i) => {
        particlesRef.current.slice(i + 1).forEach((p2) => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            // 使用温暖的色调
            ctx.strokeStyle = `hsla(35, 45%, 58%, ${(1 - dist / 110) * 0.1})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };

    const handleMouseLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [particleCount, createParticle]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}
