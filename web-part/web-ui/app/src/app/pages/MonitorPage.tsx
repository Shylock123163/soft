import { useState } from 'react';
import { Cpu, GripVertical, Radio, Camera, Wifi, Battery, VideoOff } from 'lucide-react';
import { useRobotStore } from '@/stores/robotStore';
import { useOpenClawStatus } from '@/app/hooks/useOpenClawStatus';
import { ScenePanel } from '@/app/components/ScenePanel';
import '@/styles/monitor.css';

const modules = [
  { id: 'chassis', label: '底盘', icon: Cpu },
  { id: 'gripper', label: '夹持', icon: GripVertical },
  { id: 'sensor', label: '传感器', icon: Radio },
  { id: 'camera', label: '摄像头', icon: Camera },
  { id: 'comm', label: '通信', icon: Wifi },
  { id: 'power', label: '电源', icon: Battery },
];

type ModuleData = Record<string, Array<{ label: string; value: string }>>;

export function MonitorPage() {
  const [active, setActive] = useState('chassis');
  const { chassisMode, gripMode, sensorHealth } = useRobotStore();
  const { serviceStatus } = useOpenClawStatus();

  const data: ModuleData = {
    chassis: [
      { label: '模式', value: chassisMode },
      { label: '姿态', value: '低矮巡航' },
      { label: '速度', value: '0.3 m/s' },
      { label: '通过高度', value: '≤ 12cm' },
    ],
    gripper: [
      { label: '模式', value: gripMode },
      { label: '开合角度', value: '0° - 90°' },
      { label: '夹持力', value: '中等' },
      { label: '状态', value: '待命' },
    ],
    sensor: [
      { label: '健康', value: sensorHealth },
      { label: '激光测距', value: '正常' },
      { label: '补光灯', value: '自动' },
      { label: '红外', value: '就绪' },
    ],
    camera: [
      { label: '链路', value: serviceStatus?.deviceConnected ? '在线' : '离线' },
      { label: '分辨率', value: '640×480' },
      { label: '帧率', value: '30fps' },
      { label: '模式', value: '目标检测' },
    ],
    comm: [
      { label: 'WiFi', value: '已连接' },
      { label: '串口', value: 'ttyUSB0' },
      { label: '上游', value: serviceStatus?.provider || '未配置' },
      { label: '延迟', value: '< 50ms' },
    ],
    power: [
      { label: '电量', value: '78%' },
      { label: '电压', value: '11.8V' },
      { label: '续航', value: '~45min' },
      { label: '充电', value: '未充电' },
    ],
  };

  return (
    <div className="monitor-page">
      <aside className="monitor-sidebar">
        {modules.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`monitor-sidebar-item ${active === id ? 'active' : ''}`}
            type="button"
            onClick={() => setActive(id)}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </aside>
      <div className="monitor-content">
        <div className="monitor-header">{modules.find(m => m.id === active)?.label} 状态</div>
        <div className="monitor-views">
          <div className="monitor-camera">
            <div className="camera-label"><Camera size={14} /> 摄像头图传</div>
            <div className="camera-feed">
              <video
                className="camera-video"
                src={`${import.meta.env.BASE_URL}demo-feed.mp4`}
                autoPlay
                loop
                muted
                playsInline
              />
              <div className="camera-overlay">
                <VideoOff size={32} />
                <span>等待视频源接入</span>
              </div>
            </div>
          </div>
          <div className="monitor-scene">
            <ScenePanel />
          </div>
        </div>
        <div className="monitor-detail">
          <table className="status-table">
            <thead>
              <tr>
                <th>参数</th>
                <th>值</th>
              </tr>
            </thead>
            <tbody>
              {(data[active] || []).map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}