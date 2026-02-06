# Chatbot MCP Integration Plan - Prompt Engineering Approach

## Overview
Integrate the MCP stock API server (`http://stockapi.apexkube.xyz`) with the chatbot using **prompt engineering + pattern matching**. This approach works with `llama3.2:1b` without requiring native tool calling support.

**Inspired by**: [mcp-stockprice-srv/llama_http_client.py](https://github.com/woodez-kubernetes/mcp-stockprice-srv/blob/release-dev/llama_http_client.py)

## Key Insight
Instead of relying on Ollama's native tool calling (which `llama3.2:1b` doesn't support), we:
1. **Teach the LLM** through system prompts to output a specific format when it needs data
2. **Parse the response** using regex to detect tool call patterns
3. **Execute the tool** by calling the actual API
4. **Send results back** to the LLM for natural language formatting

## Architecture Pattern
```
User: "What's the price of Apple stock?"
  ↓
Llama (with system prompt instructing how to call tools)
  ↓
Llama Response: "TOOL_CALL: get_stock_price(symbol='AAPL')"
  ↓
Regex Parser detects pattern: { tool: "get_stock_price", args: { symbol: "AAPL" } }
  ↓
Execute Tool: POST http://stockapi.apexkube.xyz/api/tools/stock_price/
  ↓
Tool Result: { symbol: "AAPL", price: 150.23, change: 2.5, ... }
  ↓
Send back to Llama: "The tool returned {...}. Now answer: What's Apple stock price?"
  ↓
Llama Final: "Apple (AAPL) is currently trading at $150.23, up 2.5% today."
  ↓
Display to User
```

---

## Stage 1: Create Stock API Service Layer

### File: `src/services/stockApi.js`

**Purpose**: Centralized service for all stock API interactions

**Implementation Tasks**:
- [ ] Create base API configuration pointing to `http://stockapi.apexkube.xyz/api`
- [ ] Implement `getStockPrice(symbol)` - POST to `/tools/stock_price/`
- [ ] Implement `getCryptoPrice(symbol)` - POST to `/tools/crypto_price/`
- [ ] Implement `getPriceHistory(symbol, period)` - POST to `/tools/price_history/`
- [ ] Implement `getMultiplePrices(symbols)` - POST to `/tools/multiple_prices/`
- [ ] Add error handling and network timeout logic
- [ ] Add response validation and type checking

**API Endpoints**:
```javascript
const STOCK_API_BASE = 'http://stockapi.apexkube.xyz/api';

// Endpoints
POST /api/tools/stock_price/      // { symbol: "AAPL" }
POST /api/tools/crypto_price/     // { symbol: "BTC" }
POST /api/tools/price_history/    // { symbol: "AAPL", period: "1week" }
POST /api/tools/multiple_prices/  // { symbols: ["AAPL", "MSFT"] }
```

**Implementation Example**:
```javascript
const STOCK_API_BASE = 'http://stockapi.apexkube.xyz/api';

export async function getStockPrice(symbol) {
  const response = await fetch(`${STOCK_API_BASE}/tools/stock_price/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol })
  });

  if (!response.ok) {
    throw new Error(`Stock API error: ${response.status}`);
  }

  return await response.json();
}

export async function getCryptoPrice(symbol) {
  const response = await fetch(`${STOCK_API_BASE}/tools/crypto_price/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol })
  });

  if (!response.ok) {
    throw new Error(`Crypto API error: ${response.status}`);
  }

  return await response.json();
}

// Similar implementations for other endpoints...
```

---

## Stage 2: Create System Prompt with Tool Instructions

### File: `src/config/systemPrompt.js`

**Purpose**: Teach the LLM how to call tools using a specific format

**Implementation Tasks**:
- [ ] Create system prompt that describes available tools
- [ ] Define the `TOOL_CALL: tool_name(arg="value")` format
- [ ] Provide examples of when and how to use tools
- [ ] Instruct LLM to respond naturally after receiving tool results

**System Prompt Template**:
```javascript
export const FINANCIAL_SYSTEM_PROMPT = `You are a helpful financial assistant with access to real-time stock and cryptocurrency data.

You have access to these tools:

- get_stock_price: Get the current price of a stock by ticker symbol
  Parameters: symbol (required) - Stock ticker like AAPL, TSLA, GOOGL

- get_crypto_price: Get the current price of a cryptocurrency
  Parameters: symbol (required) - Crypto symbol like BTC, ETH, SOL

- get_price_history: Get historical price data for a stock
  Parameters: symbol (required), period (optional: 1day, 1week, 1month, 1year)

- get_multiple_prices: Get prices for multiple stocks at once
  Parameters: symbols (required) - Array of ticker symbols

When a user asks about stock or crypto prices, you should use the appropriate tool by responding with:
TOOL_CALL: tool_name(arg1="value1", arg2="value2")

Examples:
- User: "What's the price of Apple stock?"
  You: TOOL_CALL: get_stock_price(symbol="AAPL")

- User: "How much is Bitcoin?"
  You: TOOL_CALL: get_crypto_price(symbol="BTC")

- User: "Show me AAPL and MSFT prices"
  You: TOOL_CALL: get_multiple_prices(symbols=["AAPL", "MSFT"])

- User: "What's Tesla's performance this week?"
  You: TOOL_CALL: get_price_history(symbol="TSLA", period="1week")

After receiving tool results, provide a natural, helpful response to the user incorporating the data.

If the question doesn't require stock/crypto data, just respond normally.`;

export default FINANCIAL_SYSTEM_PROMPT;
```

---

## Stage 3: Create Tool Call Parser

### File: `src/utils/toolParser.js`

**Purpose**: Parse LLM responses to detect and extract tool calls

**Implementation Tasks**:
- [ ] Implement regex pattern to match `TOOL_CALL: tool_name(args)`
- [ ] Parse simple arguments like `symbol="AAPL"`
- [ ] Parse array arguments like `symbols=["AAPL", "MSFT"]`
- [ ] Return structured object with tool name and arguments
- [ ] Handle malformed tool calls gracefully

**Implementation**:
```javascript
/**
 * Parse tool call from LLM response
 * @param {string} response - LLM response text
 * @returns {{ toolName: string, args: object } | null} Parsed tool call or null
 */
export function parseToolCall(response) {
  // Pattern: TOOL_CALL: tool_name(arg="value", arg2="value")
  const toolCallMatch = response.match(/TOOL_CALL:\s*(\w+)\((.*?)\)/);

  if (!toolCallMatch) {
    return null;
  }

  const toolName = toolCallMatch[1];
  const argsString = toolCallMatch[2];
  const args = {};

  // Parse simple key="value" arguments
  const simpleArgPattern = /(\w+)=["']([^"']+)["']/g;
  let match;
  while ((match = simpleArgPattern.exec(argsString)) !== null) {
    args[match[1]] = match[2];
  }

  // Parse array arguments: symbols=["AAPL", "MSFT"]
  const arrayArgPattern = /(\w+)=\[(.*?)\]/g;
  while ((match = arrayArgPattern.exec(argsString)) !== null) {
    const key = match[1];
    const valuesString = match[2];
    // Extract quoted strings from array
    const values = [...valuesString.matchAll(/["']([^"']+)["']/g)].map(m => m[1]);
    args[key] = values;
  }

  return { toolName, args };
}

/**
 * Check if response contains a tool call
 * @param {string} response - LLM response text
 * @returns {boolean}
 */
export function hasToolCall(response) {
  return /TOOL_CALL:\s*\w+\(.*?\)/.test(response);
}
```

---

## Stage 4: Create Tool Executor

### File: `src/utils/toolExecutor.js`

**Purpose**: Execute tool calls by mapping to stock API functions

**Implementation Tasks**:
- [ ] Map tool names to stock API functions
- [ ] Handle different argument types (single symbol, arrays, etc.)
- [ ] Add error handling for unknown tools
- [ ] Add error handling for API failures
- [ ] Return structured results

**Implementation**:
```javascript
import * as stockApi from '../services/stockApi';

/**
 * Execute a tool call
 * @param {string} toolName - Name of the tool to execute
 * @param {object} args - Tool arguments
 * @returns {Promise<object>} Tool execution result
 */
export async function executeTool(toolName, args) {
  try {
    switch (toolName) {
      case 'get_stock_price':
        if (!args.symbol) {
          return { error: 'Missing required parameter: symbol' };
        }
        return await stockApi.getStockPrice(args.symbol);

      case 'get_crypto_price':
        if (!args.symbol) {
          return { error: 'Missing required parameter: symbol' };
        }
        return await stockApi.getCryptoPrice(args.symbol);

      case 'get_price_history':
        if (!args.symbol) {
          return { error: 'Missing required parameter: symbol' };
        }
        return await stockApi.getPriceHistory(args.symbol, args.period || '1week');

      case 'get_multiple_prices':
        if (!args.symbols || !Array.isArray(args.symbols)) {
          return { error: 'Missing required parameter: symbols (array)' };
        }
        return await stockApi.getMultiplePrices(args.symbols);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return {
      error: `Tool execution failed: ${error.message}`,
      details: error.toString()
    };
  }
}
```

---

## Stage 5: Update Ollama API Service

### File: `src/services/ollamaApi.js`

**Purpose**: Add system prompt support and simplify API calls

**Implementation Tasks**:
- [ ] Update `sendMessage()` to accept optional system prompt
- [ ] Use remote Ollama instance at `http://llm.apexkube.xyz/api`
- [ ] Remove unused tool-calling code
- [ ] Keep it simple - just send prompt and get response

**Updated Implementation**:
```javascript
const OLLAMA_BASE_URL = 'http://llm.apexkube.xyz/api';
const MODEL = 'llama3.2:1b';

/**
 * Send a message to Ollama
 * @param {string} prompt - User message or follow-up prompt
 * @param {string} systemPrompt - Optional system instructions
 * @returns {Promise<string>} LLM response
 */
export async function sendMessage(prompt, systemPrompt = null) {
  const payload = {
    model: MODEL,
    prompt: prompt,
    stream: false,
  };

  // Add system prompt if provided
  if (systemPrompt) {
    payload.system = systemPrompt;
  }

  const response = await fetch(`${OLLAMA_BASE_URL}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`);
  }

  const data = await response.json();
  return data.response;
}
```

---

## Stage 6: Enhance useChat Hook

### File: `src/hooks/useChat.js`

**Purpose**: Implement the complete tool-calling workflow

**Implementation Tasks**:
- [ ] Import system prompt, parser, and executor
- [ ] Modify `sendUserMessage` to handle tool calling workflow
- [ ] Implement multi-turn conversation (initial → tool call → tool result → final)
- [ ] Add loading states for tool execution
- [ ] Handle errors at each step
- [ ] Update message format to track tool calls

**Implementation**:
```javascript
import { useState, useCallback } from 'react';
import { sendMessage } from '../services/ollamaApi';
import FINANCIAL_SYSTEM_PROMPT from '../config/systemPrompt';
import { parseToolCall, hasToolCall } from '../utils/toolParser';
import { executeTool } from '../utils/toolExecutor';

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendUserMessage = useCallback(async (content) => {
    if (!content.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: content.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Send to Llama with system prompt
      const initialResponse = await sendMessage(content, FINANCIAL_SYSTEM_PROMPT);

      // Step 2: Check if response contains a tool call
      if (hasToolCall(initialResponse)) {
        const toolCall = parseToolCall(initialResponse);

        if (toolCall) {
          console.log('Tool call detected:', toolCall);

          // Step 3: Execute the tool
          const toolResult = await executeTool(toolCall.toolName, toolCall.args);
          console.log('Tool result:', toolResult);

          // Step 4: Send tool result back to Llama for natural response
          const followUpPrompt = `The tool ${toolCall.toolName} returned:\n${JSON.stringify(toolResult, null, 2)}\n\nBased on this data, please provide a helpful response to the user's question: "${content}"`;

          const finalResponse = await sendMessage(followUpPrompt);

          const aiMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: finalResponse,
            toolCall: toolCall,
            toolResult: toolResult,
          };

          setMessages(prev => [...prev, aiMessage]);
        } else {
          // Tool call format was invalid, return as-is
          const aiMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: initialResponse,
          };
          setMessages(prev => [...prev, aiMessage]);
        }
      } else {
        // No tool call needed, return direct response
        const aiMessage = {
          id: Date.now() + 1,
          role: 'assistant',
          content: initialResponse,
        };
        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (err) {
      setError(err.message);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request.',
        isError: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendUserMessage,
    clearMessages,
  };
}
```

---

## Stage 7: Update UI Components (Optional)

### Files: `src/components/Message/Message.jsx`, `src/components/Message/Message.module.css`

**Purpose**: Enhanced display for stock data and tool calls

**Implementation Tasks**:
- [ ] Add special rendering for messages with tool results
- [ ] Create stock data cards with formatted price data
- [ ] Add visual indicators (green for positive, red for negative changes)
- [ ] Format currency and percentages properly
- [ ] Show tool call details in debug mode (optional)

**UI Enhancement Example**:
```jsx
// In Message.jsx
function Message({ message }) {
  return (
    <div className={`${styles.message} ${styles[message.role]}`}>
      <div className={styles.content}>{message.content}</div>

      {/* Show tool result if available */}
      {message.toolResult && !message.toolResult.error && (
        <div className={styles.stockData}>
          {message.toolResult.symbol && (
            <div className={styles.stockCard}>
              <div className={styles.symbol}>{message.toolResult.symbol}</div>
              <div className={styles.price}>
                ${message.toolResult.price?.toFixed(2)}
              </div>
              {message.toolResult.change && (
                <div className={
                  message.toolResult.change > 0
                    ? styles.changePositive
                    : styles.changeNegative
                }>
                  {message.toolResult.change > 0 ? '+' : ''}
                  {message.toolResult.change.toFixed(2)}%
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**CSS Styling**:
```css
/* In Message.module.css */
.stockCard {
  margin-top: 8px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.symbol {
  font-weight: 600;
  font-size: 16px;
  color: #333;
}

.price {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
}

.changePositive {
  color: #10b981;
  font-weight: 600;
}

.changeNegative {
  color: #ef4444;
  font-weight: 600;
}
```

---

## Stage 8: Testing & Error Handling

### Testing Checklist

**Implementation Tasks**:
- [ ] Test stock price queries ("What's AAPL stock price?")
- [ ] Test crypto price queries ("What's Bitcoin worth?")
- [ ] Test multiple ticker requests ("Show me AAPL and MSFT")
- [ ] Test historical data queries ("Tesla's performance this week")
- [ ] Test invalid symbols (should handle gracefully)
- [ ] Test API timeout scenarios
- [ ] Test when APIs are unavailable
- [ ] Test malformed tool calls
- [ ] Test general questions (no tool calls needed)

**Test Scenarios**:
```
✓ "What's the price of Apple stock?"
  → Should call get_stock_price(symbol="AAPL")

✓ "How much is Tesla worth?"
  → Should call get_stock_price(symbol="TSLA")

✓ "Show me AAPL, GOOGL, and MSFT prices"
  → Should call get_multiple_prices(symbols=["AAPL", "GOOGL", "MSFT"])

✓ "What's Bitcoin trading at?"
  → Should call get_crypto_price(symbol="BTC")

✓ "Show me Tesla's performance this week"
  → Should call get_price_history(symbol="TSLA", period="1week")

✓ "What is a stock?"
  → Should answer directly without tool call

✓ "What's INVALID stock price?"
  → Should attempt call, API returns error, LLM explains not found

✓ Network timeout
  → Should show user-friendly error message
```

**Manual Testing Script**:
```javascript
// Create test script: src/test-stock-api.js
import { getStockPrice, getCryptoPrice } from './services/stockApi';

async function testStockAPI() {
  console.log('Testing Stock API...\n');

  try {
    console.log('1. Testing AAPL stock price...');
    const aapl = await getStockPrice('AAPL');
    console.log('Result:', aapl);

    console.log('\n2. Testing BTC crypto price...');
    const btc = await getCryptoPrice('BTC');
    console.log('Result:', btc);

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testStockAPI();
```

---

## Stage 9: Configuration & Environment Setup

### Files: `.env.local`, `vite.config.js`, `README.md`

**Implementation Tasks**:
- [ ] Add API URLs to environment variables
- [ ] Configure CORS if needed (likely not with remote APIs)
- [ ] Update README with setup instructions
- [ ] Document API endpoints being used
- [ ] Add example queries to documentation

**Environment Configuration**:
```env
# .env.local
VITE_STOCK_API_URL=http://stockapi.apexkube.xyz/api
VITE_OLLAMA_URL=http://llm.apexkube.xyz/api
```

**Update vite.config.js** (if CORS proxy needed):
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Only needed if CORS issues occur
    proxy: {
      '/api/stock': {
        target: 'http://stockapi.apexkube.xyz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/stock/, '/api')
      },
      '/api/llm': {
        target: 'http://llm.apexkube.xyz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/llm/, '/api')
      }
    }
  }
});
```

---

## Stage 10: Documentation

### File: `README.md`

**Implementation Tasks**:
- [ ] Document the prompt engineering approach
- [ ] Add example stock queries
- [ ] Explain how tool calling works
- [ ] Add troubleshooting section
- [ ] Document API dependencies

**README Addition**:
```markdown
## Stock & Crypto Price Features

This chatbot can provide real-time stock and cryptocurrency prices using an MCP-compatible API.

### Example Queries

- "What's the price of Apple stock?"
- "How much is Bitcoin?"
- "Show me AAPL, GOOGL, and MSFT prices"
- "What's Tesla's performance this week?"
- "Compare Ethereum and Bitcoin prices"

### How It Works

1. You ask about stock/crypto prices in natural language
2. The LLM recognizes the need for real-time data
3. It formats a tool call request (e.g., `TOOL_CALL: get_stock_price(symbol="AAPL")`)
4. The app parses this and calls the stock API
5. Results are sent back to the LLM
6. The LLM formats a natural language response with the data

### API Dependencies

- **Ollama LLM**: http://llm.apexkube.xyz/api
- **Stock API**: http://stockapi.apexkube.xyz/api
```

---

## Prerequisites & Dependencies

### System Requirements
- ✅ **Works with existing `llama3.2:1b` model** (no upgrade needed!)
- ✅ Uses remote Ollama instance: `http://llm.apexkube.xyz/api`
- ✅ Uses remote Stock API: `http://stockapi.apexkube.xyz/api`
- ✅ No additional npm packages required

### Verification
Both APIs are confirmed working:
```bash
# Check Ollama
curl http://llm.apexkube.xyz/api/tags

# Check Stock API health
curl http://stockapi.apexkube.xyz/api/health/
```

---

## Implementation Order (Recommended)

1. **Stage 1**: Create `stockApi.js` (test independently with curl)
2. **Stage 2**: Create `systemPrompt.js` (just configuration)
3. **Stage 3**: Create `toolParser.js` (can unit test with examples)
4. **Stage 4**: Create `toolExecutor.js` (maps parser → API)
5. **Stage 5**: Update `ollamaApi.js` (add system prompt support)
6. **Stage 6**: Enhance `useChat.js` (integrate the full workflow)
7. **Stage 8**: Testing with real queries
8. **Stage 7**: UI enhancements (optional polish)
9. **Stage 9**: Environment configuration
10. **Stage 10**: Documentation

---

## Success Criteria

- [ ] Users can ask natural language stock queries
- [ ] LLM correctly outputs TOOL_CALL format when needed
- [ ] Parser successfully extracts tool name and arguments
- [ ] Stock API calls return real-time data
- [ ] LLM formats natural responses with the data
- [ ] Errors are handled gracefully at each step
- [ ] Response time is under 5 seconds total
- [ ] Works with both stock and crypto queries
- [ ] Handles multiple tickers in one query
- [ ] General questions still work without tool calls

---

## Advantages of This Approach

✅ **Works with llama3.2:1b** - No model upgrade needed
✅ **Proven implementation** - Based on working GitHub code
✅ **Simpler than native tool calling** - Just regex parsing
✅ **Flexible** - Easy to add more tools by updating system prompt
✅ **Debuggable** - Can see exact tool calls in responses
✅ **No dependencies** - Uses standard fetch API

---

## Troubleshooting

### LLM doesn't output TOOL_CALL format
- Check that system prompt is being sent correctly
- Verify the prompt includes clear examples
- Try rephrasing the user question more explicitly

### Parser fails to extract arguments
- Check regex patterns in `toolParser.js`
- Log the raw LLM response to see format
- Ensure LLM is using quotes correctly (`"` not `'`)

### Stock API returns errors
- Verify API is accessible: `curl http://stockapi.apexkube.xyz/api/health/`
- Check symbol format (should be uppercase: AAPL not aapl)
- Look for error messages in API response

### Slow responses
- Each query requires 2 LLM calls (initial + final)
- Expected: 3-5 seconds total
- Consider caching frequent symbols if needed

---

## Future Enhancements (Post-MVP)

1. **Additional Tools**
   - Weather data
   - News articles
   - Company fundamentals
   - Market indices

2. **Advanced Features**
   - Stock charts/graphs (via charting library)
   - Price alerts (user preferences)
   - Portfolio tracking
   - Comparison tables

3. **Performance**
   - Cache frequently requested symbols (5-minute cache)
   - Parallel tool execution for multiple calls
   - Streaming responses from LLM

4. **UX Improvements**
   - Auto-suggest ticker symbols
   - Quick action buttons ("Get price", "Compare")
   - Voice input
   - Export data to CSV

5. **Multi-Tool Calls**
   - Handle multiple tool calls in single response
   - Example: "Compare AAPL and MSFT" → 2 tool calls
