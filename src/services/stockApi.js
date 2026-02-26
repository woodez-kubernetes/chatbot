/**
 * Stock API Service
 * Provides methods to interact with the MCP Stock Price API
 * Base URL: http://stockapi.apexkube.xyz/api
 */

// Use environment variables for Kubernetes deployment
const STOCK_API_BASE = import.meta.env.VITE_STOCK_API_URL || 'http://stockapi.apexkube.xyz/api';
const DEFAULT_TIMEOUT = 10000; // 10 seconds

console.log('🔧 Stock API Config:', { url: STOCK_API_BASE });

/**
 * Helper function to make API requests with timeout
 * @param {string} endpoint - API endpoint path
 * @param {object} data - Request payload
 * @returns {Promise<object>} API response
 */
async function makeApiRequest(endpoint, data) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  try {
    const url = `${STOCK_API_BASE}${endpoint}`;
    console.log('📡 Calling Stock API:', url, data);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Stock API error:', response.status, errorData);
      throw new Error(
        errorData.error || `API error: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();
    console.log('✅ Stock API response received');
    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      console.error('⏱️ Stock API timeout');
      throw new Error('Request timeout - please try again');
    }

    console.error('❌ Stock API request failed:', error);
    throw error;
  }
}

/**
 * Get the current price of a stock
 * @param {string} symbol - Stock ticker symbol (e.g., "AAPL", "TSLA")
 * @returns {Promise<object>} Stock price data
 * @example
 * const data = await getStockPrice("AAPL");
 * // Returns: { symbol: "AAPL", price: 150.23, change: 2.5, ... }
 */
export async function getStockPrice(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Invalid symbol: must be a non-empty string');
  }

  return await makeApiRequest('/tools/stock_price/', {
    symbol: symbol.trim().toUpperCase(),
  });
}

/**
 * Get the current price of a cryptocurrency
 * @param {string} symbol - Crypto symbol (e.g., "BTC", "ETH", "SOL")
 * @returns {Promise<object>} Crypto price data
 * @example
 * const data = await getCryptoPrice("BTC");
 * // Returns: { symbol: "BTC", price: 45000.00, change: -1.2, ... }
 */
export async function getCryptoPrice(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Invalid symbol: must be a non-empty string');
  }

  return await makeApiRequest('/tools/crypto_price/', {
    symbol: symbol.trim().toUpperCase(),
  });
}

/**
 * Get historical price data for a stock
 * @param {string} symbol - Stock ticker symbol
 * @param {string} period - Time period (e.g., "1day", "1week", "1month", "1year")
 * @returns {Promise<object>} Historical price data
 * @example
 * const data = await getPriceHistory("TSLA", "1week");
 * // Returns: { symbol: "TSLA", period: "1week", history: [...] }
 */
export async function getPriceHistory(symbol, period = '1week') {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Invalid symbol: must be a non-empty string');
  }

  // Normalize period to accepted format
  // Valid periods: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, max
  const normalizePeriod = (p) => {
    if (!p) return '1mo';

    const normalized = p.toLowerCase().replace(/\s+/g, '');

    // Map common variations to valid API periods
    const periodMap = {
      // 1 Day
      '1d': '1d',
      '1day': '1d',
      'day': '1d',
      'today': '1d',
      '24hours': '1d',

      // 5 Days
      '5d': '5d',
      '5days': '5d',
      'week': '5d',
      '1week': '5d',
      'thisweek': '5d',
      '1w': '5d',
      '7days': '5d',

      // 1 Month
      '1mo': '1mo',
      '1month': '1mo',
      'month': '1mo',
      'thismonth': '1mo',
      '1m': '1mo',
      '30days': '1mo',

      // 3 Months
      '3mo': '3mo',
      '3months': '3mo',
      '3month': '3mo',
      '90days': '3mo',

      // 6 Months
      '6mo': '6mo',
      '6months': '6mo',
      '6month': '6mo',
      '180days': '6mo',

      // 1 Year
      '1y': '1y',
      '1year': '1y',
      'year': '1y',
      'thisyear': '1y',
      '12months': '1y',

      // 2 Years
      '2y': '2y',
      '2years': '2y',

      // 5 Years
      '5y': '5y',
      '5years': '5y',

      // Max
      'max': 'max',
      'all': 'max',
      'alltime': 'max',
    };

    return periodMap[normalized] || '1mo'; // Default to 1 month if unknown
  };

  const validPeriod = normalizePeriod(period);

  return await makeApiRequest('/tools/price_history/', {
    symbol: symbol.trim().toUpperCase(),
    period: validPeriod,
  });
}

/**
 * Get prices for multiple stocks at once
 * @param {string[]} symbols - Array of stock ticker symbols
 * @returns {Promise<object>} Multiple stock prices
 * @example
 * const data = await getMultiplePrices(["AAPL", "MSFT", "GOOGL"]);
 * // Returns: { prices: [{ symbol: "AAPL", price: 150.23 }, ...] }
 */
export async function getMultiplePrices(symbols) {
  if (!Array.isArray(symbols) || symbols.length === 0) {
    throw new Error('Invalid symbols: must be a non-empty array');
  }

  // Validate and normalize symbols
  const normalizedSymbols = symbols.map((symbol) => {
    if (typeof symbol !== 'string' || !symbol.trim()) {
      throw new Error('Invalid symbol in array: all symbols must be strings');
    }
    return symbol.trim().toUpperCase();
  });

  return await makeApiRequest('/tools/multiple_prices/', {
    symbols: normalizedSymbols,
  });
}

/**
 * Check if the Stock API is healthy
 * @returns {Promise<object>} Health status
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${STOCK_API_BASE}/health/`);
    return await response.json();
  } catch (error) {
    throw new Error(`Health check failed: ${error.message}`);
  }
}

/**
 * Get list of available tools from the API
 * @returns {Promise<object>} Available tools
 */
export async function getAvailableTools() {
  try {
    const response = await fetch(`${STOCK_API_BASE}/tools/`);
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to fetch tools: ${error.message}`);
  }
}
