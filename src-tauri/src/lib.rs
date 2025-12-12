mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load .env.local from project root
    let _ = dotenvy::from_filename("../.env.local");
    let _ = dotenvy::from_filename(".env.local");
    let _ = dotenvy::dotenv();
    
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::get_video_info,
            commands::get_playlist_info,
            commands::download_audio,
            commands::download_video,
            commands::get_default_download_dir,
            commands::select_folder,
            commands::create_output_folders,
            commands::detect_tempo,
            commands::detect_key,
            commands::pitch_shift,
            commands::separate_stems,
            commands::upload_file,
            commands::check_dependencies,
            commands::download_ai_models,
            commands::check_models_installed,
            commands::get_cache_size,
            commands::clear_cache
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Error)
                        .build(),
                )?;
            }
            app.handle().plugin(tauri_plugin_dialog::init())?;
            app.handle().plugin(tauri_plugin_store::Builder::default().build())?;
            app.handle().plugin(tauri_plugin_fs::init())?;
            app.handle().plugin(tauri_plugin_shell::init())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
