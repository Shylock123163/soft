import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';

const RobotScene = lazy(() =>
  import('@/components/scene/RobotScene').then((module) => ({ default: module.RobotScene }))
);

class SceneErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('RobotScene failed to render:', error);
  }

  render() {
    if (this.state.hasError) {
      return <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#9cf6ff', fontSize: 14 }}>WebGL 不可用，对话功能不受影响</div>;
    }
    return this.props.children;
  }
}

export function ScenePanel() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 200);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <SceneErrorBoundary>
      {ready ? (
        <Suspense fallback={<div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#9cf6ff', fontSize: 13 }}>加载中…</div>}>
          <RobotScene />
        </Suspense>
      ) : null}
    </SceneErrorBoundary>
  );
}
