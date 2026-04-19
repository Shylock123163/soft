import { useEffect, useRef, useCallback } from 'react';

interface Particle {
  x: number;
  y: number;
  ox: number;
  oy: number;
  nx: number;
  ny: number;
  vx: number;
  vy: number;
  color: string;
  opacity: number;
  size: number;
}

interface Props {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  particleSize?: number;
  gap?: number;
  className?: string;
  style?: React.CSSProperties;
  mouseRadius?: number;
}

export function ParticleText({
  text,
  fontSize = 80,
  fontFamily = '"PingFang SC", "Microsoft YaHei", sans-serif',
  color = '#ffffff',
  particleSize = 1.2,
  gap = 4,
  className,
  style,
  mouseRadius = 60,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef(0);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const assembledRef = useRef(false);
  const dimensionsRef = useRef({ w: 0, h: 0, textW: 0, textH: 0 });

  const sampleText = useCallback(() => {
    const offscreen = document.createElement('canvas');
    const octx = offscreen.getContext('2d')!;

    const dpr = window.devicePixelRatio || 1;
    const scaledFontSize = fontSize;

    octx.font = `900 ${scaledFontSize}px ${fontFamily}`;
    const metrics = octx.measureText(text);
    const textW = Math.ceil(metrics.width);
    const textH = Math.ceil(scaledFontSize * 1.3);

    offscreen.width = textW;
    offscreen.height = textH;

    octx.font = `900 ${scaledFontSize}px ${fontFamily}`;
    octx.fillStyle = color;
    octx.textBaseline = 'top';
    octx.fillText(text, 0, scaledFontSize * 0.1);

    const imageData = octx.getImageData(0, 0, textW, textH).data;
    const points: { x: number; y: number; r: number; g: number; b: number }[] = [];

    for (let y = 0; y < textH; y += gap) {
      for (let x = 0; x < textW; x += gap) {
        const i = (y * textW + x) * 4;
        const a = imageData[i + 3];
        if (a > 128) {
          points.push({
            x, y,
            r: imageData[i],
            g: imageData[i + 1],
            b: imageData[i + 2],
          });
        }
      }
    }

    dimensionsRef.current = { w: textW, h: textH, textW, textH };
    return points;
  }, [text, fontSize, fontFamily, color, gap]);

  const buildParticles = useCallback((
    points: { x: number; y: number; r: number; g: number; b: number }[],
    canvasW: number,
    canvasH: number,
  ) => {
    const { textW, textH } = dimensionsRef.current;
    const offsetX = (canvasW - textW) / 2;
    const offsetY = (canvasH - textH) / 2;

    const indices = Array.from({ length: points.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const particles: Particle[] = points.map((p, idx) => {
      const shuffledIdx = indices[idx];
      const target = points[shuffledIdx];
      return {
        x: Math.random() * canvasW,
        y: Math.random() * canvasH,
        ox: target.x + offsetX,
        oy: target.y + offsetY,
        nx: target.x + offsetX,
        ny: target.y + offsetY,
        vx: 0,
        vy: 0,
        color: `${p.r},${p.g},${p.b}`,
        opacity: 0,
        size: particleSize * (0.8 + Math.random() * 0.4),
      };
    });

    return particles;
  }, [particleSize]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const dpr = window.devicePixelRatio || 1;
    let w = canvas.parentElement?.clientWidth || window.innerWidth;
    let h = canvas.parentElement?.clientHeight || 200;

    function resize() {
      w = canvas!.parentElement?.clientWidth || window.innerWidth;
      h = canvas!.parentElement?.clientHeight || 200;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const points = sampleText();
      particlesRef.current = buildParticles(points, w, h);
      assembledRef.current = false;
    }

    resize();

    const thicknessSquared = mouseRadius * mouseRadius;

    function animate() {
      ctx.clearRect(0, 0, w, h);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const particles = particlesRef.current;
      const assembling = true;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        let baseVx = (p.nx - p.x) / 12;
        let baseVy = (p.ny - p.y) / 12;

        const dx = mx - p.x;
        const dy = my - p.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < thicknessSquared * 5 && distSq > 0.1) {
          const angle = Math.atan2(dy, dx);
          let force = thicknessSquared / distSq;
          if (force > 10) force = 10;

          const forceX = force * Math.cos(angle);
          const forceY = force * Math.sin(angle);

          const springX = (p.ox - p.x) * 0.08;
          const springY = (p.oy - p.y) * 0.08;

          baseVx += (-forceX * 1.2 + springX);
          baseVy += (-forceY * 1.2 + springY);
        }

        p.vx = baseVx;
        p.vy = baseVy;
        p.x += p.vx;
        p.y += p.vy;

        if (p.opacity < 1) {
          p.opacity += 0.025;
          if (p.opacity > 1) p.opacity = 1;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.color},${p.opacity})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    }

    animate();

    let resizeTimer: ReturnType<typeof setTimeout>;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 100);
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    }

    function onMouseLeave() {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    }

    window.addEventListener('resize', onResize);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);

    return () => {
      cancelAnimationFrame(animRef.current);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [sampleText, buildParticles, mouseRadius]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        display: 'block',
        ...style,
      }}
    />
  );
}
