/**
 * @fileoverview Handles the execution of user-defined post-request scripts.
 * It provides a sandboxed environment for the script to access response data
 * and update global variables.
 */

// --- Module Imports ---
// Import necessary functions from storage and variables modules.
import { getAllScripts } from './storage.js'; 
import { setVariable } from './variable.js'; 

/**
 * Executes a saved post-request script associated with a request.
 * @param {string} postScriptId - The ID of the saved script to execute.
 * @param {Response} response - The native Fetch Response object.
 * @param {Object} responseData - The parsed response body data (e.g., JSON object).
 * @return {string} A log of the script execution, including errors or variable updates.
 */
function executePostScript(postScriptId, response, responseData) {
  let scriptOutput = '';

  // 1. Look up the script code
  let scriptCode = null;
  
  if (postScriptId) {
    const scripts = getAllScripts();
    const scriptToRun = scripts.find(s => s.id === postScriptId);
    if (scriptToRun) {
      scriptCode = scriptToRun.code;
    } else {
      scriptOutput += `[Script Error] Saved script with ID "${postScriptId}" not found.\n`;
      return scriptOutput;
    }
  } else {
    // No script ID provided, gracefully exit.
    return 'No post-request script configured.';
  }

  // 2. Define the helper functions available to the user's script
  
  /**
   * Helper function exposed to the user script to set variables.
   * Logs the action for the output console.
   * @param {string} key - Variable name.
   * @param {*} value - Variable value.
   */
  const setVar = (key, value) => {
    setVariable(key, value); // Call the imported setVariable function
    scriptOutput += `[Script Success] Variable set: ${key} = ${value}\n`;
  };

  /**
   * Helper function to log messages from the script.
   * @param {*} message - Message to log.
   */
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

  // 3. Execute the code using new Function() for a cleaner scope
  try {
    // Arguments: response (Fetch Response), responseData (Parsed JSON/Text), setVar (Helper function), log (Logging function)
    const scriptFunction = new Function('response', 'responseData', 'setVar', 'log', `
      // User's script starts here.
      ${scriptCode}
    `);

    // Execute the user's script
    scriptFunction(response, responseData, setVar, log);

  } catch (error) {
    scriptOutput += `[Script Execution Error] ${error.toString()}\n`;
    console.error('Post-script execution error:', error);
  }

  // 4. Return the script output log
  return scriptOutput;
}

/**
 * Executes a pre-request script before the request is sent.
 * @param {string} preScriptId - The ID of the saved pre-script to execute.
 * @return {string} A log of the script execution.
 */
function executePreScript(preScriptId) {
  let scriptOutput = '[Pre-Request Script]\n';

  // 1. Look up the script code
  let scriptCode = null;
  
  if (preScriptId) {
    const scripts = getAllScripts();
    const scriptToRun = scripts.find(s => s.id === preScriptId);
    if (scriptToRun) {
      scriptCode = scriptToRun.code;
    } else {
      scriptOutput += `[Script Error] Pre-script with ID "${preScriptId}" not found.\n`;
      return scriptOutput;
    }
  } else {
    return '';
  }

  // 2. Define the helper functions available to the user's pre-script
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

  // 3. Execute the code using new Function() for a cleaner scope
  try {
    // Arguments: setVar (Helper function), log (Logging function)
    const scriptFunction = new Function('setVar', 'log', `
      // User's pre-script starts here.
      ${scriptCode}
    `);

    // Execute the user's pre-script
    scriptFunction(setVar, log);

  } catch (error) {
    scriptOutput += `[Pre-Script Execution Error] ${error.toString()}\n`;
    console.error('Pre-script execution error:', error);
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