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
      // Step 1: Send to Llama with system prompt instructing tool usage
      const initialResponse = await sendMessage(content, FINANCIAL_SYSTEM_PROMPT);

      // Step 2: Check if response contains a tool call
      if (hasToolCall(initialResponse)) {
        const toolCall = parseToolCall(initialResponse);

        if (toolCall) {
          console.log('🔧 Tool call detected:', toolCall);

          // Step 3: Execute the tool
          const toolResult = await executeTool(toolCall.toolName, toolCall.args);
          console.log('📊 Tool result:', toolResult);

          // Step 4: Send tool result back to Llama for natural response
          // Format the data in a natural way for the LLM
          let dataContext = '';

          // Handle historical data
          if (toolResult.history && Array.isArray(toolResult.history)) {
            const history = toolResult.history;
            const firstPrice = history[0]?.close;
            const lastPrice = history[history.length - 1]?.close;
            const priceChange = lastPrice - firstPrice;
            const percentChange = ((priceChange / firstPrice) * 100);
            const direction = priceChange > 0 ? 'up' : 'down';

            dataContext = `${toolResult.symbol} ${toolResult.period} data shows price moved from $${firstPrice} to $${lastPrice}, ${direction} ${Math.abs(percentChange).toFixed(2)}% over ${toolResult.data_points} data points`;
          }
          // Handle current price
          else if (toolResult.symbol && toolResult.price !== undefined) {
            dataContext = `${toolResult.symbol} is trading at $${toolResult.price}`;
            if (toolResult.change !== undefined || toolResult.percent_change !== undefined) {
              const change = toolResult.change || toolResult.percent_change;
              const direction = change > 0 ? 'up' : 'down';
              dataContext += `, ${direction} ${Math.abs(change).toFixed(2)}%`;
            }
            if (toolResult.volume) {
              dataContext += `, with a volume of ${toolResult.volume.toLocaleString()}`;
            }
          }
          // Handle multiple prices
          else if (toolResult.prices) {
            dataContext = toolResult.prices.map(stock =>
              `${stock.symbol}: $${stock.price}`
            ).join(', ');
          }
          // Fallback to JSON
          else {
            dataContext = JSON.stringify(toolResult);
          }

          const followUpPrompt = `Based on the following data: ${dataContext}

Please provide a natural, conversational response to the user's question: "${content}"

Do not repeat the raw data or JSON - just give a helpful, friendly answer.`;

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
