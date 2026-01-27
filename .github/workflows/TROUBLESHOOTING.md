# GitHub Actions Troubleshooting

## Common Issues and Fixes

### Issue 1: `error: invalid value '1' for '--ci'`

**Problem:** Tauri CLI doesn't recognize the CI environment variable format.

**Fix Applied:**
- Added `@tauri-apps/cli` as a devDependency
- Set `CI: false` in workflow environment variables
- Use npm-based Tauri CLI instead of cargo directly

### Issue 2: Linux Build - Package Conflicts

**Problem 1:** Ubuntu 22.04+ replaced `libwebkit2gtk-4.0-dev` with `libwebkit2gtk-4.1-dev`.

**Problem 2:** `libappindicator3-dev` and `libayatana-appindicator3-dev` conflict with each other.

**Fix Applied:**
- Updated to use `libwebkit2gtk-4.1-dev` (newer WebKit)
- Use `libayatana-appindicator3-dev` only (Ayatana is the modern fork, replaces the old libappindicator)

### Issue 3: AppImage - "couldn't find a square icon to use"

**Problem:** The icons listed in `tauri.conf.json` were not actually square (they were 669x413).

**Fix Applied:**
- Use the `Square*Logo.png` icons which are properly square
- Include multiple sizes from 30x30 to 310x310 for different platforms

### Issue 3: Artifact Upload Failures

**Problem:** Artifact paths might not match exactly due to version numbers in filenames.

**Fix Applied:**
- Upload entire directories instead of specific files
- Added `if-no-files-found: warn` to prevent hard failures
- Added debug step to list all build artifacts

### Issue 4: Rust Compilation Speed

**Fix Applied:**
- Added Rust caching with `swatinem/rust-cache@v2`
- Caches Cargo dependencies between builds
- Reduces build time by ~50%

## Debugging Build Failures

### Step 1: Check the Logs
1. Go to **Actions** tab in GitHub
2. Click on the failed workflow run
3. Click on the failed job (macOS, Windows, or Linux)
4. Look for red ❌ marks and expand those sections

### Step 2: Look for Common Errors

**Rust compilation errors:**
```
error[E0425]: cannot find value `xyz` in this scope
```
→ Fix the Rust code in `src-tauri/src/`

**npm build errors:**
```
Error: Cannot find module 'xyz'
```
→ Add the missing dependency: `npm install xyz`

**Tauri build errors:**
```
Error: Failed to bundle project
```
→ Check `tauri.conf.json` for configuration issues

### Step 3: Test Locally First

Before pushing to GitHub, always test locally:

```bash
# Test frontend build
npm run build

# Test full Tauri build
cargo tauri build
```

If it works locally but fails on GitHub Actions, it's usually:
- Missing dependencies in the workflow
- Platform-specific issues
- Environment variable differences

## Getting Help

### View Debug Output

The workflow now includes a "List build artifacts" step that shows what was actually built. Check this to see if files are in unexpected locations.

### Platform-Specific Issues

**macOS:**
- Requires code signing for distribution (disabled in our workflow)
- Builds `.dmg` and `.app` bundles

**Windows:**
- Builds `.msi` (Windows Installer) and `.exe` (NSIS installer)
- May show warnings about code signing

**Linux:**
- Builds `.AppImage` (universal) and `.deb` (Debian/Ubuntu)
- Requires several system libraries

## Workflow Updates

If you need to update the workflow:

```bash
# Edit the workflow files
vi .github/workflows/build.yml

# Commit and push
git add .github/
git commit -m "Update GitHub Actions workflow"
git push
```

The workflow will automatically run with your changes!

## Success Indicators

A successful build will show:
- ✅ Green checkmark next to the workflow run
- Artifacts available for download
- No red error messages in logs

Build times:
- **First build**: 15-20 minutes (compiling Rust from scratch)
- **Cached builds**: 5-10 minutes (with Rust cache)
