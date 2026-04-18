import { useEffect } from 'react';
import { Bot, Send, RotateCcw } from 'lucide-react';
import { useRobotStore } from '@/stores/robotStore';
import { useOpenClawStatus } from '@/app/hooks/useOpenClawStatus';
import { useOpenClawChat } from '@/app/hooks/useOpenClawChat';
import { ChatHistory } from '@/app/components/ChatHistory';
import { taskSuggestions } from '@/app/constants';
import '@/styles/chat.css';

export function ChatPage() {
  const { targetLabel, chassisMode, gripMode, sensorHealth } = useRobotStore();
  const { serviceStatus, statusError, setStatusError, defaultChatMode } = useOpenClawStatus();
  const chat = useOpenClawChat();

  useEffect(() => {
    if (defaultChatMode) chat.setChatMode(defaultChatMode);
  }, [defaultChatMode]);

  useEffect(() => {
    if (serviceStatus) {
      chat.setTaskStage(serviceStatus.deviceConnected ? '在线 / 等待任务' : '在线 / 设备未连接');
    } else if (statusError) {
      chat.setTaskStage('状态异常');
    }
  }, [serviceStatus, statusError]);

  function handleSend() {
    chat.handleSendChat(chat.currentTask, {
      robot: '智能巡拢家居机器人', target: targetLabel, chassisMode, gripMode, sensorHealth,
    });
    setStatusError('');
  }

  return (
    <div className="chat-page">
      <div className="chat-body">
        <div className="chat-main">
          <div className="chat-header">
            <Bot size={18} />
            <span className="chat-title">暗域捕手</span>
            <div className="chat-status">
              <span className={`status-dot ${serviceStatus ? 'online' : ''}`} />
              <span>{statusError || chat.taskStage}</span>
            </div>
            <div className="chat-toolbar">
              <span className="session-chip">{chat.sessionId.slice(-8)}</span>
              <button className="mode-toggle" type="button"
                onClick={() => chat.setChatMode(chat.chatMode === 'assistant' ? 'control' : 'assistant')}>
                {chat.chatMode === 'assistant' ? '助手' : '控制'}
              </button>
              <button className="reset-btn" type="button" onClick={chat.resetSession}>
                <RotateCcw size={13} />
              </button>
            </div>
          </div>
          <ChatHistory chatItems={chat.chatItems} />
          <div className="chat-input-bar">
            <textarea
              className="chat-textarea"
              value={chat.currentTask}
              onChange={(e) => chat.setCurrentTask(e.target.value)}
              placeholder="输入任务，例如：帮我找沙发底下的遥控器"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <button className="send-btn" type="button" onClick={handleSend} disabled={chat.chatBusy}>
              <Send size={16} />
            </button>
          </div>
        </div>
        <aside className="chat-quick">
          <div className="chat-quick-title">快捷任务</div>
          {taskSuggestions.map((s) => (
            <button className="quick-card" key={s} type="button" onClick={() => chat.setCurrentTask(s)}>{s}</button>
          ))}
        </aside>
      </div>
    </div>
  );
}
