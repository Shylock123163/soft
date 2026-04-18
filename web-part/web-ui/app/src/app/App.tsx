import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Animator, Dots, GridLines, MovingLines } from '@arwes/react';
import { fetchOpenClawStatus, sendOpenClawChat, type OpenClawStatus } from '@/lib/api/openclaw';
import { useRobotStore } from '@/stores/robotStore';

const RobotScene = lazy(() =>
  import('@/components/scene/RobotScene').then((module) => ({ default: module.RobotScene }))
);

type ChatItem = {
  role: 'assistant' | 'user' | 'system';
  text: string;
};

type ResponseMeta = {
  aiSource: string;
  reason: string;
  commands: string[];
  memoryNotes: string[];
  fallback: boolean;
};

const initialAssistantText = '你好，我是 OpenClaw 任务中枢。你可以直接告诉我要找什么、怎么夹、夹到后如何退出。';

const taskSuggestions = [
  '帮我找沙发底下的遥控器',
  '优先找钥匙，找不到再继续巡拢',
  '检测到玩具后先推拢再夹取',
  '夹到物品后退出并停在我脚边'
];

const missionPresets = [
  {
    label: '沙发底寻物',
    task: '进入沙发底低速巡拢，优先找遥控器，确认后夹取并退出到用户脚边'
  },
  {
    label: '床底回收',
    task: '沿床底边缘搜索拖鞋或玩具，发现后调整夹角取出并撤回到外侧'
  },
  {
    label: '边角清障',
    task: '先推拢墙角散落物，再逐件夹取到回收区，最后退出等待下一条命令'
  }
];

export function App() {
  const {
    statusSummary,
    targetLabel,
    chassisMode,
    gripMode,
    sensorHealth,
    openClawRole,
    missionStatement
  } = useRobotStore();

  const [currentTask, setCurrentTask] = useState('帮我找沙发底下的遥控器，夹到后退出并停在用户前方');
  const [taskStage, setTaskStage] = useState('等待 OpenClaw 状态同步');
  const [chatMode, setChatMode] = useState<'assistant' | 'control'>('assistant');
  const [sessionId, setSessionId] = useState(`openclaw-${Date.now().toString(36)}`);
  const [serviceStatus, setServiceStatus] = useState<OpenClawStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [responseMeta, setResponseMeta] = useState<ResponseMeta>({
    aiSource: 'pending',
    reason: 'waiting',
    commands: [],
    memoryNotes: [],
    fallback: false
  });
  const [chatItems, setChatItems] = useState<ChatItem[]>([
    {
      role: 'assistant',
      text: initialAssistantText
    }
  ]);

  const eventLog = useMemo(() => {
    const dynamic = [
      serviceStatus?.deviceConnected ? '设备已连接到 OpenClaw 队列' : '设备暂未连接到 OpenClaw 队列',
      `当前模式：${chatMode === 'assistant' ? '助手模式' : '控制模式'}`,
      serviceStatus?.hasServerApiKey ? '服务器上游鉴权已配置' : '服务器上游鉴权尚未配置',
      serviceStatus?.executorMode ? `执行模式：${serviceStatus.executorMode}` : '执行模式待检测',
      `最近回复来源：${responseMeta.aiSource === 'upstream' ? '上游模型' : responseMeta.aiSource === 'pending' ? '等待中' : responseMeta.aiSource}`
    ];
    return dynamic;
  }, [chatMode, responseMeta.aiSource, serviceStatus]);

  const missionFlow = useMemo(
    () => [
      {
        title: '任务理解',
        state: chatBusy ? '处理中' : '待命',
        detail: '从自然语言目标生成搜寻与夹取策略'
      },
      {
        title: '视觉搜寻',
        state: serviceStatus?.deviceConnected ? '可进入' : '设备未连接',
        detail: '进入床底/沙发底 ROI，等待目标稳定出现'
      },
      {
        title: '抓取执行',
        state: responseMeta.commands.length ? `预览 ${responseMeta.commands.length} 条命令` : '等待策略',
        detail: responseMeta.commands.length ? responseMeta.commands.join(' / ') : '尚未生成设备命令'
      },
      {
        title: '退出回收',
        state: taskStage,
        detail: '夹到目标后退出低矮空间并回到用户可取位置'
      }
    ],
    [chatBusy, responseMeta.commands, serviceStatus?.deviceConnected, taskStage]
  );

  const environmentCards = useMemo(
    () => [
      {
        label: '底盘姿态',
        text: `${chassisMode}，需要优先保证通过性与低矮空间机身余量`
      },
      {
        label: '夹持策略',
        text: `${gripMode}，更适合先对准中心线再闭合夹取`
      },
      {
        label: '传感器约束',
        text: `${sensorHealth}，进深搜索时要先保留安全退路`
      }
    ],
    [chassisMode, gripMode, sensorHealth]
  );

  const nextAction = serviceStatus?.deviceConnected
    ? '设备在线，可继续下发高层任务并等待视觉 / 夹持执行反馈'
    : '先让 OpenClaw 在线并拉起设备队列，再进入真实夹取闭环';

  const cameraOnline = serviceStatus?.deviceConnected ?? false;
  const sourceLabel = statusError
    ? '后端异常'
    : serviceStatus
      ? '服务已接通'
      : '检测中';
  const connectionSummary = serviceStatus
    ? `Provider ${serviceStatus.provider} / ${serviceStatus.endpoint}`
    : statusSummary;
  const robotImageUrl = `${import.meta.env.BASE_URL}robot.jpg`;

  useEffect(() => {
    let disposed = false;

    async function loadStatus() {
      try {
        const data = await fetchOpenClawStatus();
        if (disposed) return;
        setServiceStatus(data);
        setStatusError('');
        if (data.defaultChatMode) {
          setChatMode(data.defaultChatMode);
        }
        setTaskStage(data.deviceConnected ? 'OpenClaw 在线 / 等待任务' : 'OpenClaw 在线 / 设备未连接');
      } catch (error) {
        if (disposed) return;
        setStatusError(error instanceof Error ? error.message : 'OpenClaw 状态获取失败');
        setTaskStage('OpenClaw 状态异常');
      }
    }

    loadStatus();
    const timer = window.setInterval(loadStatus, 15000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, []);

  function resetSession() {
    const nextSessionId = `openclaw-${Date.now().toString(36)}`;
    setSessionId(nextSessionId);
    setChatItems([{ role: 'assistant', text: initialAssistantText }]);
    setResponseMeta({
      aiSource: 'pending',
      reason: 'waiting',
      commands: [],
      memoryNotes: [],
      fallback: false
    });
    setTaskStage('新会话已创建 / 等待任务');
    setStatusError('');
  }

  async function handleSendChat(message: string) {
    const trimmed = message.trim();
    if (!trimmed || chatBusy) return;

    const nextUserItem: ChatItem = { role: 'user', text: trimmed };
    const nextHistory = [...chatItems, nextUserItem];
    setChatItems(nextHistory);
    setCurrentTask(trimmed);
    setChatBusy(true);
    setStatusError('');
    setTaskStage('任务已提交 / 等待 OpenClaw 返回');

    try {
      const data = await sendOpenClawChat({
        sessionId,
        chatMode,
        message: trimmed,
        history: nextHistory.map((item) => ({
          role: item.role === 'system' ? 'assistant' : item.role,
          content: item.text
        })),
        context: {
          robot: '智能巡拢家居机器人',
          target: targetLabel,
          chassisMode,
          gripMode,
          sensorHealth
        }
      });

      setResponseMeta({
        aiSource: data.aiSource || 'unknown',
        reason: data.reason || 'unknown',
        commands: data.devicePlan?.commands || [],
        memoryNotes: data.memoryNotes || [],
        fallback: Boolean(data.fallback)
      });
      setChatItems((prev) => [...prev, { role: 'assistant', text: data.reply }]);
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.chatMode) setChatMode(data.chatMode);
      setTaskStage(
        data.deviceExecution?.ok
          ? '任务已下发 / 等待设备执行'
          : data.fallback
            ? '任务已回复 / 当前为 fallback'
            : '任务已回复 / 等待后续动作'
      );
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'OpenClaw 请求失败';
      setStatusError(messageText);
      setTaskStage('任务发送失败');
      setChatItems((prev) => [
        ...prev,
        {
          role: 'system',
          text: `OpenClaw 后端暂时不可用：${messageText}`
        }
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="app-bg">
        <GridLines lineColor="rgba(80, 214, 255, 0.12)" />
        <Dots color="rgba(88, 233, 196, 0.18)" />
        <MovingLines lineColor="rgba(255, 143, 77, 0.1)" />
      </div>

      <Animator active combine manager="stagger">
        <main className="dashboard">
          <section className="hero-panel panel">
            <div className="eyebrow">OpenClaw Mission Console</div>
            <div className="hero-grid">
              <div className="hero-copy">
                <h1>智能巡拢家居机器人</h1>
                <p className="hero-subtitle">
                  面向床底、沙发底、柜底的低矮空间寻物取物平台。网页不是演示层，
                  而是 OpenClaw 的上层任务中枢，用来输入任务、解释决策、观察执行并持续调试。
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
                    <span className="metric-label">OpenClaw 状态</span>
                    <strong>{sourceLabel}</strong>
                  </div>
                </div>
              </div>

              <div className="hero-visual">
                <img src={robotImageUrl} alt="智能巡拢家居机器人外观图" />
                <div className="image-tag">当前设备视觉锚点 / robot.jpg</div>
              </div>
            </div>
          </section>

          <section className="ops-strip panel">
            <div className="ops-grid">
              <div className="ops-column">
                <div className="panel-title">任务模板</div>
                <div className="preset-list">
                  {missionPresets.map((preset) => (
                    <button
                      className="preset-card"
                      key={preset.label}
                      type="button"
                      onClick={() => setCurrentTask(preset.task)}
                    >
                      <span>{preset.label}</span>
                      <strong>{preset.task}</strong>
                    </button>
                  ))}
                </div>
              </div>

              <div className="ops-column">
                <div className="panel-title">闭环执行链路</div>
                <div className="flow-list">
                  {missionFlow.map((item) => (
                    <div className="flow-card" key={item.title}>
                      <span>{item.title}</span>
                      <strong>{item.state}</strong>
                      <p>{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ops-column">
                <div className="panel-title">场景约束</div>
                <div className="rule-list">
                  {environmentCards.map((item) => (
                    <div className="rule-card" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.text}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="main-grid">
            <div className="left-column">
              <section className="panel">
                <div className="panel-title">任务输入</div>
                <div className="panel-subtitle">
                  这里不是直接控电机，而是给 OpenClaw 下达高层任务。
                </div>
                <div className="task-toolbar">
                  <div className="session-chip">会话 {sessionId.slice(-8)}</div>
                  <button className="secondary-button" type="button" onClick={resetSession}>
                    新会话
                  </button>
                </div>
                <div className="task-box">
                  <textarea
                    className="task-input-display task-editor"
                    value={currentTask}
                    onChange={(event) => setCurrentTask(event.target.value)}
                    placeholder="例如：帮我找沙发底下的遥控器，夹到后退出并停在用户前方"
                  />
                  <button className="primary-button" type="button" onClick={() => handleSendChat(currentTask)}>
                    {chatBusy ? 'OpenClaw 分析中…' : '发送到 OpenClaw'}
                  </button>
                </div>
                <div className="mode-row">
                  <button
                    className={`mode-button ${chatMode === 'assistant' ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => setChatMode('assistant')}
                  >
                    助手模式
                  </button>
                  <button
                    className={`mode-button ${chatMode === 'control' ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => setChatMode('control')}
                  >
                    控制模式
                  </button>
                </div>
                <div className="quick-actions">
                  {taskSuggestions.map((item) => (
                    <button className="ghost-button" key={item} type="button" onClick={() => setCurrentTask(item)}>
                      {item}
                    </button>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="panel-title">决策解释</div>
                <ul className="decision-list">
                  <li>
                    <span>角色定位</span>
                    <strong>{openClawRole}</strong>
                  </li>
                  <li>
                    <span>下一动作</span>
                    <strong>{nextAction}</strong>
                  </li>
                  <li>
                    <span>系统目标</span>
                    <strong>{missionStatement}</strong>
                  </li>
                  <li>
                    <span>服务链路</span>
                    <strong>{connectionSummary}</strong>
                  </li>
                </ul>
              </section>

              <section className="panel">
                <div className="panel-title">执行预览</div>
                <div className="plan-grid">
                  <div className="plan-card">
                    <span>回复来源</span>
                    <strong>{responseMeta.aiSource}</strong>
                  </div>
                  <div className="plan-card">
                    <span>策略原因</span>
                    <strong>{responseMeta.reason}</strong>
                  </div>
                  <div className="plan-card">
                    <span>当前形态</span>
                    <strong>{responseMeta.fallback ? 'fallback' : '正常链路'}</strong>
                  </div>
                </div>
                <div className="command-section">
                  <div className="command-title">设备命令预览</div>
                  {responseMeta.commands.length ? (
                    <div className="command-list">
                      {responseMeta.commands.map((command) => (
                        <code key={command}>{command}</code>
                      ))}
                    </div>
                  ) : (
                    <div className="plan-empty">当前还没有设备命令预览，先发送一条真实任务。</div>
                  )}
                </div>
                <div className="memory-section">
                  <div className="command-title">记忆注记</div>
                  {responseMeta.memoryNotes.length ? (
                    <div className="memory-list">
                      {responseMeta.memoryNotes.map((note, index) => (
                        <div className="memory-item" key={`${note}-${index}`}>
                          {note}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="plan-empty">当前会话还没有新增记忆注记。</div>
                  )}
                </div>
              </section>

              <section className="panel">
                <div className="panel-title">对话记录</div>
                <div className="chat-list">
                  {chatItems.map((item, index) => (
                    <div className={`chat-item chat-${item.role}`} key={`${item.role}-${index}`}>
                      {item.text}
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="scene-panel panel">
              <div className="panel-title">3D 主视图区</div>
              <div className="panel-subtitle">
                react-three-fiber + drei + postprocessing 承载设备姿态与后续数字孪生。
              </div>
              <div className="scene-wrap">
                <Suspense fallback={<div className="scene-loading">正在加载机器人 3D 主视图区…</div>}>
                  <RobotScene />
                </Suspense>
              </div>
            </section>

            <div className="right-column">
              <section className="panel">
                <div className="panel-title">设备状态</div>
                <div className="status-grid">
                  <div className="status-card">
                    <span>相机链路</span>
                    <strong>{cameraOnline ? '设备在线' : '等待设备'}</strong>
                  </div>
                  <div className="status-card">
                    <span>底盘模式</span>
                    <strong>{chassisMode}</strong>
                  </div>
                  <div className="status-card">
                    <span>夹持状态</span>
                    <strong>{gripMode}</strong>
                  </div>
                  <div className="status-card">
                    <span>传感器健康</span>
                    <strong>{sensorHealth}</strong>
                  </div>
                  <div className="status-card">
                    <span>待执行命令</span>
                    <strong>{serviceStatus?.pendingDeviceCommands ?? '-'}</strong>
                  </div>
                  <div className="status-card">
                    <span>活跃会话</span>
                    <strong>{serviceStatus?.activeSessions ?? '-'}</strong>
                  </div>
                </div>
                <div className="status-summary">{statusError || connectionSummary}</div>
              </section>

              <section className="panel">
                <div className="panel-title">任务日志</div>
                <div className="log-list">
                  {eventLog.map((line) => (
                    <div className="log-line" key={line}>
                      {line}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </main>
      </Animator>
    </div>
  );
}
