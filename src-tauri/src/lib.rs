use std::fs;
use std::path::Path;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct FolderMetadataSummary {
  folder_name: String,
  total_files: usize,
  image_files_count: usize,
  unsupported_files_count: usize,
  total_size_bytes: u64,
}

#[tauri::command]
fn scan_folder_metadata(folder_path: String) -> Result<FolderMetadataSummary, String> {
  let path = Path::new(&folder_path);
  if !path.exists() || !path.is_dir() {
    return Err("无法读取所选文件夹，请重新选择。".to_string());
  }

  let folder_name = path
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("本地文件夹")
    .to_string();

  let entries = fs::read_dir(path)
    .map_err(|_| "当前文件夹暂时无法扫描。".to_string())?;

  let mut total_files = 0;
  let mut image_files_count = 0;
  let mut unsupported_files_count = 0;
  let mut total_size_bytes = 0;

  for entry in entries {
    if let Ok(entry) = entry {
      let file_type = match entry.file_type() {
        Ok(t) => t,
        Err(_) => continue,
      };

      if file_type.is_file() {
        total_files += 1;
        let file_path = entry.path();
        
        let ext = file_path
          .extension()
          .and_then(|e| e.to_str())
          .unwrap_or("")
          .to_lowercase();

        let is_image = match ext.as_str() {
          "jpg" | "jpeg" | "png" | "webp" | "heic" | "heif" => true,
          _ => false,
        };

        if is_image {
          image_files_count += 1;
          if let Ok(metadata) = entry.metadata() {
            total_size_bytes += metadata.len();
          }
        } else {
          unsupported_files_count += 1;
        }
      }
    }
  }

  Ok(FolderMetadataSummary {
    folder_name,
    total_files,
    image_files_count,
    unsupported_files_count,
    total_size_bytes,
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![scan_folder_metadata])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
