# Privacy Policy

**MediaFlow** respects your privacy. This document explains how we handle your data.

## Data Collection

**We do NOT collect any personal data.**

MediaFlow is a desktop application that runs entirely on your computer. We do not:

- ❌ Collect personal information
- ❌ Track your usage
- ❌ Send data to external servers
- ❌ Store your files on cloud services
- ❌ Use analytics or telemetry
- ❌ Require account registration

## Local Processing

All processing happens locally on your device:

- **Downloads** - Files are saved directly to your chosen folder
- **Audio Processing** - Pitch shifting and analysis run on your CPU/GPU
- **Stem Separation** - AI models run locally using your hardware
- **Settings** - Stored in your browser's localStorage

## Third-Party Services

MediaFlow uses these external services only when YOU initiate a download:

- **YouTube / TikTok / etc.** - When you paste a URL, we use `yt-dlp` to fetch media
- **No API keys required** - We don't proxy through our servers

## AI Models

Stem separation models are downloaded once and cached locally:
- Models are stored in `/tmp/audio-separator-models/` (or equivalent)
- No cloud AI services are used
- All inference runs on your local hardware

## Open Source

MediaFlow is open source. You can audit the code yourself:
- GitHub: https://github.com/intity01/MediaFlow

## Contact

Questions about privacy? Open an issue on GitHub.

---

**Last updated:** December 2025
