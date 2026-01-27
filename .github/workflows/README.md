# GitHub Actions Workflows

This directory contains automated build workflows for Just REST Client.

## Workflows

### 1. `build.yml` - Continuous Integration Builds

**Triggers:**
- Every push to `main` or `master` branch
- Every pull request to `main` or `master` branch
- Manual trigger via GitHub Actions UI ("Run workflow" button)

**What it does:**
- Builds the app for macOS, Windows, and Linux in parallel
- Uploads build artifacts for download

**How to get the binaries:**
1. Go to your repo on GitHub
2. Click **Actions** tab
3. Click on the latest workflow run
4. Scroll down to **Artifacts** section
5. Download `macos-build`, `windows-build`, or `linux-build`

### 2. `release.yml` - Release Builds with Auto-Upload

**Triggers:**
- When you push a version tag (e.g., `v1.0.0`, `v1.2.3`)

**What it does:**
- Creates a GitHub Release
- Builds the app for all platforms
- Automatically uploads binaries to the release

**How to create a release:**

```bash
# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

Then:
1. Go to your repo on GitHub
2. Click **Releases** tab
3. Your new release will appear with downloadable binaries!

## Platform Support

✅ **macOS**: Builds `.dmg` installer  
✅ **Windows**: Builds `.msi` and `.exe` installers  
✅ **Linux**: Builds `.AppImage` and `.deb` packages

## Build Time

Typical build times:
- **macOS**: ~5-10 minutes
- **Windows**: ~5-10 minutes
- **Linux**: ~5-10 minutes

All three platforms build in parallel, so total wait time is ~10 minutes max.

## Free Usage

✅ **Unlimited** for public repositories  
✅ All platform builds included

## Troubleshooting

If builds fail:
1. Check the **Actions** tab for error logs
2. Look for the red ❌ next to failed steps
3. Click to expand and see the error message

Common issues:
- Missing dependencies: Check the "Install dependencies" steps
- Build errors: Check your local build works with `npm run tauri:build`
- Artifact paths: Verify file names in `tauri.conf.json`
