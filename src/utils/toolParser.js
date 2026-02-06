/**
 * Tool Call Parser
 * Parses LLM responses to detect and extract tool calls in the format:
 * TOOL_CALL: tool_name(arg1="value1", arg2="value2")
 */

/**
 * Check if a response contains a tool call
 * @param {string} response - LLM response text
 * @returns {boolean} True if response contains a tool call
 */
export function hasToolCall(response) {
  if (!response || typeof response !== 'string') {
    return false;
  }
  return /TOOL_CALL:\s*\w+\(.*?\)/.test(response);
}

/**
 * Parse tool call from LLM response
 * @param {string} response - LLM response text
 * @returns {{ toolName: string, args: object } | null} Parsed tool call or null
 * @example
 * parseToolCall('TOOL_CALL: get_stock_price(symbol="AAPL")')
 * // Returns: { toolName: 'get_stock_price', args: { symbol: 'AAPL' } }
 */
export function parseToolCall(response) {
  if (!response || typeof response !== 'string') {
    return null;
  }

  // Pattern: TOOL_CALL: tool_name(arg="value", arg2="value")
  const toolCallMatch = response.match(/TOOL_CALL:\s*(\w+)\((.*?)\)/);

  if (!toolCallMatch) {
    return null;
  }

  const toolName = toolCallMatch[1];
  const argsString = toolCallMatch[2];
  const args = {};

  // Parse simple key="value" or key='value' arguments
  const simpleArgPattern = /(\w+)=["']([^"']+)["']/g;
  let match;

  while ((match = simpleArgPattern.exec(argsString)) !== null) {
    args[match[1]] = match[2];
  }

  // Parse array arguments: symbols=["AAPL", "MSFT"] or symbols=['AAPL', 'MSFT']
  const arrayArgPattern = /(\w+)=\[(.*?)\]/g;

  while ((match = arrayArgPattern.exec(argsString)) !== null) {
    const key = match[1];
    const valuesString = match[2];

    // Extract quoted strings from array (handles both " and ')
    const values = [...valuesString.matchAll(/["']([^"']+)["']/g)].map(m => m[1]);

    if (values.length > 0) {
      args[key] = values;
    }
  }

  return { toolName, args };
}

/**
 * Extract the tool call portion from a response (for debugging)
 * @param {string} response - LLM response text
 * @returns {string | null} The tool call string or null
 */
export function extractToolCallString(response) {
  if (!response || typeof response !== 'string') {
    return null;
  }

  const match = response.match(/TOOL_CALL:\s*\w+\(.*?\)/);
  return match ? match[0] : null;
}

/**
 * Validate parsed tool call arguments
 * @param {string} toolName - Name of the tool
 * @param {object} args - Parsed arguments
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
export function validateToolCall(toolName, args) {
  const toolSchemas = {
    get_stock_price: {
      required: ['symbol'],
      optional: [],
    },
    get_crypto_price: {
      required: ['symbol'],
      optional: [],
    },
    get_price_history: {
      required: ['symbol'],
      optional: ['period'],
    },
    get_multiple_prices: {
      required: ['symbols'],
      optional: [],
    },
  };

  const schema = toolSchemas[toolName];

  if (!schema) {
    return {
      valid: false,
      error: `Unknown tool: ${toolName}`,
    };
  }

  // Check required arguments
  for (const requiredArg of schema.required) {
    if (!(requiredArg in args) || args[requiredArg] === undefined) {
      return {
        valid: false,
        error: `Missing required argument: ${requiredArg}`,
      };
    }
  }

  // Validate argument types
  if (toolName === 'get_multiple_prices') {
    if (!Array.isArray(args.symbols)) {
      return {
        valid: false,
        error: 'symbols must be an array',
      };
    }
  }

  return { valid: true };
}
