# Scripting Guide

This document explains how to use pre-request and post-request scripts in Just REST Client to automate workflows, handle authentication, extract data, and chain API calls.

## Table of Contents

- [Overview](#overview)
- [Script Types](#script-types)
- [Available Functions](#available-functions)
- [Variable Management](#variable-management)
- [HTTP Client in Scripts](#http-client-in-scripts)
- [Common Use Cases](#common-use-cases)
- [Best Practices](#best-practices)
- [Security & Sandboxing](#security--sandboxing)
- [Examples](#examples)

---

## Overview

Scripts in Just REST Client are JavaScript code snippets that execute at specific points in the request lifecycle:

- **Pre-Request Scripts**: Run *before* the request is sent
- **Post-Request Scripts**: Run *after* receiving the response

Scripts have access to:
- ✅ Variable store (read/write)
- ✅ HTTP client (make additional requests)
- ✅ Logging utilities
- ✅ Full async/await support

Scripts run in a **sandboxed environment** for security.

---

## Script Types

### Pre-Request Scripts

Execute **before** the main request is sent. Use them to:
- Set dynamic variables (timestamps, signatures, nonces)
- Fetch authentication tokens
- Compute values needed for the request
- Prepare request data

**Available Context:**
```javascript
getVar(key)        // Get variable value
setVar(key, value) // Set variable value
log(...args)       // Log to script output
http(url, options) // Make HTTP requests
```

### Post-Request Scripts

Execute **after** receiving the response. Use them to:
- Extract data from responses
- Save tokens, IDs, or other values as variables
- Validate response structure
- Chain to follow-up requests

**Available Context:**
```javascript
response           // Response object (status, headers, etc.)
responseData       // Parsed response body (JSON or text)
getVar(key)        // Get variable value
setVar(key, value) // Set variable value
log(...args)       // Log to script output
http(url, options) // Make HTTP requests
```

---

## Available Functions

### `getVar(key)`

Get the value of a variable from the variable store.

**Parameters:**
- `key` (string): Variable name

**Returns:**
- Variable value (string) or `undefined` if not found

**Example:**
```javascript
const baseUrl = getVar('baseUrl');
const token = getVar('access_token');
log('Using token:', token);
```

**Variable Scoping:**
- Variables from the **global** group are always accessible
- Variables from the **active group** override global ones
- Returns `undefined` for non-existent variables

---

### `setVar(key, value)`

Set or update a variable in the variable store.

**Parameters:**
- `key` (string): Variable name
- `value` (any): Variable value (converted to string)

**Returns:** Nothing

**Example:**
```javascript
setVar('timestamp', Date.now());
setVar('user_id', responseData.id);
setVar('authenticated', 'true');
```

**Notes:**
- Variables are saved to the **currently active group**
- Changes persist immediately to localStorage
- Variable updates appear in the Variables tab

---

### `log(...args)`

Log messages to the script output panel.

**Parameters:**
- `...args` (any): Values to log (objects are JSON.stringify'd)

**Returns:** Nothing

**Example:**
```javascript
log('Request starting...');
log('Response status:', response.status);
log('User data:', responseData.user);
log('Variables:', { token: getVar('token'), url: getVar('baseUrl') });
```

**Output Format:**
```
[Pre-Log] Request starting...
[Log] Response status: 200
[Log] User data: {"id": 123, "name": "John"}
[Log] Variables: {"token": "abc123", "url": "https://api.example.com"}
```

---

### `http(url, options)`

Make HTTP requests from within scripts. Uses **Tauri native HTTP** (no CORS!) when running as desktop app.

**Parameters:**
- `url` (string): Request URL
- `options` (object): Fetch options
  - `method` (string): HTTP method (GET, POST, etc.)
  - `headers` (object): Request headers
  - `body` (string): Request body

**Returns:** Promise resolving to:
```javascript
{
  status: number,        // HTTP status code
  statusText: string,    // Status text (e.g., "OK")
  headers: Headers,      // Response headers
  data: object|string    // Parsed response body (JSON or text)
}
```

**Example:**
```javascript
// GET request
const response = await http('https://api.example.com/users/1');
log('User:', response.data.name);

// POST request with headers
const loginResponse = await http('https://api.example.com/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: getVar('username'),
    password: getVar('password')
  })
});

if (loginResponse.status === 200) {
  setVar('access_token', loginResponse.data.token);
  log('Login successful!');
}
```

**Features:**
- ✅ **No CORS restrictions** (in Tauri desktop app)
- ✅ Automatic JSON/text parsing based on Content-Type
- ✅ Full async/await support
- ✅ Logs to script output automatically

---

## Variable Management

### Reading Variables

Use `getVar()` to read existing variables:

```javascript
// Get configuration
const apiUrl = getVar('api_url');
const apiKey = getVar('api_key');

// Build request
const response = await http(`${apiUrl}/data`, {
  headers: {
    'X-API-Key': apiKey
  }
});
```

### Setting Variables

Use `setVar()` to save values for later use:

```javascript
// Post-request: Extract token
if (responseData.token) {
  setVar('access_token', responseData.token);
  setVar('token_expires', responseData.expires_at);
  log('Token saved for future requests');
}
```

### Variable Groups

Variables belong to **groups** (e.g., dev, staging, production):

- **Global group**: Variables accessible across all groups
- **Active group**: Current group selected in the Variables tab
- **Precedence**: Active group variables override global ones

```javascript
// These are stored in the active group
setVar('environment', 'production');
setVar('api_endpoint', 'https://api.prod.com');

// Reading considers both global and active group
const endpoint = getVar('api_endpoint'); // Gets active group value
const fallback = getVar('common_header'); // Falls back to global if not in active group
```

---

## HTTP Client in Scripts

### Making Requests

Scripts can make HTTP requests to:
- Fetch authentication tokens
- Get data from other APIs
- Chain multiple requests
- Validate or enrich data

**Basic Pattern:**
```javascript
// Pre-request: Get auth token
const tokenResponse = await http('https://auth.api.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    grant_type: 'client_credentials',
    client_id: getVar('client_id'),
    client_secret: getVar('client_secret')
  })
});

setVar('access_token', tokenResponse.data.access_token);
log('Token refreshed');
```

### Error Handling

Use try/catch for robust error handling:

```javascript
try {
  const response = await http('https://api.example.com/data');
  setVar('data', JSON.stringify(response.data));
} catch (error) {
  log('Request failed:', error.message);
  setVar('fallback_mode', 'true');
}
```

### Parallel Requests

Make multiple requests simultaneously:

```javascript
// Fetch multiple resources in parallel
const [user, posts, comments] = await Promise.all([
  http('https://api.example.com/user/1'),
  http('https://api.example.com/posts'),
  http('https://api.example.com/comments')
]);

log('Loaded user:', user.data.name);
log('Posts count:', posts.data.length);
log('Comments count:', comments.data.length);
```

---

## Common Use Cases

### 1. OAuth Token Management

**Pre-Request: Fetch Token**
```javascript
// Check if token exists and is valid
const existingToken = getVar('access_token');
const expiresAt = parseInt(getVar('token_expires_at') || '0');

if (!existingToken || Date.now() > expiresAt) {
  log('Token expired or missing, fetching new one...');
  
  const response = await http('https://auth.example.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `grant_type=client_credentials&client_id=${getVar('client_id')}&client_secret=${getVar('client_secret')}`
  });
  
  if (response.status === 200) {
    setVar('access_token', response.data.access_token);
    setVar('token_expires_at', Date.now() + (response.data.expires_in * 1000));
    log('Token refreshed successfully');
  }
} else {
  log('Using existing token');
}
```

### 2. Dynamic Timestamps

**Pre-Request: Set Date Variables**
```javascript
// Set current date
const today = new Date();
const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
setVar('today', todayStr);

// Set future date (30 days from now)
const futureDate = new Date(today);
futureDate.setDate(today.getDate() + 30);
const futureStr = futureDate.toISOString().split('T')[0];
setVar('month_later', futureStr);

// ISO timestamp with timezone
setVar('timestamp', new Date().toISOString()); // 2024-01-15T10:30:00.000Z

log('Date variables set:', { today: todayStr, month_later: futureStr });
```

### 3. Response Data Extraction

**Post-Request: Extract Nested Data**
```javascript
// Extract user details from nested response
if (response.status === 200 && responseData.data) {
  const user = responseData.data.user;
  
  setVar('user_id', user.id);
  setVar('user_email', user.email);
  setVar('user_name', `${user.first_name} ${user.last_name}`);
  
  // Extract token if present
  if (responseData.data.authentication) {
    setVar('access_token', responseData.data.authentication.token);
    log('User authenticated:', user.email);
  }
}
```

### 4. Request Chaining

**Post-Request: Follow-up Requests**
```javascript
// Use response data to make another request
const userId = responseData.id;
log('Got user ID:', userId);

// Fetch detailed user profile
const profileResponse = await http(`https://api.example.com/users/${userId}/profile`, {
  headers: {
    'Authorization': `Bearer ${getVar('access_token')}`
  }
});

if (profileResponse.status === 200) {
  setVar('user_full_name', profileResponse.data.full_name);
  setVar('user_avatar', profileResponse.data.avatar_url);
  log('Profile loaded:', profileResponse.data.full_name);
}
```

### 5. Environment-Based Logic

**Pre-Request: Conditional Endpoints**
```javascript
// Different behavior based on environment
const environment = getVar('environment') || 'dev';

let apiUrl;
if (environment === 'production') {
  apiUrl = 'https://api.production.com';
} else if (environment === 'staging') {
  apiUrl = 'https://api.staging.com';
} else {
  apiUrl = 'http://localhost:8080';
}

setVar('api_url', apiUrl);
log('Using environment:', environment, '→', apiUrl);
```

### 6. Request Counter

**Pre-Request: Track Request Count**
```javascript
// Increment request counter
const count = parseInt(getVar('request_count') || '0');
const newCount = count + 1;
setVar('request_count', newCount);

log(`Request #${newCount}`);

// Reset counter at threshold
if (newCount >= 100) {
  log('Resetting counter');
  setVar('request_count', '0');
}
```

### 7. Response Validation

**Post-Request: Validate Structure**
```javascript
// Validate response structure
const requiredFields = ['id', 'name', 'email'];
const missingFields = requiredFields.filter(field => !responseData[field]);

if (missingFields.length > 0) {
  log('⚠️ Warning: Missing fields:', missingFields.join(', '));
} else {
  log('✅ Response structure valid');
}

// Set validation flag
setVar('response_valid', missingFields.length === 0 ? 'true' : 'false');
```

---

## Best Practices

### 1. Always Check Response Status

```javascript
// Good
const response = await http('https://api.example.com/data');
if (response.status === 200) {
  setVar('data', response.data.value);
} else {
  log('Request failed with status:', response.status);
}

// Bad (no error checking)
const response = await http('https://api.example.com/data');
setVar('data', response.data.value); // Might fail if response is error
```

### 2. Use try/catch for HTTP Requests

```javascript
// Good
try {
  const response = await http('https://api.example.com/data');
  setVar('result', response.data);
} catch (error) {
  log('HTTP request failed:', error.message);
  setVar('fallback', 'true');
}
```

### 3. Log Important Steps

```javascript
log('Fetching authentication token...');
const response = await http(authUrl, options);
log('Token response status:', response.status);

if (response.status === 200) {
  setVar('token', response.data.access_token);
  log('✅ Token saved successfully');
} else {
  log('❌ Token fetch failed:', response.statusText);
}
```

### 4. Validate Before Using

```javascript
// Good
const token = getVar('access_token');
if (!token) {
  log('Warning: No access token found');
  // Fetch token or handle error
}

// Bad (assumes token exists)
const token = getVar('access_token');
const response = await http(url, {
  headers: { 'Authorization': `Bearer ${token}` } // token might be undefined
});
```

### 5. Use Descriptive Variable Names

```javascript
// Good
setVar('user_id', responseData.id);
setVar('access_token', tokenData.token);
setVar('token_expires_at', expiryTimestamp);

// Bad (unclear names)
setVar('x', responseData.id);
setVar('t', tokenData.token);
setVar('e', expiryTimestamp);
```

---

## Security & Sandboxing

### Sandbox Environment

Scripts run in a **sandboxed environment** with limited access:

**✅ Scripts CAN:**
- Read/write variables via `getVar()` / `setVar()`
- Make HTTP requests via `http()`
- Log messages via `log()`
- Use standard JavaScript (loops, conditionals, functions)
- Use async/await
- Access `response` and `responseData` (post-scripts only)

**❌ Scripts CANNOT:**
- Access the DOM (`document`, `window`)
- Access localStorage directly
- Modify the UI
- Access other browser APIs
- Use `eval()` or `Function()` constructor
- Access Tauri APIs directly

### Security Considerations

1. **Script Isolation**: Each script runs in its own scope
2. **No Persistent State**: Scripts don't maintain state between executions
3. **Limited Privileges**: Can only interact through provided functions
4. **Variable Scope**: Only access variables through `getVar()`/`setVar()`

### Safe Practices

```javascript
// ✅ Safe: Use provided functions
const apiKey = getVar('api_key');
setVar('last_request_time', Date.now());

// ❌ Unsafe: Don't try to access browser APIs
// window.location = 'https://malicious.com'; // Won't work (no window access)
// localStorage.setItem('key', 'value');      // Won't work (no localStorage)
```

---

## Examples

### Complete OAuth Flow

**Pre-Request Script:**
```javascript
// Complete OAuth authentication flow
const clientId = getVar('client_id');
const clientSecret = getVar('client_secret');
const authUrl = getVar('auth_url');

log('Starting OAuth flow...');

// Step 1: Get access token
const tokenResponse = await http(`${authUrl}/oauth/token`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`
});

if (tokenResponse.status === 200) {
  const token = tokenResponse.data.access_token;
  const expiresIn = tokenResponse.data.expires_in;
  
  setVar('access_token', token);
  setVar('token_expires_at', Date.now() + (expiresIn * 1000));
  
  log('✅ OAuth token obtained');
  log('Token expires in', expiresIn, 'seconds');
} else {
  log('❌ OAuth failed:', tokenResponse.status, tokenResponse.statusText);
  throw new Error('OAuth authentication failed');
}
```

### Extract and Chain

**Post-Request Script:**
```javascript
// Extract data and make follow-up request
if (response.status === 200) {
  const userId = responseData.user_id;
  const projectId = responseData.project_id;
  
  log('Extracted IDs:', { userId, projectId });
  
  setVar('current_user_id', userId);
  setVar('current_project_id', projectId);
  
  // Fetch additional details
  const baseUrl = getVar('baseUrl');
  const token = getVar('access_token');
  
  const detailsResponse = await http(`${baseUrl}/projects/${projectId}/details`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (detailsResponse.status === 200) {
    setVar('project_name', detailsResponse.data.name);
    setVar('project_status', detailsResponse.data.status);
    log('✅ Project details loaded:', detailsResponse.data.name);
  }
} else {
  log('❌ Request failed with status:', response.status);
}
```

### Dynamic Request Builder

**Pre-Request Script:**
```javascript
// Build complex request dynamically
const today = new Date();
const startDate = today.toISOString().split('T')[0];

const endDate = new Date(today);
endDate.setDate(today.getDate() + 30);
const endDateStr = endDate.toISOString().split('T')[0];

setVar('start_date', startDate);
setVar('end_date', endDateStr);

// Build query parameters
const filters = {
  from: startDate,
  to: endDateStr,
  status: 'active',
  limit: 100
};

const queryString = Object.entries(filters)
  .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
  .join('&');

setVar('query_params', queryString);

log('Query built:', queryString);
log('Date range:', startDate, 'to', endDateStr);
```

---

## Script Output

Scripts log to the **Script Output** section in the Result panel:

**Example Output:**
```
[Pre-Request Script]
[Pre-Log] Starting OAuth flow...
[HTTP] POST https://auth.example.com/oauth/token
[HTTP] Response 200 OK
[Pre-Script] Variable set: access_token = eyJhbGc...
[Pre-Script] Variable set: token_expires_at = 1705334400000
[Pre-Log] ✅ OAuth token obtained
[Pre-Log] Token expires in 3600 seconds

[Log] Response status: 200
[Script Success] Variable set: user_id = 12345
[Script Success] Variable set: user_name = John Doe
```

---

## Troubleshooting

### Script Doesn't Execute

- Check that a script is selected in the dropdown
- Verify the script is saved
- Look for syntax errors in the Script Output

### Variable Not Found

```javascript
const value = getVar('my_var');
if (value === undefined) {
  log('Variable not found - setting default');
  setVar('my_var', 'default_value');
}
```

### HTTP Request Fails

```javascript
try {
  const response = await http(url);
  log('Success:', response.status);
} catch (error) {
  log('Failed:', error.message);
  // Check network, URL, or permissions
}
```

### Async/Await Errors

```javascript
// ❌ Wrong: Forgot await
const response = http(url); // Returns Promise, not data

// ✅ Correct: Use await
const response = await http(url);
log(response.data);
```

---

## API Reference Summary

| Function | Purpose | Returns |
|----------|---------|---------|
| `getVar(key)` | Get variable value | `string \| undefined` |
| `setVar(key, value)` | Set variable value | `void` |
| `log(...args)` | Log to output | `void` |
| `http(url, options)` | Make HTTP request | `Promise<{status, statusText, headers, data}>` |
| `response` | Response object (post-script only) | `Response` |
| `responseData` | Parsed response body (post-script only) | `object \| string` |

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**See Also:** [ARCHITECTURE.md](ARCHITECTURE.md) | [TAURI.md](TAURI.md) | [README.md](README.md)

