import { create } from 'zustand';

type RobotState = {
  statusSummary: string;
  targetLabel: string;
  chassisMode: string;
  gripMode: string;
  sensorHealth: string;
  openClawRole: string;
  missionStatement: string;
  update: (partial: Partial<Omit<RobotState, 'update'>>) => void;
};

export const useRobotStore = create<RobotState>((set) => ({
  statusSummary:
    '当前网页承担暗域捕手任务入口、状态解释与执行编排中枢，底层仍由上位机桥接到 STM32 执行。',
  targetLabel: '遥控器 / 待确认',
  chassisMode: '低姿态巡航',
  gripMode: 'V 型夹持待命',
  sensorHealth: '激光测距 / 补光正常',
  openClawRole: '高层任务理解 + 抓取策略生成 + 决策解释',
  missionStatement: '让机器人从"会动会夹"升级为"会理解任务并闭环取物"',
  update: (partial) => set(partial),
}));
