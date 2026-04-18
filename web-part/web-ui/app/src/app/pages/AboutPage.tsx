import { Bot, Code, Cpu, Globe, Layers, Zap } from 'lucide-react';
import '@/styles/about.css';

const techStack = [
  { icon: Code, label: 'React 18 + TypeScript' },
  { icon: Layers, label: 'Vite 5' },
  { icon: Cpu, label: 'Three.js / R3F' },
  { icon: Zap, label: 'Framer Motion' },
  { icon: Bot, label: 'Zustand' },
  { icon: Globe, label: 'Cloudflare R2' },
];

export function AboutPage() {
  const bgUrl = `${import.meta.env.BASE_URL}robot.jpg`;

  return (
    <div className="about-page">
      <main className="about-main">
        <section className="about-section">
          <div className="about-info-card">
            <img src={bgUrl} alt="机器人" />
            <div>
              <h3>暗域捕手</h3>
              <p>基于云服务器的智能终端 · 低矮空间寻物取物平台</p>
            </div>
          </div>
        </section>

        <section className="about-section">
          <h2>项目简介</h2>
          <p>
            本项目面向床底、沙发底、柜底等低矮黑暗空间，专门执行遗落物发现、识别、靠近、夹取、退出的全流程。
            网页作为上层任务中枢，承担任务输入、决策解释、状态可视化与调试功能。
          </p>
          <p>
            系统不直接控制电机，而是负责高层任务理解、操作策略生成、任务阶段切换、动作原因解释和多轮交互记忆。
            上位机将策略拆解为视觉/运动/夹持步骤，由 STM32 执行底层动作。
          </p>
        </section>

        <section className="about-section">
          <h2>技术栈</h2>
          <div className="tech-grid">
            {techStack.map(({ icon: Icon, label }) => (
              <div className="tech-item" key={label}>
                <Icon size={16} />
                {label}
              </div>
            ))}
          </div>
        </section>

        <section className="about-section">
          <h2>系统架构</h2>
          <p>用户网页输入任务 → 云端理解任务 → 生成执行策略 → 上位机拆解步骤 → STM32 执行动作 → 网页实时显示状态与结果</p>
        </section>

        <section className="about-section">
          <h2>设计说明</h2>
          <p>
            UI 风格采用暗色毛玻璃 + 新拟态设计，灵感来源于游戏 HUD 界面。
            两色系统（暗透明 + 浅灰白）贯穿全站，配合 backdrop-filter 实现科幻监控室质感。
            3D 机器人模型使用 react-three-fiber 程序化构建，支持轨道控制交互。
          </p>
        </section>
      </main>
    </div>
  );
}
