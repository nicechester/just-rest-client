# URL Encoding and Special Characters

## The Issue

When using the browser version of Just REST Client, the `fetch()` API automatically URL-encodes special characters in URLs. This can cause problems if your variable values contain characters like `{`, `}`, `[`, `]`, etc.

### Example Problem

If you have a variable:
```
userId = {D0883CBD8D-D81D-4293-9CE1-911B6C5D77C0}
```

And use it in a URL:
```
{{svc-url}}/users/{{userId}}/sessions
```

The browser will encode it to:
```
http://localhost:8000/users/%7BD0883CBD8D-D81D-4293-9CE1-911B6C5D77C0%7D/sessions
```

Where `{` becomes `%7B` and `}` becomes `%7D`.

## Why cURL Works But Just REST Client Doesn't

- **cURL**: When you export to cURL, the URL is wrapped in quotes (`'...'`), and curl/shell preserve the special characters as-is
- **Browser fetch()**: Automatically encodes special characters per URL standards (RFC 3986)

## Solutions

### Solution 1: Remove Special Characters from Variables (Recommended)

Store variable values **without** the curly braces:

```javascript
// Instead of:
userId = {D0883CBD8D-D81D-4293-9CE1-911B6C5D77C0}

// Use:
userId = D0883CBD8D-D81D-4293-9CE1-911B6C5D77C0
```

If the server endpoint requires braces, add them in the URL template:
```
{{svc-url}}/users/{{{userId}}}/sessions
```

### Solution 2: Use the Tauri Desktop App (No CORS, Better Control)

The Tauri desktop version uses native HTTP instead of browser fetch, which:
- ✅ Bypasses CORS restrictions  
- ✅ Better control over URL encoding
- ✅ No browser security limitations

Build the desktop app with:
```bash
npm run tauri dev
# or
npm run tauri build
```

### Solution 3: Pre-encode in Pre-Request Script

Use a pre-request script to encode only the parts you want:

```javascript
// Pre-Request Script
const userId = getVar('userId');
// Remove curly braces
const cleanUserId = userId.replace(/[{}]/g, '');
setVar('cleanUserId', cleanUserId);
```

Then use `{{cleanUserId}}` in your URL instead of `{{userId}}`.

## Characters That Get URL-Encoded

The following characters are automatically encoded by `fetch()`:
- `{ }` → `%7B %7D`
- `[ ]` → `%5B %5D`
- `< >` → `%3C %3E`
- `" "` → `%22 %20`
- `|` → `%7C`
- `\` → `%5C`
- `^` → `%5E`

## Server-Side Considerations

Most modern web servers and frameworks automatically decode percent-encoded URLs, so `%7BD0883CBD8D%7D` becomes `{D0883CBD8D}` on the server side. However, some servers/APIs may:

1. Not decode path parameters properly
2. Have strict routing rules that expect literal characters
3. Require exact URL matches

If your cURL command works but Just REST Client doesn't, it's likely one of these server-side issues combined with how the browser encodes URLs.

## Checking if This is Your Issue

Look at the "Script Output" section after sending a request. If you see:

```
⚠️  URL contains encoded { } characters that may cause issues
```

Then this is affecting your request. Try Solution 1 or 2 above.
