// Use environment variables for Kubernetes deployment
const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_URL || 'http://llm.apexkube.xyz/api';
const MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'llama3.2:1b';

console.log('🔧 Ollama Config:', { url: OLLAMA_BASE_URL, model: MODEL });

/**
 * Send a message to Ollama LLM
 * @param {string} prompt - User message or follow-up prompt
 * @param {string|null} systemPrompt - Optional system instructions
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

  try {
    console.log('📡 Calling Ollama:', `${OLLAMA_BASE_URL}/generate`);

    const response = await fetch(`${OLLAMA_BASE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ollama API error:', response.status, errorText);
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Ollama response received');
    return data.response;
  } catch (error) {
    console.error('❌ Ollama request failed:', error);
    throw new Error(`Failed to connect to Ollama: ${error.message}`);
  }
}
