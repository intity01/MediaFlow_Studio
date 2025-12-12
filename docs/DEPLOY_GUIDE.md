# MediaFlow Deploy Guide

## Branch Structure

```
main branch (default)
├── README.md          # Showcase with screenshots
├── LICENSE
├── PRIVACY.md
└── screenshots/       # App screenshots

master branch (source)
├── All source code
├── README.md          # Developer documentation
└── ...
```

## Step 1: Build Release

```bash
# Build the installer
npm run tauri:build
```

Output files will be in:
- `src-tauri/target/release/bundle/msi/` - Windows MSI installer
- `src-tauri/target/release/bundle/nsis/` - Windows NSIS installer

## Step 2: Create GitHub Release

1. Go to https://github.com/intity01/MediaFlow/releases
2. Click "Create a new release"
3. Tag: `v0.9.0-beta`
4. Title: `MediaFlow v0.9.0-beta`
5. Upload installer files
6. Add release notes

## Step 3: Setup Branches

### Main Branch (Showcase)
```bash
git checkout main

# Keep only these files:
# - README.md (use docs/MAIN_BRANCH_README.md)
# - LICENSE
# - PRIVACY.md
# - screenshots/ folder

git add .
git commit -m "Setup main branch for showcase"
git push origin main
```

### Master Branch (Source Code)
```bash
git checkout -b master
git add .
git commit -m "Full source code"
git push origin master
```

## Step 4: Take Screenshots

Take screenshots of:
1. Main app (Downloader tab)
2. Audio Lab tab
3. Stem Separator tab
4. Settings

Save to `screenshots/` folder:
- `app-preview.png` (main)
- `downloader.png`
- `audiolab.png`
- `stems.png`

## Step 5: Update GitHub Settings

1. Go to repo Settings > General
2. Set default branch to `main`
3. Add description: "Free media toolkit - Download, process audio, and separate stems with AI"
4. Add topics: `media`, `audio`, `video`, `downloader`, `stem-separator`, `ai`, `tauri`, `react`

## Release Notes Template

```markdown
## MediaFlow v0.9.0-beta

### Features
- 📥 Media Downloader (YouTube, TikTok, etc.)
- 🎛️ Audio Lab (Pitch shift, BPM/Key detection)
- 🎚️ AI Stem Separator (Demucs, MDX-Net)
- 🎮 GPU Acceleration (CUDA)

### Requirements
- Windows 10/11
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [FFmpeg](https://ffmpeg.org)
- Python 3.11 (for stem separation)

### Download
- `MediaFlow_0.9.0_x64-setup.exe` - Windows Installer

### Notes
This is a beta release. Please report issues on GitHub.
```
