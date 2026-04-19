import { Link } from 'react-router-dom';
import { Monitor, MessageSquare, Info, ChevronDown } from 'lucide-react';
import { TiltCard } from '@/app/components/TiltCard';
import { ParticleText } from '@/app/components/ParticleText';
import '@/styles/home.css';

const features = [
  { to: '/monitor', icon: Monitor, title: '监控室', desc: '3D 设备视图与实时状态' },
  { to: '/chat', icon: MessageSquare, title: '智能对话', desc: '自然语言任务下发' },
  { to: '/about', icon: Info, title: '关于项目', desc: '技术栈与设计说明' },
];

export function HomePage() {
  const bgUrl = `${import.meta.env.BASE_URL}preview.jpg`;
  const robotUrl = `${import.meta.env.BASE_URL}robot.jpg`;

  return (
    <div className="home">
      {/* Hero */}
      <section className="parallax-section">
        <div className="parallax-bg" style={{ backgroundImage: `url(${bgUrl})` }} />
        <div className="parallax-depth-layer" />
        <div className="parallax-content">
          <div className="hero-inner">
            <div className="hero-badge">SMART TERMINAL</div>
            <div className="hero-particle-wrap">
              <ParticleText
                text="暗域捕手"
                fontSize={130}
                particleSize={1.4}
                gap={3}
                mouseRadius={80}
                color="#ffffff"
                className="hero-particle-canvas"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <p className="hero-subtitle">
              基于云服务器的智能终端 — 面向床底、沙发底、柜底低矮空间的寻物取物平台
            </p>
            <Link to="/monitor" className="hero-cta">
              <span className="hero-cta-text">进入监控室</span>
              <span className="hero-cta-glow" />
            </Link>
          </div>
        </div>
        <div className="scroll-hint"><ChevronDown size={24} /></div>
      </section>

      {/* Features */}
      <section className="parallax-section" style={{ minHeight: 'auto', padding: '80px 0' }}>
        <div className="parallax-content">
          <div className="feature-grid">
            {features.map(({ to, icon: Icon, title, desc }, i) => (
              <TiltCard key={to} className={`feature-card-3d delay-${i}`} intensity={12}>
                <Link to={to} className="feature-card-inner">
                  <div className="feature-icon-wrap">
                    <Icon size={28} />
                    <div className="feature-icon-ring" />
                  </div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                  <div className="feature-shine" />
                </Link>
              </TiltCard>
            ))}
          </div>
        </div>
      </section>

      {/* Flip Card */}
      <section className="parallax-section">
        <div className="parallax-bg" style={{ backgroundImage: `url(${bgUrl})`, backgroundPosition: 'bottom' }} />
        <div className="parallax-depth-layer" />
        <div className="parallax-content">
          <div className="flip-container">
            <div className="flip-card">
              <div className="flip-front">
                <img src={robotUrl} alt="机器人" />
                <h3>暗域捕手</h3>
                <div className="flip-front-glow" />
              </div>
              <div className="flip-back">
                <h3>核心参数</h3>
                <p>底盘：低姿态巡航模式</p>
                <p>夹持：V 型夹持机构</p>
                <p>传感：激光测距 + 补光</p>
                <p>通信：WiFi + 串口桥接</p>
                <p>上层：云端任务理解</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ring Entry */}
      <section className="parallax-section ring-section">
        <div className="ring-scene">
          <div className="ring-wrap">
            <div className="ring ring-glow" />
            <div className="ring ring-glow" />
            <div className="ring ring-glow" />
            <Link to="/monitor" className="ring-center">
              <span>进入监控室</span>
              <div className="ring-center-pulse" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
