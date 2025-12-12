<div align="center">

# MediaFlow

**Free & Open Source Media Toolkit**

Download media, process audio, and separate stems with AI - all running locally on your computer.

[![Version](https://img.shields.io/badge/version-0.9.0--beta-orange.svg)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Made with Tauri](https://img.shields.io/badge/Made%20with-Tauri%202-FFC131?logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)

</div>

---

## Features

### Media Downloader
- Download from YouTube, TikTok, and more
- Auto-detect available quality (resolution, FPS)
- Batch download & playlist import
- Audio extraction (MP3, FLAC, WAV)

### Audio Lab
- Pitch shifting (-12 to +12 semitones)
- BPM detection
- Key detection
- Quick presets

### Stem Separator
- AI-powered stem separation (2/4/6 stems)
- Multiple models: Demucs, MDX-Net, VR Arch
- Output modes: All, Vocals Only, Instrumental, Drums, Bass
- GPU acceleration (CUDA)
- Built-in stem mixer with seekbar

## Quick Start

### Prerequisites
- Node.js 18+
- Rust toolchain
- Python 3.11 (for stem separation)
- `yt-dlp` on PATH
- FFmpeg on PATH

### Development
```bash
npm install
npm run tauri:dev
```

### Build
```bash
npm run tauri:build
```

## Dependencies

| Tool | Purpose |
|------|---------|
| yt-dlp | Media downloading |
| FFmpeg | Audio/video processing |
| Python 3.11 | AI model inference |
| audio-separator | Stem separation |
| PyTorch CUDA | GPU acceleration |

## Privacy

MediaFlow runs 100% locally. We don't collect any data. See [PRIVACY.md](PRIVACY.md) for details.

## License

MIT License - Free to use, modify, and distribute. See [LICENSE](LICENSE).

## Credits & Technologies

| Technology | Purpose |
|------------|---------|
| [Tauri 2](https://tauri.app) | Desktop framework |
| [React 19](https://react.dev) | UI framework |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Media downloading |
| [FFmpeg](https://ffmpeg.org) | Audio/video processing |
| [audio-separator](https://github.com/karaokenerds/python-audio-separator) | AI stem separation |
| [Demucs](https://github.com/facebookresearch/demucs) | AI model (Meta) |
| [MDX-Net](https://github.com/kuielab/mdx-net) | AI model |
| [PyTorch](https://pytorch.org) | GPU acceleration |
| [Tailwind CSS](https://tailwindcss.com) | Styling |
| [Lucide Icons](https://lucide.dev) | Icons |

## Author

**MAMIPOKO**

---

<div align="center">

Made with love in Thailand

Special thanks to all open source contributors

</div>
