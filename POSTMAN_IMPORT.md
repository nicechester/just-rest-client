# Postman Import Guide

Just REST Client supports importing Postman Collections (v2.1.0 and compatible formats) and Postman Environments, allowing you to seamlessly migrate your existing data.

## Quick Start

### Importing a Collection

1. **Export from Postman**
   - Open Postman
   - Click on your collection
   - Click the three dots (⋯) menu
   - Select "Export"
   - Choose "Collection v2.1" format
   - Save the JSON file

2. **Import into Just REST Client**
   - Open Just REST Client (web or desktop app)
   - Click the **"Import"** button in the left sidebar (with dropdown arrow ▼)
   - Select **"📦 Import Postman"**
   - Choose your exported Postman Collection JSON file
   - Done! The collection is automatically imported

### Importing an Environment

1. **Export from Postman**
   - Open Postman
   - Click the Environments icon (top right)
   - Select your environment
   - Click the three dots (⋯) menu
   - Select "Export"
   - Save the JSON file

2. **Import into Just REST Client**
   - Open Just REST Client (web or desktop app)
   - Click the **"Import"** button in the left sidebar
   - Select **"📦 Import Postman"**
   - Choose your exported Postman Environment JSON file
   - Done! Variables are imported into a new group

### 3. Success!

You'll see a confirmation message:

```
✓ Postman Collection imported!

Group: Your Collection Name
Variables: X
Requests: Y
Scripts: Z
```

The app automatically switches to your new collection's group. All your variables, requests, and scripts are now available!

### 4. Next Steps

1. **Check Variables**: Go to Variables tab → verify your collection variables
2. **Add Missing Variables**: Some collections reference environment variables not in the export (like `{{baseUrl}}` or `{{access_token}}`) - add these manually
3. **Test a Request**: Select a simple request → Click Send
4. **Review Scripts**: If you have scripts, they'll need updating from Postman's `pm.*` API to Just REST Client's API

---

## What Gets Imported

### ✓ From Collections

| Feature | Details |
|---------|---------|
| **Variables** | Collection-level variables imported into a new group<br>• Variable syntax `{{varName}}` works as-is |
| **Requests** | All requests including nested folders<br>• Request names, methods, URLs, headers, bodies<br>• Folder structure preserved with " / " separators |
| **Scripts** | Pre-request and test scripts<br>• Automatically linked to their requests<br>• Need updating from Postman's `pm.*` API |
| **Folder Structure** | Nested folders become request name prefixes<br>• Example: "API / Users / Get User" |

### ✓ From Environments

| Feature | Details |
|---------|---------|
| **Environment Variables** | All enabled variables imported into a new group<br>• Group named after the environment<br>• Only enabled variables are imported |

### ✗ Not Supported (Ignored)

- Collection-level authentication (add as headers instead)
- Form data with file uploads
- GraphQL queries
- Postman-specific PM API features
- Collection-level scripts
- Request examples/responses

---

## Working with Imported Data

### Group Management

All imported data goes into a **new group** named after your collection. This means:
- ✓ Your existing data is completely safe
- ✓ No conflicts with existing requests/variables
- ✓ Easy to organize multiple collections
- ✓ Switch between groups using the dropdown at the top of each tab

### Missing Variables

Collections often reference environment or global variables that aren't in the collection export. Common examples:

- `{{baseUrl}}` / `{{api-url}}` - Base API URL
- `{{access_token}}` / `{{auth-token}}` - Authentication tokens
- `{{api-key}}` - API keys

**To add missing variables:**
1. Go to Variables tab
2. Select your collection's group (or "global" for shared variables)
3. Click "Add Variable"
4. Enter key and value

### Script Conversion

Postman scripts use the `pm.*` API which differs from Just REST Client. You'll need to update your scripts:

#### Common Conversions

```javascript
// ❌ Postman
pm.collectionVariables.set("sessionId", data.id);
pm.environment.set("token", response.access_token);
pm.variables.get("userId");
const jsonData = pm.response.json();

// ✅ Just REST Client
setVariable("sessionId", data.id);
setVariable("token", response.access_token);
getVariable("userId");
const jsonData = response; // response is already parsed
```

#### Script Types

**Pre-Request Scripts** (run before request):
- Setting up dynamic data
- Calculating signatures
- Preparing request payloads
- Fetching tokens from auth endpoints

**Post-Request Scripts** (run after response):
- Extracting data from responses
- Setting variables for subsequent requests
- Response validation
- Data transformation

**Available Functions:**
- `getVariable(key)` - Read a variable
- `setVariable(key, value)` - Write a variable
- `http(url, options)` - Make HTTP requests from scripts
- `log(...args)` - Console output for debugging
- Full `async/await` support

See [SCRIPTING.md](SCRIPTING.md) for complete documentation.

### Authentication

Collection-level auth isn't imported. Add authentication via:

**Option 1: Headers**
```
Authorization: Bearer {{access_token}}
```

**Option 2: Pre-Request Script**
```javascript
// Fetch token if not present
if (!getVariable("access_token")) {
  const authResp = await http("https://auth.api.com/token", {
    method: "POST",
    body: JSON.stringify({ client_id: "...", client_secret: "..." })
  });
  setVariable("access_token", authResp.access_token);
}
```

---

## Troubleshooting

### "Invalid Postman collection format"

**Cause:** Wrong export format or corrupted JSON

**Solution:** Make sure your JSON has this structure:
```json
{
  "info": {
    "name": "Your Collection",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [...],
  "variable": [...]
}
```

### Variables not resolving

**Symptoms:** You see `{{variableName}}` in responses instead of actual values

**Solutions:**
1. Check you're in the correct group (dropdown at top of each tab)
2. Verify variable names match exactly (case-sensitive)
3. Ensure syntax is `{{varName}}` not `{varName}` or `$varName`
4. Add missing environment/global variables manually

### Requests failing

**Common issues:**
- Missing variables → Add them to your variable group
- CORS errors (web version) → Use the desktop app for CORS-free requests
- Authentication → Add auth headers or pre-request scripts
- Invalid URLs → Check variable values are correct

### Scripts not working

**Steps to fix:**
1. Load a request with scripts
2. Click on Scripts tab
3. Review the imported script code
4. Update `pm.*` API calls to Just REST Client equivalents
5. Test and debug using `log()` statements

### Empty/missing body

**Issue:** Request body is empty after import

**Causes:**
- Postman used form-data (not supported)
- Postman used file upload (not supported)

**Solution:** Manually add the request body in raw JSON/text format

---

## Tips & Best Practices

### Before Importing

1. **Clean up your collection** - Remove deprecated requests you don't need
2. **Test in Postman** - Make sure your collection works in Postman first
3. **Document dependencies** - Note which environment variables are needed
4. **Export v2.1 format** - Always use Collection v2.1, not v2.0

### After Importing

1. **Create a checklist** - List all requests that need testing
2. **Test incrementally** - Start with simple GET requests, then complex ones
3. **Update scripts gradually** - Convert one script at a time
4. **Use global variables** - For shared values like `baseUrl`, use the "global" group

### Multiple Collections

Import multiple Postman collections - each creates its own group:
- Development APIs → "Dev APIs" group
- Production APIs → "Prod APIs" group  
- Testing Suite → "Tests" group

Switch between them using the group dropdown!

---

## Additional Resources

- 📖 [SCRIPTING.md](SCRIPTING.md) - Complete scripting guide with examples
- 🏗️ [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture details
- 🖥️ [TAURI.md](TAURI.md) - Desktop app setup and features

---

**Happy importing! 🚀**

Questions or issues? Check the browser console for detailed error messages.
