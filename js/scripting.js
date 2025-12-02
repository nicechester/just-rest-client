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

  // 3. Execute the code using new Function() for a cleaner scope
  try {
    // Arguments: response (Fetch Response), responseData (Parsed JSON/Text), setVar (Helper function)
    const scriptFunction = new Function('response', 'responseData', 'setVar', `
      // User's script starts here.
      ${scriptCode}
    `);

    // Execute the user's script
    scriptFunction(response, responseData, setVar);

  } catch (error) {
    scriptOutput += `[Script Execution Error] ${error.toString()}\n`;
    console.error('Post-script execution error:', error);
  }

  // 4. Return the script output log
  return scriptOutput;
}

/**
 * Public interface for the scripting module.
 */
export {
  executePostScript
};