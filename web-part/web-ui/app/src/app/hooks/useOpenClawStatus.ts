import { useEffect, useState } from 'react';
import { fetchOpenClawStatus, type OpenClawStatus } from '@/lib/api/openclaw';

export function useOpenClawStatus(intervalMs = 15000) {
  const [serviceStatus, setServiceStatus] = useState<OpenClawStatus | null>(null);
  const [statusError, setStatusError] = useState('');
  const [defaultChatMode, setDefaultChatMode] = useState<'assistant' | 'control' | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStatus() {
      try {
        const data = await fetchOpenClawStatus(controller.signal);
        setServiceStatus(data);
        setStatusError('');
        if (data.defaultChatMode) {
          setDefaultChatMode(data.defaultChatMode);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setStatusError(error instanceof Error ? error.message : '状态获取失败');
      }
    }

    loadStatus();
    const timer = window.setInterval(loadStatus, intervalMs);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [intervalMs]);

  return { serviceStatus, statusError, setStatusError, defaultChatMode };
}
