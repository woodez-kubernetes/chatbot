import styles from './Message.module.css';

function Message({ message }) {
  const isUser = message.role === 'user';

  // Helper to render stock price card
  const renderStockCard = (data) => {
    if (!data || data.error) return null;

    // Handle historical price data (has history array)
    if (data.history && Array.isArray(data.history) && data.history.length > 0) {
      const history = data.history;
      const prices = history.map(h => h.close);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const priceRange = maxPrice - minPrice;

      // Calculate price change
      const firstPrice = history[0].close;
      const lastPrice = history[history.length - 1].close;
      const priceChange = lastPrice - firstPrice;
      const percentChange = ((priceChange / firstPrice) * 100);
      const isPositive = priceChange > 0;

      return (
        <div className={styles.historyCard}>
          <div className={styles.historyHeader}>
            <span className={styles.symbol}>{data.symbol}</span>
            <span className={styles.period}>{data.period} • {data.data_points} points</span>
          </div>

          <div className={styles.priceInfo}>
            <div>
              <div className={styles.priceLabel}>Current</div>
              <div className={styles.currentPrice}>${lastPrice.toFixed(2)}</div>
            </div>
            <div className={`${styles.changeInfo} ${isPositive ? styles.positive : styles.negative}`}>
              {isPositive ? '▲' : '▼'} ${Math.abs(priceChange).toFixed(2)}
              <span className={styles.percentChange}>
                ({isPositive ? '+' : ''}{percentChange.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Simple line chart */}
          <div className={styles.chartContainer}>
            <svg viewBox="0 0 400 100" className={styles.chart}>
              {/* Grid lines */}
              <line x1="0" y1="25" x2="400" y2="25" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <line x1="0" y1="50" x2="400" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              <line x1="0" y1="75" x2="400" y2="75" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

              {/* Price line */}
              <polyline
                points={history.map((h, i) => {
                  const x = (i / (history.length - 1)) * 400;
                  const y = 90 - ((h.close - minPrice) / priceRange) * 80;
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data points */}
              {history.map((h, i) => {
                const x = (i / (history.length - 1)) * 400;
                const y = 90 - ((h.close - minPrice) / priceRange) * 80;
                return (
                  <circle key={i} cx={x} cy={y} r="2" fill="white" />
                );
              })}
            </svg>

            {/* Price range labels */}
            <div className={styles.chartLabels}>
              <span>${maxPrice.toFixed(2)}</span>
              <span>${minPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Date range */}
          <div className={styles.dateRange}>
            <span>{history[0].date}</span>
            <span>{history[history.length - 1].date}</span>
          </div>
        </div>
      );
    }

    // Handle single stock/crypto price
    if (data.symbol && data.price !== undefined) {
      const hasChange = data.change !== undefined || data.percent_change !== undefined;
      const changeValue = data.change || data.percent_change || 0;
      const isPositive = changeValue > 0;

      return (
        <div className={styles.stockCard}>
          <div className={styles.stockHeader}>
            <span className={styles.symbol}>{data.symbol}</span>
            {data.currency && (
              <span className={styles.currency}>{data.currency}</span>
            )}
          </div>
          <div className={styles.stockPrice}>
            ${data.price.toFixed(2)}
          </div>
          {hasChange && (
            <div className={`${styles.stockChange} ${isPositive ? styles.positive : styles.negative}`}>
              {isPositive ? '▲' : '▼'} {Math.abs(changeValue).toFixed(2)}%
            </div>
          )}
          {data.volume && (
            <div className={styles.stockMeta}>
              Volume: {data.volume.toLocaleString()}
            </div>
          )}
        </div>
      );
    }

    // Handle multiple prices
    if (data.prices && Array.isArray(data.prices)) {
      return (
        <div className={styles.multipleStocks}>
          {data.prices.map((stock, index) => (
            <div key={index} className={styles.stockCardSmall}>
              <div className={styles.symbolSmall}>{stock.symbol}</div>
              <div className={styles.priceSmall}>${stock.price?.toFixed(2)}</div>
              {stock.change !== undefined && (
                <div className={`${styles.changeSmall} ${stock.change > 0 ? styles.positive : styles.negative}`}>
                  {stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}%
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div
      className={`${styles.container} ${isUser ? styles.user : styles.assistant}`}
    >
      <div
        className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble} ${message.isError ? styles.errorBubble : ''}`}
      >
        <p className={styles.content}>{message.content}</p>

        {/* Render stock card if tool result is available */}
        {message.toolResult && !isUser && renderStockCard(message.toolResult)}

        {/* Show error if tool failed */}
        {message.toolResult?.error && (
          <div className={styles.toolError}>
            ⚠️ {message.toolResult.error}
          </div>
        )}
      </div>
    </div>
  );
}

export default Message;
