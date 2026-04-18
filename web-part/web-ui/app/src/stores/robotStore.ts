import { create } from 'zustand';

type RobotState = {
  currentTask: string;
  taskStage: string;
  statusSummary: string;
  targetLabel: string;
  cameraOnline: boolean;
  chassisMode: string;
  gripMode: string;
  sensorHealth: string;
  nextAction: string;
  openClawRole: string;
  missionStatement: string;
};

export const useRobotStore = create<RobotState>(() => ({
  currentTask: '帮我找沙发底下的遥控器，夹到后退出并停在用户前方',
  taskStage: '目标搜索 / 视觉确认',
  statusSummary:
    '当前网页承担 OpenClaw 任务入口、状态解释与执行编排中枢，底层仍由上位机桥接到 STM32 执行。',
  targetLabel: '遥控器 / 待确认',
  cameraOnline: true,
  chassisMode: '低姿态巡航',
  gripMode: 'V 型夹持待命',
  sensorHealth: '激光测距 / 补光正常',
  nextAction: '进入沙发底 ROI，低速蠕行并等待识别框稳定',
  openClawRole: '高层任务理解 + 抓取策略生成 + 决策解释',
  missionStatement: '让机器人从“会动会夹”升级为“会理解任务并闭环取物”'
}));
