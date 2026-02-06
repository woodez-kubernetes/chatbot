const OLLAMA_BASE_URL = 'http://llm.apexkube.xyz/api';
const MODEL = 'llama3.2:1b';

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
