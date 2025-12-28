import styles from './LoadingIndicator.module.css';

function LoadingIndicator() {
  return (
    <div className={styles.container}>
      <div className={styles.bubble}>
        <div className={styles.dots}>
          <span className={styles.dot}></span>
          <span className={styles.dot}></span>
          <span className={styles.dot}></span>
        </div>
      </div>
    </div>
  );
}

export default LoadingIndicator;
