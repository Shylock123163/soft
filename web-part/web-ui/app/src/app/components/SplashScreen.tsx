import { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { SplashScene } from '@/components/scene/SplashScene';
import { useSplashStore } from '@/stores/splashStore';

export function SplashScreen() {
  const phase = useSplashStore((s) => s.phase);
  const setPhase = useSplashStore((s) => s.setPhase);
  const setSplashDone = useSplashStore((s) => s.setSplashDone);
  const [whiteOut, setWhiteOut] = useState(false);

  const handleEnter = useCallback(() => {
    if (phase !== 'door') return;
    setPhase('entering');
    setTimeout(() => setWhiteOut(true), 300);
    setTimeout(() => setSplashDone(), 1500);
  }, [phase, setPhase, setSplashDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') handleEnter();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleEnter]);

  return (
    <div className="splash-container">
      <Canvas
        className="splash-canvas"
        camera={{ fov: 50, near: 0.1, far: 200 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: 'default' }}
      >
        <SplashScene />
      </Canvas>

      <div className={`splash-overlay ${phase === 'flying' || phase === 'door' || phase === 'entering' ? 'fade-out' : ''}`}>
        {phase === 'loading' && (
          <>
            <h1 className="splash-title">OpenClaw 智能监控室</h1>
            <div className="splash-loader" />
          </>
        )}
      </div>

      {phase === 'door' && (
        <button className="splash-enter" onClick={handleEnter}>
          点 击 进 入
        </button>
      )}

      <div className={`splash-white ${whiteOut ? 'active' : ''}`} />
    </div>
  );
}
