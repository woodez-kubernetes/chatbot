import styles from './Message.module.css';

function Message({ message }) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`${styles.container} ${isUser ? styles.user : styles.assistant}`}
    >
      <div
        className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble} ${message.isError ? styles.errorBubble : ''}`}
      >
        <p className={styles.content}>{message.content}</p>
      </div>
    </div>
  );
}

export default Message;
