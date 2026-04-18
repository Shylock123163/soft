import { useState } from 'react';
import { sendOpenClawChat } from '@/lib/api/openclaw';
import { initialAssistantText } from '@/app/constants';
import type { ChatItem, ResponseMeta } from '@/app/types';
import { emptyResponseMeta } from '@/app/types';

export function useOpenClawChat() {
  const [sessionId, setSessionId] = useState(`openclaw-${Date.now().toString(36)}`);
  const [chatMode, setChatMode] = useState<'assistant' | 'control'>('assistant');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatItems, setChatItems] = useState<ChatItem[]>([
    { role: 'assistant', text: initialAssistantText },
  ]);
  const [responseMeta, setResponseMeta] = useState<ResponseMeta>(emptyResponseMeta);
  const [currentTask, setCurrentTask] = useState('帮我找沙发底下的遥控器，夹到后退出并停在用户前方');
  const [taskStage, setTaskStage] = useState('等待服务状态同步');
  const [sendError, setSendError] = useState('');

  function resetSession() {
    const next = `openclaw-${Date.now().toString(36)}`;
    setSessionId(next);
    setChatItems([{ role: 'assistant', text: initialAssistantText }]);
    setResponseMeta(emptyResponseMeta);
    setTaskStage('新会话已创建 / 等待任务');
    setSendError('');
  }

  async function handleSendChat(
    message: string,
    context: Record<string, unknown>,
  ) {
    const trimmed = message.trim();
    if (!trimmed || chatBusy) return;

    const userItem: ChatItem = { role: 'user', text: trimmed };
    const nextHistory = [...chatItems, userItem];
    setChatItems(nextHistory);
    setCurrentTask(trimmed);
    setChatBusy(true);
    setSendError('');
    setTaskStage('任务已提交 / 等待返回');

    try {
      const data = await sendOpenClawChat({
        sessionId,
        chatMode,
        message: trimmed,
        history: nextHistory.map((item) => ({
          role: item.role === 'system' ? 'assistant' : item.role,
          content: item.text,
        })),
        context,
      });

      setResponseMeta({
        aiSource: data.aiSource || 'unknown',
        reason: data.reason || 'unknown',
        commands: data.devicePlan?.commands || [],
        memoryNotes: data.memoryNotes || [],
        fallback: Boolean(data.fallback),
      });
      setChatItems((prev) => [...prev, { role: 'assistant', text: data.reply }]);
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.chatMode) setChatMode(data.chatMode);
      setTaskStage(
        data.deviceExecution?.ok
          ? '任务已下发 / 等待设备执行'
          : data.fallback
            ? '任务已回复 / 当前为 fallback'
            : '任务已回复 / 等待后续动作',
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : '请求失败';
      setSendError(msg);
      setTaskStage('任务发送失败');
      setChatItems((prev) => [
        ...prev,
        { role: 'system', text: `后端暂时不可用：${msg}` },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  return {
    sessionId,
    chatMode,
    setChatMode,
    chatBusy,
    chatItems,
    responseMeta,
    currentTask,
    setCurrentTask,
    taskStage,
    setTaskStage,
    sendError,
    resetSession,
    handleSendChat,
  };
}
