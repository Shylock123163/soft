import { Link } from 'react-router-dom';
import { Monitor, MessageSquare, Info, ChevronDown } from 'lucide-react';
import '@/styles/home.css';

const features = [
  { to: '/monitor', icon: Monitor, title: '监控室', desc: '3D 设备视图与实时状态' },
  { to: '/chat', icon: MessageSquare, title: '智能对话', desc: '自然语言任务下发' },
  { to: '/about', icon: Info, title: '关于项目', desc: '技术栈与设计说明' },
];

export function HomePage() {
  const bgUrl = `${import.meta.env.BASE_URL}robot.jpg`;

  return (
    <div className="home">
      {/* Hero */}
      <section className="parallax-section">
        <div className="parallax-bg" style={{ backgroundImage: `url(${bgUrl})` }} />
        <div className="parallax-content">
          <div className="hero-inner">
            <h1 className="hero-title">暗域捕手</h1>
            <p className="hero-subtitle">
              基于云服务器的智能终端 — 面向床底、沙发底、柜底低矮空间的寻物取物平台
            </p>
            <Link to="/monitor" className="feature-card" style={{ maxWidth: 240 }}>
              进入监控室
            </Link>
          </div>
        </div>
        <div className="scroll-hint"><ChevronDown size={24} /></div>
      </section>

      {/* Features */}
      <section className="parallax-section" style={{ minHeight: 'auto', padding: '80px 0' }}>
        <div className="parallax-content">
          <div className="feature-grid">
            {features.map(({ to, icon: Icon, title, desc }) => (
              <Link to={to} className="feature-card" key={to}>
                <Icon size={28} />
                <h3>{title}</h3>
                <p>{desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Flip Card */}
      <section className="parallax-section">
        <div className="parallax-bg" style={{ backgroundImage: `url(${bgUrl})`, backgroundPosition: 'bottom' }} />
        <div className="parallax-content">
          <div className="flip-container">
            <div className="flip-card">
              <div className="flip-front">
                <img src={bgUrl} alt="机器人" />
                <h3>暗域捕手</h3>
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
        <div className="ring-wrap">
          <div className="ring" />
          <div className="ring" />
          <div className="ring" />
          <Link to="/monitor" className="ring-center">进入监控室</Link>
        </div>
      </section>
    </div>
  );
}
