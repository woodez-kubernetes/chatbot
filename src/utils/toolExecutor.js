/**
 * Tool Executor
 * Executes tool calls by mapping them to stock API functions
 */

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
        // Use provided period or default to '1week'
        return await stockApi.getPriceHistory(args.symbol, args.period || '1week');

      case 'get_multiple_prices':
        if (!args.symbols || !Array.isArray(args.symbols)) {
          return { error: 'Missing required parameter: symbols (must be an array)' };
        }
        return await stockApi.getMultiplePrices(args.symbols);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    // Return error in a structured format
    return {
      error: `Tool execution failed: ${error.message}`,
      details: error.toString(),
      toolName,
      args,
    };
  }
}

/**
 * Execute multiple tools in sequence
 * @param {Array<{toolName: string, args: object}>} toolCalls - Array of tool calls
 * @returns {Promise<Array<object>>} Array of results
 */
export async function executeMultipleTools(toolCalls) {
  const results = [];

  for (const toolCall of toolCalls) {
    const result = await executeTool(toolCall.toolName, toolCall.args);
    results.push({
      toolName: toolCall.toolName,
      args: toolCall.args,
      result,
    });
  }

  return results;
}

/**
 * Format tool result for display
 * @param {object} result - Tool execution result
 * @returns {string} Formatted result string
 */
export function formatToolResult(result) {
  if (result.error) {
    return `Error: ${result.error}`;
  }

  // Format stock price result
  if (result.symbol && result.price !== undefined) {
    const parts = [
      `${result.symbol}: $${result.price.toFixed(2)}`,
    ];

    if (result.change !== undefined) {
      const changeSign = result.change > 0 ? '+' : '';
      parts.push(`(${changeSign}${result.change.toFixed(2)}%)`);
    }

    return parts.join(' ');
  }

  // For other results, return JSON
  return JSON.stringify(result, null, 2);
}
