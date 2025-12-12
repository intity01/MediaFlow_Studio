use chrono::Utc;
use dirs::download_dir;
use serde::Serialize;
use serde_json::json;
use std::{
    fs,
    path::PathBuf,
    process::{Command, Output},
};
use tauri_plugin_dialog::DialogExt;

/// Get the Python command that works on this system ("python" or "py" on Windows)
fn get_python_command() -> &'static str {
    // Try "python" first
    if let Ok(output) = Command::new("python").arg("--version").output() {
        if output.status.success() {
            return "python";
        }
    }
    // Fallback to "py" (Windows Python Launcher)
    "py"
}

/// Get Python 3.11 command for demucs (requires older Python)
fn get_python311_command() -> Vec<String> {
    // Try py -3.11 first (Windows Python Launcher)
    if let Ok(output) = Command::new("py").args(&["-3.11", "--version"]).output() {
        if output.status.success() {
            return vec!["py".to_string(), "-3.11".to_string()];
        }
    }
    // Fallback to default python
    vec![get_python_command().to_string()]
}

#[derive(Serialize)]
struct VideoFormatPayload {
    format_id: String,
    ext: String,
    resolution: Option<String>,
    fps: Option<f64>,
    filesize: Option<f64>,
    vcodec: Option<String>,
    acodec: Option<String>,
}

#[derive(Serialize)]
struct VideoInfoPayload {
    title: String,
    duration: f64,
    thumbnail: String,
    uploader: String,
    formats: Vec<VideoFormatPayload>,
}

#[derive(Serialize)]
struct DownloadPayload {
    filename: String,
    path: String,
}

fn mediaflow_download_dir() -> Result<PathBuf, String> {
    let mut base = download_dir().ok_or("Unable to locate the system Downloads directory")?;
    base.push("MediaFlow");
    fs::create_dir_all(&base)
        .map_err(|err| format!("Failed to create MediaFlow download folder: {err}"))?;
    Ok(base)
}

fn timestamp_suffix() -> String {
    Utc::now().format("%Y%m%d%H%M%S").to_string()
}

fn to_path_string(path: &PathBuf) -> Result<String, String> {
    path.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Unable to convert path to string".to_string())
}

fn ensure_success(output: &Output) -> Result<(), String> {
    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "yt-dlp exited with code {:?}: {}",
            output.status.code(),
            stderr
        ))
    }
}

fn yt_dlp(args: &[String]) -> Result<Output, String> {
    Command::new("yt-dlp")
        .args(args)
        .output()
        .map_err(|err| format!("Failed to run yt-dlp. Is it installed and on PATH? {err}"))
}

fn synthesize_info_from_value(value: serde_json::Value) -> Result<VideoInfoPayload, String> {
    let primary = if let Some(entries) = value.get("entries").and_then(|v| v.as_array()) {
        entries.first().cloned().unwrap_or(value)
    } else {
        value
    };

    let title = primary
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown Title")
        .to_string();
    let duration = primary
        .get("duration")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);
    let thumbnail = primary
        .get("thumbnail")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let uploader = primary
        .get("uploader")
        .and_then(|v| v.as_str())
        .unwrap_or("Unknown")
        .to_string();

    let mut formats = Vec::new();
    if let Some(items) = primary.get("formats").and_then(|v| v.as_array()) {
        for fmt in items {
            if let Some(format_id) = fmt.get("format_id").and_then(|v| v.as_str()) {
                formats.push(VideoFormatPayload {
                    format_id: format_id.to_string(),
                    ext: fmt
                        .get("ext")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    resolution: fmt
                        .get("resolution")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    fps: fmt.get("fps").and_then(|v| v.as_f64()),
                    filesize: fmt
                        .get("filesize")
                        .or_else(|| fmt.get("filesize_approx"))
                        .and_then(|v| v.as_f64()),
                    vcodec: fmt
                        .get("vcodec")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    acodec: fmt
                        .get("acodec")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                });
            }
        }
    }

    Ok(VideoInfoPayload {
        title,
        duration,
        thumbnail,
        uploader,
        formats,
    })
}

fn download_audio_sync(
    url: String,
    quality: Option<String>,
    format: Option<String>,
    download_path: Option<String>,
) -> Result<String, String> {
    let dir = if let Some(path) = download_path {
        let p = PathBuf::from(path);
        if !p.exists() {
            fs::create_dir_all(&p).map_err(|e| format!("Failed to create download dir: {}", e))?;
        }
        p
    } else {
        mediaflow_download_dir()?
    };
    let requested_format = format.unwrap_or_else(|| "mp3".to_string());
    
    // Create filename base without extension (yt-dlp will add it)
    let filename_base = format!(
        "mediaflow_audio_{}",
        timestamp_suffix()
    );
    let target_template = dir.join(&filename_base);
    
    let mut quality_arg = quality.unwrap_or_else(|| "320".to_string());
    if quality_arg != "0" && !quality_arg.to_lowercase().ends_with('k') {
        quality_arg.push_str("K");
    }

    let output = yt_dlp(&vec![
        "-x".into(),
        "--audio-format".into(),
        requested_format.clone(),
        "--audio-quality".into(),
        quality_arg,
        "-o".into(),
        to_path_string(&target_template)?,  // No extension - yt-dlp adds it
        url,
    ])?;

    ensure_success(&output)?;

    // Find the actual downloaded file (yt-dlp adds the extension)
    let actual_filename = format!("{}.{}", filename_base, requested_format);
    let actual_path = dir.join(&actual_filename);

    let payload = DownloadPayload {
        filename: actual_filename,
        path: to_path_string(&actual_path)?,
    };
    serde_json::to_string(&payload).map_err(|err| err.to_string())
}

fn download_video_sync(
    url: String,
    resolution: Option<String>,
    include_audio: Option<bool>,
    fps: Option<i32>,
    container: Option<String>,
    download_path: Option<String>,
) -> Result<String, String> {
    let dir = if let Some(path) = download_path {
        let p = PathBuf::from(path);
        if !p.exists() {
            fs::create_dir_all(&p).map_err(|e| format!("Failed to create download dir: {}", e))?;
        }
        p
    } else {
        mediaflow_download_dir()?
    };
    let res = resolution.unwrap_or_else(|| "1080".to_string());
    let fps = fps.unwrap_or(30);
    let include_audio = include_audio.unwrap_or(true);
    let container = container.unwrap_or_else(|| "mp4".to_string());

    let filename = format!("mediaflow_video_{}.{}", timestamp_suffix(), container);
    let target = dir.join(&filename);

    let video_selector = format!("bestvideo[height<={res}][fps<={fps}]");
    let format_selector = if include_audio {
        format!("{video_selector}+bestaudio/best[height<={res}][fps<={fps}]")
    } else {
        video_selector
    };

    let args = vec![
        "-f".into(),
        format_selector,
        "--merge-output-format".into(),
        container.clone(),
        "-o".into(),
        to_path_string(&target)?,
        url,
    ];

    let output = yt_dlp(&args)?;
    ensure_success(&output)?;

    let payload = DownloadPayload {
        filename,
        path: to_path_string(&target)?,
    };
    serde_json::to_string(&payload).map_err(|err| err.to_string())
}

/// Find the scripts directory - tries multiple locations
fn find_scripts_dir() -> Result<PathBuf, String> {
    // Try multiple possible locations
    let possible_paths = vec![
        // Current directory (when running from project root)
        std::env::current_dir().ok().map(|p| p.join("scripts")),
        // Parent directory (when running from src-tauri)
        std::env::current_dir().ok().and_then(|p| p.parent().map(|pp| pp.join("scripts"))),
        // Executable directory
        std::env::current_exe().ok().and_then(|p| p.parent().map(|pp| pp.join("scripts"))),
        // Executable's parent directory
        std::env::current_exe().ok().and_then(|p| p.parent().and_then(|pp| pp.parent()).map(|ppp| ppp.join("scripts"))),
        // Two levels up from executable (for debug builds)
        std::env::current_exe().ok().and_then(|p| {
            p.parent()
                .and_then(|p1| p1.parent())
                .and_then(|p2| p2.parent())
                .and_then(|p3| p3.parent())
                .map(|p4| p4.join("scripts"))
        }),
    ];

    for path_opt in possible_paths {
        if let Some(path) = path_opt {
            if path.exists() && path.join("audio_analyzer.py").exists() {
                return Ok(path);
            }
        }
    }

    Err("Scripts directory not found. Make sure 'scripts/audio_analyzer.py' exists.".to_string())
}

fn detect_tempo_sync(audio_path: String) -> Result<String, String> {
    // Check if file exists
    if !PathBuf::from(&audio_path).exists() {
        return Err(format!("Audio file not found: {}", audio_path));
    }

    let scripts_dir = find_scripts_dir()?;
    let script_path = scripts_dir.join("audio_analyzer.py");
    
    // Call Python script for tempo detection
    let output = Command::new(get_python_command())
        .args(&[
            script_path.to_str().ok_or("Invalid script path")?,
            "tempo",
            &audio_path
        ])
        .output()
        .map_err(|err| format!("Failed to run audio analyzer: {}. Make sure Python and pydub are installed.", err))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Audio analysis failed: {}", stderr));
    }

    // Return the JSON output from Python script
    String::from_utf8(output.stdout)
        .map_err(|err| format!("Failed to parse output: {}", err))
}

fn detect_key_sync(audio_path: String) -> Result<String, String> {
    // Check if file exists
    if !PathBuf::from(&audio_path).exists() {
        return Err(format!("Audio file not found: {}", audio_path));
    }

    let scripts_dir = find_scripts_dir()?;
    let script_path = scripts_dir.join("audio_analyzer.py");
    
    // Call Python script for key detection
    let output = Command::new(get_python_command())
        .args(&[
            script_path.to_str().ok_or("Invalid script path")?,
            "key",
            &audio_path
        ])
        .output()
        .map_err(|err| format!("Failed to run audio analyzer: {}. Make sure Python and pydub are installed.", err))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Audio analysis failed: {}", stderr));
    }

    // Return the JSON output from Python script
    String::from_utf8(output.stdout)
        .map_err(|err| format!("Failed to parse output: {}", err))
}

fn pitch_shift_sync(
    input_path: String,
    output_path: Option<String>,
    semitones: f32,
) -> Result<String, String> {
    let source = PathBuf::from(&input_path);
    if !source.exists() {
        return Err("Input file not found".to_string());
    }
    
    let semitones_i32 = semitones.round() as i32;
    let pitch_suffix = if semitones_i32 >= 0 {
        format!("_pitch+{}", semitones_i32)
    } else {
        format!("_pitch{}", semitones_i32)  // negative already has minus sign
    };
    
    let destination = output_path.map(PathBuf::from).unwrap_or_else(|| {
        let stem = source
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("output");
        let extension = source
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("mp3");
        source.with_file_name(format!("{stem}{pitch_suffix}.{extension}"))
    });

    // Use FFmpeg with asetrate filter for pitch shifting
    // Formula: new_rate = original_rate * 2^(semitones/12)
    let pitch_factor = 2.0_f32.powf(semitones / 12.0);
    
    // FFmpeg command: use asetrate and atempo filters
    // asetrate changes pitch and speed, atempo corrects speed back to normal
    let filter = if semitones.abs() > 0.01 {
        format!("asetrate=44100*{},aresample=44100,atempo={}", pitch_factor, 1.0 / pitch_factor)
    } else {
        // No pitch shift needed, just copy
        "copy".to_string()
    };

    let mut args = vec![
        "-i".to_string(),
        to_path_string(&source)?,
        "-y".to_string(), // Overwrite output
    ];

    if filter != "copy" {
        args.extend(vec![
            "-af".to_string(),
            filter,
        ]);
    }

    args.push(to_path_string(&destination)?);

    let output = Command::new("ffmpeg")
        .args(&args)
        .output()
        .map_err(|err| format!("Failed to run ffmpeg. Is it installed and in PATH? {}", err))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("FFmpeg pitch shift failed: {}", stderr));
    }

    serde_json::to_string(&json!({
        "success": true,
        "output": to_path_string(&destination)?,
        "semitones": semitones
    }))
    .map_err(|err| err.to_string())
}

fn separate_stems_sync(
    input_path: String,
    output_dir: Option<String>,
    stems: u8,
    _format: Option<String>,
    model_name: Option<String>,
    use_gpu: Option<bool>,
) -> Result<String, String> {
    let source = PathBuf::from(&input_path);
    if !source.exists() {
        return Err("Input file not found".to_string());
    }
    
    // Validate stems count
    if stems != 2 && stems != 4 {
        return Err("Stems must be 2 or 4".to_string());
    }
    
    let target_dir = output_dir.map(PathBuf::from).unwrap_or_else(|| {
        let stem = source
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("output");
        source.with_file_name(format!("{stem}_stems"))
    });
    
    let scripts_dir = find_scripts_dir()?;
    let script_path = scripts_dir.join("stem_separator.py");
    
    // Use Python 3.11 for compatibility
    let python_cmd = get_python311_command();
    let mut cmd = Command::new(&python_cmd[0]);
    
    if python_cmd.len() > 1 {
        cmd.arg(&python_cmd[1]);
    }
    
    // Get model name (default to best quality MDX model)
    let model = model_name.unwrap_or_else(|| "UVR-MDX-NET-Inst_HQ_3".to_string());
    
    // GPU setting (default true)
    let gpu_str = if use_gpu.unwrap_or(true) { "true" } else { "false" };
    
    // Call Python script
    let output = cmd
        .args(&[
            script_path.to_str().ok_or("Invalid script path")?,
            &input_path,
            target_dir.to_str().ok_or("Invalid output path")?,
            &stems.to_string(),
            &model,
            gpu_str
        ])
        .output()
        .map_err(|err| format!("Failed to run stem separator: {}. Make sure Python 3.11 and audio-separator are installed.", err))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Stem separation failed: {}", stderr));
    }

    // Return the JSON output from Python script
    String::from_utf8(output.stdout)
        .map_err(|err| format!("Failed to parse output: {}", err))
}

#[tauri::command]
pub async fn get_video_info(url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let output = yt_dlp(&vec!["-J".into(), url])?;
        ensure_success(&output)?;
        let parsed: serde_json::Value =
            serde_json::from_slice(&output.stdout).map_err(|err| err.to_string())?;
        let info = synthesize_info_from_value(parsed)?;
        serde_json::to_string(&info).map_err(|err| err.to_string())
    })
    .await
    .map_err(|err| err.to_string())?
}

#[derive(Serialize)]
struct PlaylistItem {
    url: String,
    title: String,
    duration: f64,
}

#[derive(Serialize)]
struct PlaylistInfo {
    title: String,
    count: usize,
    items: Vec<PlaylistItem>,
}

#[tauri::command]
pub async fn get_playlist_info(url: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        // Use --flat-playlist to get playlist items without downloading
        let output = yt_dlp(&vec![
            "-J".into(),
            "--flat-playlist".into(),
            url
        ])?;
        ensure_success(&output)?;
        
        let parsed: serde_json::Value =
            serde_json::from_slice(&output.stdout).map_err(|err| err.to_string())?;
        
        let playlist_title = parsed
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("Playlist")
            .to_string();
        
        let mut items = Vec::new();
        
        if let Some(entries) = parsed.get("entries").and_then(|v| v.as_array()) {
            for entry in entries {
                let video_id = entry.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let video_url = entry.get("url").and_then(|v| v.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| {
                        // Construct YouTube URL from video ID
                        if !video_id.is_empty() {
                            format!("https://www.youtube.com/watch?v={}", video_id)
                        } else {
                            String::new()
                        }
                    });
                
                if video_url.is_empty() {
                    continue;
                }
                
                let title = entry.get("title").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
                let duration = entry.get("duration").and_then(|v| v.as_f64()).unwrap_or(0.0);
                
                items.push(PlaylistItem {
                    url: video_url,
                    title,
                    duration,
                });
            }
        }
        
        let info = PlaylistInfo {
            title: playlist_title,
            count: items.len(),
            items,
        };
        
        serde_json::to_string(&info).map_err(|err| err.to_string())
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn download_audio(
    url: String,
    quality: Option<String>,
    format: Option<String>,
    download_path: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || download_audio_sync(url, quality, format, download_path))
        .await
        .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn download_video(
    url: String,
    resolution: Option<String>,
    include_audio: Option<bool>,
    fps: Option<i32>,
    container: Option<String>,
    download_path: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        download_video_sync(url, resolution, include_audio, fps, container, download_path)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn get_default_download_dir() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let dir = mediaflow_download_dir()?;
        to_path_string(&dir)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn select_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |file_path| {
        let _ = tx.send(file_path);
    });
    let file_path = rx.await.map_err(|e| e.to_string())?;
    Ok(file_path.map(|p| p.to_string()))
}

#[tauri::command(rename_all = "snake_case")]
pub async fn create_output_folders(base_path: String) -> Result<(), String> {
    let subfolders = vec![
        "Downloads/Audio",
        "Downloads/Video",
        "AudioLab",
        "Stems",
    ];
    
    let base = PathBuf::from(&base_path);
    
    for subfolder in subfolders {
        let path = base.join(subfolder);
        if !path.exists() {
            fs::create_dir_all(&path)
                .map_err(|e| format!("Failed to create {}: {}", subfolder, e))?;
        }
    }
    
    Ok(())
}

#[tauri::command(rename_all = "snake_case")]
pub async fn detect_tempo(audio_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || detect_tempo_sync(audio_path))
        .await
        .map_err(|err| err.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn detect_key(audio_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || detect_key_sync(audio_path))
        .await
        .map_err(|err| err.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn pitch_shift(
    input_path: String,
    output_path: Option<String>,
    semitones: f32,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        pitch_shift_sync(input_path, output_path, semitones)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn separate_stems(
    input_path: String,
    output_dir: Option<String>,
    stems: u8,
    format: Option<String>,
    model_name: Option<String>,
    use_gpu: Option<bool>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        separate_stems_sync(input_path, output_dir, stems, format, model_name, use_gpu)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn upload_file(
    file_name: String,
    file_data: Vec<u8>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        // Create temp directory in MediaFlow folder
        let mut temp_dir = mediaflow_download_dir()?;
        temp_dir.push("temp");
        fs::create_dir_all(&temp_dir)
            .map_err(|err| format!("Failed to create temp directory: {}", err))?;
        
        // Generate unique filename
        let timestamp = timestamp_suffix();
        let file_path = temp_dir.join(format!("{}_{}", timestamp, file_name));
        
        // Write file
        fs::write(&file_path, file_data)
            .map_err(|err| format!("Failed to write file: {}", err))?;
        
        to_path_string(&file_path)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn check_dependencies() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut results = serde_json::json!({
            "yt_dlp": {"available": false, "version": serde_json::Value::Null, "error": serde_json::Value::Null},
            "python": {"available": false, "version": serde_json::Value::Null, "error": serde_json::Value::Null},
            "ffmpeg": {"available": false, "version": serde_json::Value::Null, "error": serde_json::Value::Null},
            "demucs": {"available": false, "version": serde_json::Value::Null, "error": serde_json::Value::Null}
        });

        // Check yt-dlp
        match Command::new("yt-dlp").arg("--version").output() {
            Ok(output) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                results["yt_dlp"]["available"] = serde_json::json!(true);
                results["yt_dlp"]["version"] = serde_json::json!(version);
            }
            Ok(_) => {
                results["yt_dlp"]["error"] = serde_json::json!("yt-dlp found but failed to get version");
            }
            Err(e) => {
                results["yt_dlp"]["error"] = serde_json::json!(format!("yt-dlp not found: {}", e));
            }
        }

        // Check Python (try both "python" and "py" for Windows compatibility)
        let python_result = Command::new("python").arg("--version").output();
        let py_result = Command::new("py").arg("--version").output();
        
        match python_result {
            Ok(output) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                results["python"]["available"] = serde_json::json!(true);
                results["python"]["version"] = serde_json::json!(version);
            }
            _ => {
                // Fallback to "py" command on Windows
                match py_result {
                    Ok(output) if output.status.success() => {
                        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                        results["python"]["available"] = serde_json::json!(true);
                        results["python"]["version"] = serde_json::json!(version);
                    }
                    Ok(_) => {
                        results["python"]["error"] = serde_json::json!("Python found but failed to get version");
                    }
                    Err(e) => {
                        results["python"]["error"] = serde_json::json!(format!("Python not found: {}", e));
                    }
                }
            }
        }

        // Check FFmpeg
        match Command::new("ffmpeg").arg("-version").output() {
            Ok(output) if output.status.success() => {
                let version_line = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("unknown")
                    .to_string();
                results["ffmpeg"]["available"] = serde_json::json!(true);
                results["ffmpeg"]["version"] = serde_json::json!(version_line);
            }
            Ok(_) => {
                results["ffmpeg"]["error"] = serde_json::json!("FFmpeg found but failed to get version");
            }
            Err(e) => {
                results["ffmpeg"]["error"] = serde_json::json!(format!("FFmpeg not found: {}", e));
            }
        }

        // Check Demucs
        match Command::new("demucs").arg("--version").output() {
            Ok(output) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                results["demucs"]["available"] = serde_json::json!(true);
                results["demucs"]["version"] = serde_json::json!(version);
            }
            Ok(_) => {
                results["demucs"]["error"] = serde_json::json!("Demucs found but failed to get version");
            }
            Err(e) => {
                results["demucs"]["error"] = serde_json::json!(format!("Demucs not found: {}", e));
            }
        }

        serde_json::to_string(&results).map_err(|e| e.to_string())
    })
    .await
    .map_err(|err| err.to_string())?
}


#[tauri::command]
pub async fn download_ai_models() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let scripts_dir = find_scripts_dir()?;
        let script_path = scripts_dir.join("download_models.py");
        
        // Use Python 3.11
        let python_cmd = get_python311_command();
        let mut cmd = Command::new(&python_cmd[0]);
        
        if python_cmd.len() > 1 {
            cmd.arg(&python_cmd[1]);
        }
        
        let output = cmd
            .arg(script_path.to_str().ok_or("Invalid script path")?)
            .output()
            .map_err(|err| format!("Failed to run download script: {}", err))?;
        
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        
        if output.status.success() {
            Ok(stdout)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("Download failed: {}", stderr))
        }
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn check_models_installed() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        // Check if model file exists in default location
        let model_dir = std::path::PathBuf::from("/tmp/audio-separator-models");
        let model_file = model_dir.join("UVR-MDX-NET-Inst_HQ_3.onnx");
        
        let installed = model_file.exists();
        
        serde_json::to_string(&serde_json::json!({
            "installed": installed,
            "model_path": model_file.to_string_lossy()
        }))
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|err| err.to_string())?
}

/// Calculate directory size recursively
fn get_dir_size(path: &std::path::Path) -> u64 {
    let mut size = 0;
    if path.is_dir() {
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if entry_path.is_dir() {
                    size += get_dir_size(&entry_path);
                } else if let Ok(metadata) = entry.metadata() {
                    size += metadata.len();
                }
            }
        }
    }
    size
}

/// Format bytes to human readable string
fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    
    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.1} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.1} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

#[tauri::command]
pub async fn get_cache_size() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut total_size: u64 = 0;
        
        // Only count MediaFlow temp folder (uploaded files, processing temp)
        // NOT counting AI models - those are required files, not cache
        if let Ok(mediaflow_dir) = mediaflow_download_dir() {
            let temp_dir = mediaflow_dir.join("temp");
            if temp_dir.exists() {
                total_size += get_dir_size(&temp_dir);
            }
        }
        
        Ok(format_bytes(total_size))
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn clear_cache() -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let mut cleared = 0u64;
        
        // Clear MediaFlow temp folder only
        // NOT clearing AI models
        if let Ok(mediaflow_dir) = mediaflow_download_dir() {
            let temp_dir = mediaflow_dir.join("temp");
            if temp_dir.exists() {
                cleared += get_dir_size(&temp_dir);
                let _ = fs::remove_dir_all(&temp_dir);
                let _ = fs::create_dir_all(&temp_dir); // Recreate empty
            }
        }
        
        Ok(format!("Cleared {}", format_bytes(cleared)))
    })
    .await
    .map_err(|err| err.to_string())?
}
