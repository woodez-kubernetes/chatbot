import { useChat } from '../../hooks/useChat';
import MessageList from '../MessageList/MessageList';
import InputArea from '../InputArea/InputArea';
import styles from './ChatContainer.module.css';

function ChatContainer() {
  const { messages, isLoading, sendUserMessage, clearMessages } = useChat();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Chat with Woodez Smart Bot</h1>
        {messages.length > 0 && (
          <button onClick={clearMessages} className={styles.clearButton}>
            Clear Chat
          </button>
        )}
      </header>
      <MessageList messages={messages} isLoading={isLoading} />
      <InputArea onSend={sendUserMessage} isLoading={isLoading} />
    </div>
  );
}

export default ChatContainer;
