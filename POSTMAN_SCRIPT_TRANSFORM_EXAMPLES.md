# Postman Script Transformation Examples

When importing Postman collections, Just REST Client automatically transforms Postman-specific script syntax to compatible equivalents.

## Transformation Rules

### 1. Response Data Access
**Postman:**
```javascript
const jsonData = pm.response.json();
console.log('Response:', jsonData);
```

**Just REST Client (auto-transformed):**
```javascript
const jsonData = responseData;
log('Response:', jsonData);
```

### 2. Variable Get
**Postman:**
```javascript
const token = pm.environment.get('access_token');
const userId = pm.collectionVariables.get('userId');
```

**Just REST Client (auto-transformed):**
```javascript
const token = getVar('access_token');
const userId = getVar('userId');
```

### 3. Variable Set
**Postman:**
```javascript
pm.environment.set('access_token', data.token);
pm.collectionVariables.set('sessionId', data.id);
```

**Just REST Client (auto-transformed):**
```javascript
setVar('access_token', data.token);
setVar('sessionId', data.id);
```

### 4. HTTP Requests (pm.sendRequest)
**Postman:**
```javascript
pm.sendRequest(
   "https://api.example.com/token",
   function (err, response) {
       var resp = response.json();
       pm.environment.set("token", resp.access_token);
   }
);
```

**Just REST Client (auto-transformed):**
```javascript
const response = await http("https://api.example.com/token");
var resp = response.data;
setVar("token", resp.access_token);
```

**Note:** The `http` function returns a promise, so it must be used with `await`. The response object has:
- `status` - HTTP status code
- `statusText` - Status message
- `headers` - Response headers
- `data` - Parsed response body (already JSON parsed if applicable)

### 5. HTTP Requests with Options
**Postman:**
```javascript
pm.sendRequest({
    url: 'https://api.example.com/data',
    method: 'POST',
    header: {
        'Content-Type': 'application/json'
    },
    body: {
        mode: 'raw',
        raw: JSON.stringify({ key: 'value' })
    }
}, function(err, response) {
    // Handle response
});
```

**Just REST Client (requires manual adjustment):**
```javascript
const response = await http('https://api.example.com/data', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ key: 'value' })
});
// Handle response.data
```

### 6. Logging
**Postman:**
```javascript
console.log('Debug info:', someVariable);
```

**Just REST Client (auto-transformed):**
```javascript
log('Debug info:', someVariable);
```

## Complete Example

### Original Postman Script:
```javascript
const jsonData = pm.response.json();
console.log('Response received:', jsonData);

if (jsonData.access_token) {
    pm.environment.set("access_token", jsonData.access_token);
    console.log('Token saved successfully');
}

// Fetch additional data
pm.sendRequest(
    "https://api.example.com/user",
    function (err, response) {
        var userData = response.json();
        pm.environment.set("userId", userData.id);
    }
);
```

### Auto-Transformed for Just REST Client:
```javascript
const jsonData = responseData;
log('Response received:', jsonData);

if (jsonData.access_token) {
    setVar("access_token", jsonData.access_token);
    log('Token saved successfully');
}

// Fetch additional data
const response = await http("https://api.example.com/user");
var userData = response.data;
setVar("userId", userData.id);
```

## Available Functions in Just REST Client Scripts

### Pre-Request Scripts:
- `getVar(key)` - Get variable value
- `setVar(key, value)` - Set variable value
- `log(...args)` - Log messages
- `http(url, options)` - Make HTTP requests (returns Promise)

### Post-Request Scripts:
- `response` - Native Fetch Response object
- `responseData` - Parsed response body (JSON or text)
- `getVar(key)` - Get variable value
- `setVar(key, value)` - Set variable value
- `log(...args)` - Log messages
- `http(url, options)` - Make HTTP requests (returns Promise)

## Notes

1. All transformations are applied automatically during Postman collection import
2. Complex `pm.sendRequest` patterns may require manual adjustment (a comment will be added to the script)
3. The `http` function is promise-based, so use `await` or `.then()`
4. Scripts run in an async context, so `await` can be used directly
5. Error handling: Use try-catch blocks for `http` requests
