export const initialAssistantText =
  '你好，我是暗域捕手任务中枢。你可以直接告诉我要找什么、怎么夹、夹到后如何退出。';

export const taskSuggestions = [
  '帮我找沙发底下的遥控器',
  '优先找钥匙，找不到再继续巡拢',
  '检测到玩具后先推拢再夹取',
  '夹到物品后退出并停在我脚边',
];

export const missionPresets = [
  {
    label: '沙发底寻物',
    task: '进入沙发底低速巡拢，优先找遥控器，确认后夹取并退出到用户脚边',
  },
  {
    label: '床底回收',
    task: '沿床底边缘搜索拖鞋或玩具，发现后调整夹角取出并撤回到外侧',
  },
  {
    label: '边角清障',
    task: '先推拢墙角散落物，再逐件夹取到回收区，最后退出等待下一条命令',
  },
];
