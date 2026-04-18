import { useEffect } from 'react';
import { useRobotStore } from '@/stores/robotStore';
import { useOpenClawStatus } from '@/app/hooks/useOpenClawStatus';
import { useOpenClawChat } from '@/app/hooks/useOpenClawChat';
import { ChatHistory } from '@/app/components/ChatHistory';
import { ScenePanel } from '@/app/components/ScenePanel';

export function App() {
  const { targetLabel, chassisMode, gripMode, sensorHealth } = useRobotStore();

  const { serviceStatus, statusError, setStatusError, defaultChatMode } =
    useOpenClawStatus();

  const chat = useOpenClawChat();

  useEffect(() => {
    if (defaultChatMode) chat.setChatMode(defaultChatMode);
  }, [defaultChatMode]);

  useEffect(() => {
    if (serviceStatus) {
      chat.setTaskStage(
        serviceStatus.deviceConnected
          ? 'OpenClaw 在线 / 等待任务'
          : 'OpenClaw 在线 / 设备未连接',
      );
    } else if (statusError) {
      chat.setTaskStage('OpenClaw 状态异常');
    }
  }, [serviceStatus, statusError]);

  function handleSend() {
    chat.handleSendChat(chat.currentTask, {
      robot: '智能巡拢家居机器人',
      target: targetLabel,
      chassisMode,
      gripMode,
      sensorHealth,
    });
    setStatusError('');
  }

  return (
    <div className="app-shell">
      <div className="app-bg" />
      <div className="main-layout">
        <div className="robot-panel">
          <div className="robot-panel-header">
            <div className="robot-panel-title">OpenClaw 监控室</div>
            <div className="status-bar">
              <div className="status-indicator">
                <span className={`status-dot ${serviceStatus ? 'online' : 'offline'}`} />
                <span>{statusError || (serviceStatus ? '已连接' : '连接中')}</span>
              </div>
              <div className="status-metrics">
                <div className="metric"><span>阶段</span><strong>{chat.taskStage}</strong></div>
                <div className="metric"><span>目标</span><strong>{targetLabel}</strong></div>
                <div className="metric"><span>状态</span><strong>{chat.chatBusy ? '处理中' : '待命'}</strong></div>
              </div>
            </div>
          </div>
          <div className="scene-container">
            <ScenePanel />
          </div>
        </div>

        <div className="chat-panel">
          <div className="chat-header">
            <span className="chat-title">OpenClaw</span>
            <div className="chat-status">
              <span className={`status-dot ${serviceStatus ? 'online' : 'offline'}`} />
              <span>{statusError || chat.taskStage}</span>
            </div>
            <div className="chat-toolbar">
              <span className="session-chip">{chat.sessionId.slice(-8)}</span>
              <button className="mode-toggle" type="button" onClick={() => chat.setChatMode(chat.chatMode === 'assistant' ? 'control' : 'assistant')}>
                {chat.chatMode === 'assistant' ? '助手' : '控制'}
              </button>
              <button className="reset-btn" type="button" onClick={chat.resetSession}>重置</button>
            </div>
          </div>

          <ChatHistory chatItems={chat.chatItems} />

          <div className="chat-input-bar">
            <textarea
              className="chat-textarea"
              value={chat.currentTask}
              onChange={(e) => chat.setCurrentTask(e.target.value)}
              placeholder="输入任务，例如：帮我找沙发底下的遥控器"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button className="send-btn" type="button" onClick={handleSend} disabled={chat.chatBusy}>
              {chat.chatBusy ? '分析中…' : '发送'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
