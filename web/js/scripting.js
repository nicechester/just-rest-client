/**
 * @fileoverview Handles the execution of user-defined post-request scripts.
 * It provides a sandboxed environment for the script to access response data
 * and update global variables.
 */

// --- Module Imports ---
// Import necessary functions from storage and variables modules.
import { getAllScripts } from './storage.js'; 
import { setVariable, getFlattenedVariables } from './variable.js';
import { tauriFetch, isTauri } from './request.js'; 

/**
 * Executes multiple saved post-request scripts associated with a request.
 * @param {Array<string>|string} postScriptIds - Array of script IDs or single ID (backward compat).
 * @param {Response} response - The native Fetch Response object.
 * @param {Object} responseData - The parsed response body data (e.g., JSON object).
 * @param {Object} requestData - The request details that were sent (method, url, headers, body).
 * @return {string} A log of the script execution, including errors or variable updates.
 */
async function executePostScript(postScriptIds, response, responseData, requestData = {}) {
  let scriptOutput = '';

  // Handle backward compatibility: convert single ID to array
  const scriptIdsArray = Array.isArray(postScriptIds) 
    ? postScriptIds 
    : (postScriptIds ? [postScriptIds] : []);

  // If no scripts, exit gracefully
  if (scriptIdsArray.length === 0) {
    return 'No post-request scripts configured.';
  }

  const scripts = getAllScripts();

  // Execute each script in order
  for (let i = 0; i < scriptIdsArray.length; i++) {
    const postScriptId = scriptIdsArray[i];
    scriptOutput += `\n[Post-Script ${i + 1}/${scriptIdsArray.length}]\n`;

    // 1. Look up the script code
    const scriptToRun = scripts.find(s => s.id === postScriptId);
    if (!scriptToRun) {
      scriptOutput += `[Script Error] Saved script with ID "${postScriptId}" not found.\n`;
      continue;
    }

    const scriptCode = scriptToRun.code;
    scriptOutput += `[Running] ${scriptToRun.name}\n`;

    // 2. Define the helper functions available to the user's script
    const getVar = (key) => {
      const vars = getFlattenedVariables();
      return vars[key];
    };

    const setVar = (key, value) => {
      setVariable(key, value);
      scriptOutput += `[Script Success] Variable set: ${key} = ${value}\n`;
    };

    const log = (...args) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      scriptOutput += `[Log] ${message}\n`;
    };

    const http = async (url, options = {}) => {
      try {
        scriptOutput += `[HTTP] ${options.method || 'GET'} ${url}\n`;
        const fetchFn = tauriFetch || fetch;
        const httpResponse = await fetchFn(url, options);
        const contentType = httpResponse.headers.get('content-type');
        
        let data;
        if (contentType && (contentType.includes('json') || contentType.includes('javascript'))) {
          data = await httpResponse.json();
        } else {
          data = await httpResponse.text();
        }
        
        scriptOutput += `[HTTP] Response ${httpResponse.status} ${httpResponse.statusText}\n`;
        
        return {
          status: httpResponse.status,
          statusText: httpResponse.statusText,
          headers: httpResponse.headers,
          data: data
        };
      } catch (error) {
        scriptOutput += `[HTTP Error] ${error.message}\n`;
        throw new Error(`HTTP request failed: ${error.message}`);
      }
    };

    // 3. Execute the code using new Function() for a cleaner scope
    try {
      // Arguments: response (Fetch Response), responseData (Parsed JSON/Text), requestData (Request details), getVar (Get variable), setVar (Set variable), log (Logging function), http (HTTP client)
      const scriptFunction = new Function('response', 'responseData', 'requestData', 'getVar', 'setVar', 'log', 'http', `
        return (async () => {
          // User's script starts here.
          ${scriptCode}
        })();
      `);

      // Execute the user's script (now async)
      await scriptFunction(response, responseData, requestData, getVar, setVar, log, http);

    } catch (error) {
      scriptOutput += `[Script Execution Error] ${error.toString()}\n`;
      console.error('Post-script execution error:', error);
    }
  }

  // 4. Return the script output log
  return scriptOutput;
}

/**
 * Executes multiple pre-request scripts before the request is sent.
 * @param {Array<string>|string} preScriptIds - Array of script IDs or single ID (backward compat).
 * @param {Object} requestData - The raw request details (method, url, headers, body) before templating.
 * @return {string} A log of the script execution.
 */
async function executePreScript(preScriptIds, requestData = {}) {
  let scriptOutput = '[Pre-Request Scripts]\n';

  // Handle backward compatibility: convert single ID to array
  const scriptIdsArray = Array.isArray(preScriptIds) 
    ? preScriptIds 
    : (preScriptIds ? [preScriptIds] : []);

  // If no scripts, exit gracefully
  if (scriptIdsArray.length === 0) {
    return '';
  }

  const scripts = getAllScripts();

  // Execute each script in order
  for (let i = 0; i < scriptIdsArray.length; i++) {
    const preScriptId = scriptIdsArray[i];
    scriptOutput += `\n[Pre-Script ${i + 1}/${scriptIdsArray.length}]\n`;

    // 1. Look up the script code
    const scriptToRun = scripts.find(s => s.id === preScriptId);
    if (!scriptToRun) {
      scriptOutput += `[Script Error] Pre-script with ID "${preScriptId}" not found.\n`;
      continue;
    }

    const scriptCode = scriptToRun.code;
    scriptOutput += `[Running] ${scriptToRun.name}\n`;

    // 2. Define the helper functions available to the user's pre-script
    const getVar = (key) => {
      const vars = getFlattenedVariables();
      return vars[key];
    };

    const setVar = (key, value) => {
      setVariable(key, value);
      scriptOutput += `[Pre-Script] Variable set: ${key} = ${value}\n`;
    };

    const log = (...args) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch (e) {
            return String(arg);
          }
        }
        return String(arg);
      }).join(' ');
      scriptOutput += `[Pre-Log] ${message}\n`;
    };

    const http = async (url, options = {}) => {
      try {
        scriptOutput += `[HTTP] ${options.method || 'GET'} ${url}\n`;
        const fetchFn = tauriFetch || fetch;
        const httpResponse = await fetchFn(url, options);
        const contentType = httpResponse.headers.get('content-type');
        
        let data;
        if (contentType && (contentType.includes('json') || contentType.includes('javascript'))) {
          data = await httpResponse.json();
        } else {
          data = await httpResponse.text();
        }
        
        scriptOutput += `[HTTP] Response ${httpResponse.status} ${httpResponse.statusText}\n`;
        
        return {
          status: httpResponse.status,
          statusText: httpResponse.statusText,
          headers: httpResponse.headers,
          data: data
        };
      } catch (error) {
        scriptOutput += `[HTTP Error] ${error.message}\n`;
        throw new Error(`HTTP request failed: ${error.message}`);
      }
    };

    // 3. Execute the code using new Function() for a cleaner scope
    try {
      // Arguments: requestData (Raw request details), getVar (Get variable), setVar (Set variable), log (Logging function), http (HTTP client)
      const scriptFunction = new Function('requestData', 'getVar', 'setVar', 'log', 'http', `
        return (async () => {
          // User's pre-script starts here.
          ${scriptCode}
        })();
      `);

      // Execute the user's pre-script (now async)
      await scriptFunction(requestData, getVar, setVar, log, http);

    } catch (error) {
      scriptOutput += `[Pre-Script Execution Error] ${error.toString()}\n`;
      console.error('Pre-script execution error:', error);
    }
  }

  // 4. Return the script output log
  return scriptOutput;
}

/**
 * Public interface for the scripting module.
 */
export {
  executePostScript,
  executePreScript
};