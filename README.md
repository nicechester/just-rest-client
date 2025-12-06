# Just REST Client

<div align="center">
  <img src="screenshot-request.png" alt="Just REST Client Screenshot" width="600"/>
</div>

Just REST Client is a lightweight, single-page application (SPA) client built to test and interact with RESTful APIs. It features variable templating, configurable HTTP methods, and a dedicated response viewer for body, headers, and script output.

## 🔗 Usage Options

### Web Version
You can access the live version of the application here:
[https://nicechester.github.io/just-rest-client/web/](https://nicechester.github.io/just-rest-client/web/)

### Desktop App (Tauri)

#### Download

Download MacOS binary at https://github.com/nicechester/just-rest-client/blob/main/downloads/just_rest_client_0.1.0_aarch64.dmg 

#### Build from source codes

Run as a native desktop application with **no CORS restrictions**:

```bash
# Development (single command)
./dev.sh

# OR manually in two terminals:
# Terminal 1: Start Vite dev server
npm run dev

# Terminal 2: Run Tauri
npm run tauri:dev

# Build production app
./build.sh

# OR manually:
npm run tauri:build
```

**Benefits of Desktop App:**
- ✅ No CORS restrictions - call any API
- ✅ Better SSL/TLS handling
- ✅ Native performance
- ✅ Offline capable

**Documentation:**
- 📖 [SCRIPTING.md](SCRIPTING.md) - Complete scripting guide with examples
- 🏗️ [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture and design
- 🖥️ [TAURI.md](TAURI.md) - Desktop app setup and Tauri features

## ✨ Features

### Core Features
- **Environment Variables**: Manage variables with intuitive UI, use `{{variableName}}` syntax in URLs, headers, and bodies
- **Variable Groups**: Organize variables by environment (dev, staging, production) with global scope inheritance
- **Request Configuration**: HTTP methods (GET, POST, PUT, DELETE, PATCH, HEAD) with custom headers and body
- **Result Viewer**: Comprehensive view showing processed request and response with JSON syntax highlighting

### Advanced Scripting
- **Pre-Request Scripts**: Execute JavaScript *before* requests to set variables, fetch tokens, or compute values
- **Post-Request Scripts**: Run JavaScript *after* requests to parse responses and extract data
- **HTTP Client in Scripts**: Make additional HTTP requests from scripts (no CORS in desktop app!)
- **Available Functions**:
  - `getVar(key)` - Read variables
  - `setVar(key, value)` - Write variables
  - `http(url, options)` - Make HTTP requests
  - `log(...args)` - Output logging
  - Full `async/await` support

### Organization
- **Request Collections**: Group API calls by feature, module, or environment
- **Script Libraries**: Organize reusable pre/post-request scripts
- **Export/Import**: Backup and share collections with team members
- **JSON Viewer**: Interactive, syntax-highlighted visualization

### Developer Experience
- **CodeMirror Editor**: Syntax-highlighted JavaScript editor for scripts
- **cURL Generator**: Export requests as cURL commands
- **Inline Variable Editing**: Click variables to edit inline
- **Custom Modals**: Native-like dialogs for better UX
- **Responsive UI**: Built with Tailwind CSS

## 🚀 Getting Started

To use the client, follow these steps:

### 1. Configure the Request

- **Select Method**: Choose the desired HTTP method from the dropdown (e.g., GET, POST).
- **Enter URL**: Input the target API endpoint into the URL text box. You can use global variables here (e.g., `{{baseUrl}}/users/{{userId}}`).
- **Request Body**: If using POST, PUT, or PATCH, enter the data payload (e.g., JSON) into the Request Body area.

### 2. Environment Variables (Sidebar)

- **Manage Variables**: Add, view, and delete environment variables using the Variables tab.
- **Defaults**: The application starts with default variables (e.g., `baseUrl`, `token`) for testing.
- **Variable Substitution**: Any string enclosed in double curly braces (`{{...}}`) in URLs, headers, or body is automatically replaced with the corresponding variable value.
- **Persistence**: All variables are saved to localStorage and persist across sessions.

### 3. Pre-Request Scripts

- **Dynamic Variables**: Execute JavaScript before the request to prepare data
- **Use Cases**: 
  - Generate timestamps or dynamic values
  - Fetch OAuth tokens from auth servers
  - Compute signatures or hashes
  - Build complex request payloads
- **Available Functions**: `getVar()`, `setVar()`, `log()`, `http()`

```javascript
// Example: Fetch OAuth token before request
const response = await http('https://auth.api.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    client_id: getVar('client_id'),
    client_secret: getVar('client_secret')
  })
});

if (response.status === 200) {
  setVar('access_token', response.data.access_token);
  log('Token obtained:', response.data.access_token);
}
```

### 4. Post-Request Scripts

- **Extract Data**: Parse response and save values as variables
- **Chain Requests**: Extract IDs/tokens and make follow-up requests
- **Validation**: Check response structure and validate data
- **Available Context**: `response`, `responseData`, `getVar()`, `setVar()`, `log()`, `http()`

```javascript
// Example: Extract data and chain request
if (response.status === 200) {
  const userId = responseData.id;
  setVar('user_id', userId);
  
  // Make follow-up request
  const detailsResponse = await http(`https://api.example.com/users/${userId}/details`, {
    headers: {
      'Authorization': `Bearer ${getVar('access_token')}`
    }
  });
  
  setVar('user_name', detailsResponse.data.name);
  log('User loaded:', detailsResponse.data.name);
}
```

**See [SCRIPTING.md](SCRIPTING.md) for complete documentation with more examples.**

### 5. Send and View Results

- Click the **Send** button.
- Pre-request scripts execute first (if configured).
- The application processes the request, substitutes variables, and executes the fetch.
- Post-request scripts run after receiving the response.
- The main panel automatically switches to the **Result** tab.

#### Result Details:

- **Request Summary**: Shows the final processed request line, headers, and body (with JSON visualization).
- **Response Body**: Interactive JSON viewer or formatted text showing the server's payload.
- **Response Headers**: All headers returned by the server.
- **Script Output**: Logs from both pre-request and post-request scripts.

## 🛠️ Development & Architecture

The Just REST Client is a modern web application designed with modularity in mind, using ES Modules for separation of concerns.

### Project Structure

The JavaScript logic is divided into the following modules:

- **`app.js`**: The main entry point. Handles UI initialization, state management, and event handlers (like the "Send Request" button click). It orchestrates the flow between the UI and the other modules.
- **`request.js`**: Contains the core logic for executing the fetch request, applying variable templates to the URL and Body, and handling the response and error states.
- **`variable.js`**: Manages the global variable store, providing `setVariable` and `getVariableStore` functions.
- **`scripting.js`**: (Placeholder) Responsible for executing the user-defined JavaScript code after the API request is complete.
- **`storage.js`**: Handles data persistence using `localStorage` for variables, saved requests, and scripts.

### Technologies Used

- **HTML5 / CSS3**
- **JavaScript (ES Modules)**
- **Tailwind CSS**: For utility-first styling and responsive design.

## 📝 Roadmap

Future planned features include:

- ✅ ~~Variable groups~~ (Implemented)
- ✅ ~~Request collections~~ (Implemented via groups)
- ✅ ~~HTTP client in scripts~~ (Implemented)
- ✅ ~~Request chaining~~ (Implemented via scripts)
- Request history with search and filtering
- Support for form data and multipart uploads
- GraphQL support
- WebSocket testing
- Environment variable sync across devices
- Dark mode toggle

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.