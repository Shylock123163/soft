import { create } from 'zustand';

type SplashPhase = 'loading' | 'flying' | 'door' | 'entering' | 'done';

type SplashState = {
  phase: SplashPhase;
  done: boolean;
  setPhase: (phase: SplashPhase) => void;
  setSplashDone: () => void;
};

export const useSplashStore = create<SplashState>((set) => ({
  phase: 'loading',
  done: false,
  setPhase: (phase) => set({ phase, done: phase === 'done' }),
  setSplashDone: () => set({ phase: 'done', done: true }),
}));
