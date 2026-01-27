# GitHub Actions Troubleshooting

## Common Issues and Fixes

### Issue 1: `error: invalid value '1' for '--ci'`

**Problem:** Tauri CLI doesn't recognize the CI environment variable format.

**Fix Applied:**
- Changed build command to use `cargo tauri build` directly
- Added explicit environment variables to disable signing

### Issue 2: Artifact Upload Failures

**Problem:** Artifact paths might not match exactly due to version numbers in filenames.

**Fix Applied:**
- Upload entire directories instead of specific files
- Added `if-no-files-found: warn` to prevent hard failures
- Added debug step to list all build artifacts

### Issue 3: Rust Compilation Speed

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
