# Release Guide

This guide explains how to create releases for Just REST Client.

## 🚀 Creating a New Release

### Method 1: Using Git Tags (Recommended)

When you push a version tag, GitHub Actions automatically builds and creates a release:

```bash
# 1. Make sure all changes are committed
git add .
git commit -m "Release v1.0.0"

# 2. Create and push a version tag
git tag v1.0.0
git push origin v1.0.0

# 3. GitHub Actions will:
#    - Build for macOS, Windows, and Linux
#    - Create a GitHub Release
#    - Upload all binaries automatically
```

### Method 2: Manual Release (If needed)

If you need to create a release manually:

```bash
# 1. Build locally
./build.sh

# 2. Go to GitHub: Releases → Draft a new release
# 3. Create a new tag (e.g., v1.0.0)
# 4. Upload the binaries from:
#    - src-tauri/target/release/bundle/dmg/*.dmg
#    - Or use GitHub Actions artifacts
```

## 📦 What Gets Released

Each release includes binaries for all platforms:

| Platform | File Pattern | Size | Description |
|----------|--------------|------|-------------|
| **macOS (Apple Silicon)** | `Just.REST.Client_VERSION_aarch64.dmg` | ~7 MB | For M1/M2/M3/M4 Macs |
| **macOS (Intel)** | `Just.REST.Client_VERSION_x64.dmg` | ~7 MB | For Intel Macs |
| **Windows (MSI)** | `Just.REST.Client_VERSION_x64_en-US.msi` | ~6 MB | Windows Installer |
| **Windows (EXE)** | `Just.REST.Client_VERSION_x64-setup.exe` | ~4 MB | Portable executable |
| **Linux (AppImage)** | `Just.REST.Client_VERSION_amd64.AppImage` | ~76 MB | Universal binary |
| **Linux (Deb)** | `Just.REST.Client_VERSION_amd64.deb` | ~7 MB | Debian/Ubuntu package |

Note: `VERSION` will be something like `0.1.0` or `1.0.0` depending on your release tag.

## 🏷️ Version Naming Convention

Follow [Semantic Versioning](https://semver.org/):

- `v1.0.0` - Major release (breaking changes)
- `v1.1.0` - Minor release (new features, backward compatible)
- `v1.0.1` - Patch release (bug fixes)

Examples:
```bash
git tag v1.0.0    # First stable release
git tag v1.1.0    # Added new scripting features
git tag v1.0.1    # Fixed bug in variable substitution
```

## ✅ Pre-Release Checklist

Before creating a release, make sure:

- [ ] All tests pass locally
- [ ] Version number updated in `src-tauri/tauri.conf.json`
- [ ] Version number updated in `package.json`
- [ ] CHANGELOG.md updated with release notes
- [ ] README.md is up to date
- [ ] All commits are pushed to main branch

## 📝 Writing Release Notes

Good release notes should include:

```markdown
## What's New
- ✨ New feature: OAuth2 flow support
- 🎨 Improved UI for variable editor
- 🐛 Fixed bug with header parsing

## Breaking Changes
- Changed variable syntax from `$var` to `{{var}}`

## Installation
Download the binary for your platform below!

## Full Changelog
https://github.com/nicechester/just-rest-client/compare/v0.9.0...v1.0.0
```

## 🔄 Updating an Existing Release

If you need to replace binaries in an existing release:

1. Go to the release page on GitHub
2. Click "Edit release"
3. Delete old binaries
4. Upload new binaries
5. Update release notes if needed
6. Save changes

## 🛠️ Troubleshooting

### GitHub Actions Build Fails

Check the workflow logs:
1. Go to Actions tab
2. Click on the failed workflow
3. Check logs for errors
4. Fix issues and re-push the tag:

```bash
# Delete local tag
git tag -d v1.0.0

# Delete remote tag
git push origin :refs/tags/v1.0.0

# Fix issues, commit, then re-create tag
git tag v1.0.0
git push origin v1.0.0
```

### Local Build Issues

Clean and rebuild:
```bash
npm run clean
./build.sh
```

## 📚 Resources

- [GitHub Releases Documentation](https://docs.github.com/en/repositories/releasing-projects-on-github)
- [Semantic Versioning](https://semver.org/)
- [Tauri Bundle Documentation](https://tauri.app/v1/guides/building/)
- [Keep a Changelog](https://keepachangelog.com/)

## 🎯 Quick Commands Reference

```bash
# Create and push a release tag
git tag v1.0.0 && git push origin v1.0.0

# List all tags
git tag -l

# Delete a tag (local and remote)
git tag -d v1.0.0 && git push origin :refs/tags/v1.0.0

# View release workflow status
gh run list --workflow=release.yml

# Download artifacts from latest workflow
gh run download
```
