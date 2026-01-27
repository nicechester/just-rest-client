/**
 * @fileoverview Handles the HTTP request execution, variable templating,
 * and integration with the post-request scripting module.
 */

// --- Module Imports ---
// Import necessary functions and variables from other modules.
import { getFlattenedVariables } from './variable.js'; // Import function to get flattened variables for templating
import { executePostScript, executePreScript } from './scripting.js'; // Import the script execution engine

// Import Tauri HTTP plugin (will only work in Tauri app)
let tauriFetch = null;
let isTauri = false;

try {
  // Dynamically import Tauri HTTP plugin if available
  const httpModule = await import('@tauri-apps/plugin-http');
  tauriFetch = httpModule.fetch;
  isTauri = true;
} catch (e) {
  // Not in Tauri or plugin not available, use browser fetch
  isTauri = false;
}

// --- Core Templating Function ---

/**
 * Replaces all {{variableName}} tags in a string with the corresponding value
 * from the flattened variable store (includes global + active group).
 * @param {string} templateString - The string containing template tags.
 * @param {string} activeGroup - The active group for variables (optional).
 * @return {string} The string with variables substituted.
 */
function applyTemplate(templateString, activeGroup = undefined) {
  if (!templateString) {
    return templateString;
  }
  
  // Get flattened variables (global + active group)
  const flatVars = getFlattenedVariables(activeGroup);
  
  return templateString.replace(/{{(.*?)}}/g, (match, variableName) => {
    const key = variableName.trim();
    const value = flatVars[key];
    // Return the value if it exists, otherwise return the original tag.
    return value !== undefined ? String(value) : match;
  });
}

// --- Main Request Execution Logic ---

/**
 * Executes the HTTP request based on the current UI state.
 * @param {string} rawUrl - The user-provided URL template.
 * @param {string} method - The HTTP method (GET, POST, etc.).
 * @param {Array<Object>} rawHeaders - Array of {key, value} header objects.
 * @param {string} rawBody - The request body template string.
 * @param {Array<string>|string} preScriptIds - Array of IDs or single ID (backward compat).
 * @param {Array<string>|string} postScriptIds - Array of IDs or single ID (backward compat).
 * @param {function} displayResponse - UI function to update the response panel.
 * @param {string} activeVariableGroup - The active variable group for templating.
 */
async function executeRequest(rawUrl, method, rawHeaders, rawBody, preScriptIds, postScriptIds, displayResponse, activeVariableGroup = 'global') {
  const startTime = Date.now();

  // 0. Run pre-request scripts first
  let scriptOutput = '';
  if (preScriptIds && (Array.isArray(preScriptIds) ? preScriptIds.length > 0 : preScriptIds)) {
    scriptOutput = await executePreScript(preScriptIds);
  }

  // 1. Apply templating (after pre-script has run and potentially updated variables)
  const processedUrl = applyTemplate(rawUrl, activeVariableGroup);
  const processedBody = (method !== 'GET' && method !== 'HEAD') ? applyTemplate(rawBody, activeVariableGroup) : null;
  
  const headers = {};
  rawHeaders.forEach(h => {
    if (h.key) {
      const processedValue = applyTemplate(h.value || '', activeVariableGroup);
      headers[h.key.trim()] = processedValue;
    }
  });

  // Store request details for display
  const requestDetails = {
    method: method,
    processedUrl: processedUrl,
    headers: headers,
    body: processedBody
  };

  let responseData = null;
  let response = null;

  try {
    // 2. Execute Fetch
    // Use Tauri's native fetch if available (no CORS), otherwise browser fetch
    const fetchFn = tauriFetch || fetch;
    
    // Log the URL for debugging
    console.log('[Request] Sending to:', processedUrl);
    console.log('[Request] Method:', method);
    console.log('[Request] Headers:', headers);
    
    response = await fetchFn(processedUrl, {
      method: method,
      headers: headers,
      body: processedBody,
    });

    // 3. Parse Response Body
    const contentType = response.headers.get('content-type');
    const responseClone = response.clone(); 

    if (contentType && (contentType.includes('json') || contentType.includes('javascript'))) {
      responseData = await responseClone.json();
    } else {
      responseData = await responseClone.text();
    }
    
    // 4. Run post-request scripts
    const postScriptOutput = await executePostScript(postScriptIds, response, responseData);
    scriptOutput += postScriptOutput;

  } catch (error) {
    const errorMsg = error?.message || error?.toString() || 'Unknown error';
    scriptOutput += `[Execution Error] Network or Parsing failure: ${errorMsg}\n`;
    scriptOutput += `Using Tauri HTTP: ${!!tauriFetch}\n`;
    
    // Add helpful diagnostics
    if (errorMsg === 'Load failed' || errorMsg === 'Failed to fetch' || errorMsg.includes('NetworkError')) {
      scriptOutput += `\n⚠️  Possible causes:\n`;
      scriptOutput += `   • Server not running at ${processedUrl}\n`;
      scriptOutput += `   • CORS policy blocking browser requests (Tauri app bypasses CORS)\n`;
      scriptOutput += `   • Network connectivity issue\n`;
      
      // Check for encoded curly braces which some servers reject
      if (processedUrl.includes('%7B') || processedUrl.includes('%7D')) {
        scriptOutput += `   • URL contains encoded { } characters that may cause issues\n`;
        scriptOutput += `     Try removing curly braces from your variable values\n`;
      }
    }
    
    console.error('[Request Error]', error);
    console.error('[Request] Failed URL:', processedUrl);
    
    // Set a mock response object for display in case of network failure
    response = {
      status: 'N/A',
      statusText: 'Network Error',
      headers: new Headers(),
    };
    responseData = { error: errorMsg };
  }

  const duration = Date.now() - startTime;

  // 5. Display Results with request details
  // This function must be provided by app.js to update the UI
  if (typeof displayResponse === 'function') {
    displayResponse(requestDetails, response, responseData, scriptOutput, processedUrl, duration);
  } else {
    console.warn('UI function displayResponse not provided. Results logged to console:', 
                 { requestDetails, response, responseData, scriptOutput });
  }
}

/**
 * Public interface for the request module.
 */
export {
  executeRequest,
  tauriFetch,
  isTauri
};