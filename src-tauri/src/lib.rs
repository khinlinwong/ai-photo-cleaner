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

#[derive(Serialize, Deserialize, Clone)]
pub struct NativeImageEntry {
  id: String,
  basename: String,
  extension: String,
  size_bytes: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NativeImageEntriesScanResult {
  folder_name: String,
  total_entries: usize,
  total_size_bytes: u64,
  entries: Vec<NativeImageEntry>,
}

#[tauri::command]
fn scan_folder_image_entries(folder_path: String) -> Result<NativeImageEntriesScanResult, String> {
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

  let mut image_entries = Vec::new();
  let mut total_size_bytes = 0;
  let mut idx = 0;

  for entry in entries {
    if let Ok(entry) = entry {
      let file_type = match entry.file_type() {
        Ok(t) => t,
        Err(_) => continue,
      };

      if file_type.is_file() {
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
          let basename = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();

          if basename.is_empty() {
            continue;
          }

          let mut size_bytes = 0;
          if let Ok(metadata) = entry.metadata() {
            size_bytes = metadata.len();
          }
          total_size_bytes += size_bytes;

          // Generate an opaque ID for the frontend
          let id = format!("native-entry-{}-{}-{}", idx, size_bytes, ext);
          idx += 1;

          image_entries.push(NativeImageEntry {
            id,
            basename,
            extension: ext,
            size_bytes,
          });
        }
      }
    }
  }

  Ok(NativeImageEntriesScanResult {
    folder_name,
    total_entries: image_entries.len(),
    total_size_bytes,
    entries: image_entries,
  })
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NativeImagePreviewItem {
  id: String,
  preview_url: String,
  extension: String,
  size_bytes: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct NativeImagePreviewScanResult {
  total_preview_items: usize,
  preview_limit: usize,
  items: Vec<NativeImagePreviewItem>,
}

fn percent_encode(s: &str) -> String {
  let mut encoded = String::new();
  for byte in s.bytes() {
    match byte {
      b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
        encoded.push(byte as char);
      }
      _ => {
        encoded.push_str(&format!("%{:02X}", byte));
      }
    }
  }
  encoded
}

fn path_to_asset_url(path: &Path) -> String {
  let path_str = path.to_string_lossy();
  let encoded = percent_encode(&path_str);
  if cfg!(target_os = "windows") {
    format!("http://asset.localhost/{}", encoded)
  } else {
    format!("asset://localhost/{}", encoded)
  }
}

#[tauri::command]
fn scan_folder_image_previews(folder_path: String) -> Result<NativeImagePreviewScanResult, String> {
  let path = Path::new(&folder_path);
  if !path.exists() || !path.is_dir() {
    return Err("无法读取所选文件夹，请重新选择。".to_string());
  }

  let entries = fs::read_dir(path)
    .map_err(|_| "当前文件夹暂时无法扫描。".to_string())?;

  let mut preview_items = Vec::new();
  let mut idx = 0;
  const PREVIEW_LIMIT: usize = 12;

  for entry in entries {
    if preview_items.len() >= PREVIEW_LIMIT {
      break;
    }
    if let Ok(entry) = entry {
      let file_type = match entry.file_type() {
        Ok(t) => t,
        Err(_) => continue,
      };

      if file_type.is_file() {
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
          let mut size_bytes = 0;
          if let Ok(metadata) = entry.metadata() {
            size_bytes = metadata.len();
          }

          let id = format!("native-preview-{}-{}-{}", idx, size_bytes, ext);
          let preview_url = path_to_asset_url(&file_path);
          idx += 1;

          preview_items.push(NativeImagePreviewItem {
            id,
            preview_url,
            extension: ext,
            size_bytes,
          });
        }
      }
    }
  }

  Ok(NativeImagePreviewScanResult {
    total_preview_items: preview_items.len(),
    preview_limit: PREVIEW_LIMIT,
    items: preview_items,
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
      scan_folder_metadata,
      scan_folder_image_entries,
      scan_folder_image_previews
    ])
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
