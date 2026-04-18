import type { ChatItem } from '@/app/types';
import { useEffect, useRef } from 'react';

type Props = {
  chatItems: ChatItem[];
};

export function ChatHistory({ chatItems }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatItems.length]);

  return (
    <div className="chat-list">
      {chatItems.map((item, index) => (
        <div className={`chat-item chat-${item.role}`} key={`${item.role}-${index}`}>
          {item.text}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
