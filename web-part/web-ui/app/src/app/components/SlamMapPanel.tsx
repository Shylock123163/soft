import '@/styles/slam.css';

export function SlamMapPanel() {
  return (
    <div className="slam-panel">
      <div className="slam-label">SLAM 室内平面图</div>
      <div className="slam-map">
        <div className="slam-grid" />
        <div className="slam-room">
          <div className="slam-furniture slam-sofa">沙发</div>
          <div className="slam-furniture slam-bed">床</div>
          <div className="slam-furniture slam-cabinet">柜子</div>
          <div className="slam-furniture slam-table">桌子</div>
          <div className="slam-robot" />
        </div>
      </div>
    </div>
  );
}
