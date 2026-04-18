import { getOpenClawApiBase } from '@/lib/api/endpoints';

export type OpenClawStatus = {
  ok: boolean;
  service: string;
  uptimeSec: number;
  provider: string;
  endpoint: string;
  hasServerApiKey: boolean;
  executorMode?: string;
  deviceApiConfigured?: boolean;
  autoExecute?: boolean;
  deviceId?: string;
  deviceConnected?: boolean;
  deviceLastSeenAt?: string | null;
  pendingDeviceCommands?: number;
  activeSessions?: number;
  defaultChatMode?: 'assistant' | 'control';
};

export type OpenClawChatResponse = {
  ok: boolean;
  reply: string;
  actions?: Array<Record<string, unknown>>;
  reason?: string;
  fallback?: boolean;
  aiSource?: string;
  fallbackReason?: string | null;
  devicePlan?: {
    commands?: string[];
  };
  deviceExecution?: {
    ok?: boolean;
  } | null;
  sessionId?: string;
  chatMode?: 'assistant' | 'control';
  memoryNotes?: string[];
};

export async function fetchOpenClawStatus(signal?: AbortSignal) {
  const response = await fetch(`${getOpenClawApiBase()}/status`, { signal });
  if (!response.ok) {
    throw new Error(`OpenClaw status request failed: ${response.status}`);
  }
  return (await response.json()) as OpenClawStatus;
}

export async function sendOpenClawChat(payload: {
  sessionId: string;
  chatMode: 'assistant' | 'control';
  message: string;
  history: Array<{ role: string; content: string }>;
  context?: Record<string, unknown>;
}) {
  const response = await fetch(`${getOpenClawApiBase()}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`OpenClaw chat request failed: ${response.status}`);
  }

  return (await response.json()) as OpenClawChatResponse;
}
