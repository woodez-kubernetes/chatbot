import { useState, useCallback } from 'react';
import { sendMessage } from '../services/ollamaApi';

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
      const response = await sendMessage(content);

      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      setError(err.message);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please make sure Ollama is running.',
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
