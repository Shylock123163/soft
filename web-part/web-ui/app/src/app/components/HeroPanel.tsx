type Props = {
  currentTask: string;
  taskStage: string;
  targetLabel: string;
  sourceLabel: string;
  robotImageUrl: string;
};

export function HeroPanel({ currentTask, taskStage, targetLabel, sourceLabel, robotImageUrl }: Props) {
  return (
    <section className="hero-panel panel">
      <div className="eyebrow">暗域捕手 · 任务控制台</div>
      <div className="hero-grid">
        <div className="hero-copy">
          <h1>暗域捕手</h1>
          <p className="hero-subtitle">
            面向床底、沙发底、柜底的低矮空间寻物取物平台。网页作为上层任务中枢，
            用来输入任务、解释决策、观察执行并持续调试。
          </p>
          <div className="hero-metrics">
            <div className="metric-card">
              <span className="metric-label">当前任务</span>
              <strong>{currentTask}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">任务阶段</span>
              <strong>{taskStage}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">目标物</span>
              <strong>{targetLabel}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">服务状态</span>
              <strong>{sourceLabel}</strong>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <img src={robotImageUrl} alt="暗域捕手外观图" />
          <div className="image-tag">当前设备视觉锚点 / robot.jpg</div>
        </div>
      </div>
    </section>
  );
}
