import { taskSuggestions } from '@/app/constants';

type Props = {
  currentTask: string;
  sessionId: string;
  chatMode: 'assistant' | 'control';
  chatBusy: boolean;
  onChangeTask: (task: string) => void;
  onChangeChatMode: (mode: 'assistant' | 'control') => void;
  onSend: () => void;
  onResetSession: () => void;
};

export function TaskInput({
  currentTask,
  sessionId,
  chatMode,
  chatBusy,
  onChangeTask,
  onChangeChatMode,
  onSend,
  onResetSession,
}: Props) {
  return (
    <section className="panel">
      <div className="panel-title">任务输入</div>
      <div className="panel-subtitle">
        这里不是直接控电机，而是给暗域捕手下达高层任务。
      </div>
      <div className="task-toolbar">
        <div className="session-chip">会话 {sessionId.slice(-8)}</div>
        <button className="secondary-button" type="button" onClick={onResetSession}>
          新会话
        </button>
      </div>
      <div className="task-box">
        <textarea
          className="task-input-display task-editor"
          value={currentTask}
          onChange={(e) => onChangeTask(e.target.value)}
          placeholder="例如：帮我找沙发底下的遥控器，夹到后退出并停在用户前方"
        />
        <button className="primary-button" type="button" onClick={onSend} disabled={chatBusy}>
          {chatBusy ? '分析中…' : '发送任务'}
        </button>
      </div>
      <div className="mode-row">
        <button
          className={`mode-button ${chatMode === 'assistant' ? 'is-active' : ''}`}
          type="button"
          onClick={() => onChangeChatMode('assistant')}
        >
          助手模式
        </button>
        <button
          className={`mode-button ${chatMode === 'control' ? 'is-active' : ''}`}
          type="button"
          onClick={() => onChangeChatMode('control')}
        >
          控制模式
        </button>
      </div>
      <div className="quick-actions">
        {taskSuggestions.map((item) => (
          <button className="ghost-button" key={item} type="button" onClick={() => onChangeTask(item)}>
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}
