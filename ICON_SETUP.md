# Icon and Splash Setup

## Current Icon
The app now uses the JRC logo (`jrc-icon.png`) as the primary icon.

## Icon Locations
- **Web**: `/web/jrc-icon.png` - Used in browser tab, header, and about dialog
- **Tauri**: `/src-tauri/icons/icon.png` - Source icon for desktop app

## Regenerating Platform-Specific Icons (Tauri)

If you need to regenerate all platform-specific icons (macOS .icns, Windows .ico, iOS, Android, etc.) from the source icon:

### Option 1: Using Tauri CLI (Recommended)
```bash
npm install -g @tauri-apps/cli
cd src-tauri
tauri icon icons/icon.png
```

This will automatically generate:
- `icon.icns` (macOS)
- `icon.ico` (Windows)
- All iOS app icons
- All Android app icons
- Windows Store logos
- Various sized PNGs

### Option 2: Manual Icon Generation Tools
- **macOS**: Use `iconutil` or [Image2Icon](https://img2icnsapp.com/)
- **Windows**: Use [IcoFX](https://icofx.ro/) or online converters
- **Cross-platform**: [electron-icon-maker](https://www.npmjs.com/package/electron-icon-maker)

## Icon Requirements
- **Source PNG**: At least 1024x1024px, transparent background
- **Format**: PNG with alpha channel
- **Design**: Should work well at small sizes (32x32, 16x16)

## Current Setup
✅ Web icon updated (favicon and UI)
✅ Tauri source icon replaced
⚠️  Platform-specific icons (icns, ico) not yet regenerated

To complete the icon setup, run:
```bash
cd /Users/chester.kim/workspace/trashcan/just-rest-client
npm install -g @tauri-apps/cli
cd src-tauri
tauri icon icons/icon.png
```

This will ensure all platform variants use the new JRC logo.
