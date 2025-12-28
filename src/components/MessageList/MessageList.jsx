import { useEffect, useRef } from 'react';
import Message from '../Message/Message';
import LoadingIndicator from '../LoadingIndicator/LoadingIndicator';
import styles from './MessageList.module.css';

function MessageList({ messages, isLoading }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className={styles.container}>
      {messages.length === 0 && !isLoading && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Start a conversation</p>
          <p className={styles.emptySubtitle}>
            Type a message below to chat with the AI
          </p>
        </div>
      )}
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
      {isLoading && <LoadingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}

export default MessageList;
