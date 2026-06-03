use std::fs;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
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

static PREVIEW_MAPPING: OnceLock<Mutex<HashMap<String, PathBuf>>> = OnceLock::new();
static ACTIVE_FOLDER: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();

fn get_preview_mapping() -> &'static Mutex<HashMap<String, PathBuf>> {
  PREVIEW_MAPPING.get_or_init(|| Mutex::new(HashMap::new()))
}

fn set_active_folder(folder: PathBuf) {
  let cell = ACTIVE_FOLDER.get_or_init(|| Mutex::new(None));
  if let Ok(mut guard) = cell.lock() {
    *guard = Some(folder);
  }
}

fn verify_in_active_folder(path: &Path) -> bool {
  if let Ok(canonical_path) = path.canonicalize() {
    let cell = ACTIVE_FOLDER.get_or_init(|| Mutex::new(None));
    if let Ok(guard) = cell.lock() {
      if let Some(ref active) = *guard {
        if let Some(parent) = canonical_path.parent() {
          return parent == active;
        }
      }
    }
  }
  false
}

#[tauri::command]
fn scan_folder_image_previews(folder_path: String) -> Result<NativeImagePreviewScanResult, String> {
  let path = Path::new(&folder_path);
  let canonical_active = path.canonicalize()
    .map_err(|_| "无法读取所选文件夹，请重新选择。".to_string())?;

  if !canonical_active.exists() || !canonical_active.is_dir() {
    return Err("无法读取所选文件夹，请重新选择。".to_string());
  }

  // Record the chosen folder path scope (canonicalized)
  set_active_folder(canonical_active.clone());

  let entries = fs::read_dir(&canonical_active)
    .map_err(|_| "当前文件夹暂时无法扫描。".to_string())?;

  let mut preview_items = Vec::new();
  let mut idx = 0;
  const PREVIEW_LIMIT: usize = 30;

  // Clear previous mappings
  if let Ok(mut guard) = get_preview_mapping().lock() {
    guard.clear();
  }

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
        
        // Canonicalize file path to resolve symlinks/junctions
        if let Ok(canonical_file_path) = file_path.canonicalize() {
          // Check that the parent of the canonical file is exactly the canonical active folder
          if canonical_file_path.parent() == Some(&canonical_active) {
            let ext = canonical_file_path
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

              let id = format!("native-preview-{}", idx);
              idx += 1;

              // Store canonicalized mapping in memory
              if let Ok(mut guard) = get_preview_mapping().lock() {
                guard.insert(id.clone(), canonical_file_path.clone());
              }

              // Format opaque preview URL using custom protocol scheme
              let preview_url = if cfg!(target_os = "windows") {
                format!("http://preview.localhost/{}", id)
              } else {
                format!("preview://localhost/{}", id)
              };

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
    }
  }

  Ok(NativeImagePreviewScanResult {
    total_preview_items: preview_items.len(),
    preview_limit: PREVIEW_LIMIT,
    items: preview_items,
  })
}

#[tauri::command]
fn read_native_preview_bytes(id: String) -> Result<Vec<u8>, String> {
  let file_path = {
    let mapping = get_preview_mapping();
    if let Ok(guard) = mapping.lock() {
      guard.get(&id).cloned()
    } else {
      None
    }
  };

  let file_path = match file_path {
    Some(path) => path,
    None => return Err("无效或过期的预览标识，请重新选择文件夹。".to_string()),
  };

  if !verify_in_active_folder(&file_path) {
    return Err("安全拒绝：请求的文件超出当前文件夹授权范围。".to_string());
  }

  let metadata = fs::metadata(&file_path)
    .map_err(|_| "无法读取文件元数据。".to_string())?;

  const MAX_FILE_SIZE_BYTES: u64 = 15 * 1024 * 1024; // 15 MB
  if metadata.len() > MAX_FILE_SIZE_BYTES {
    return Err("安全拒绝：文件大小超过 15MB 限制。".to_string());
  }

  let bytes = fs::read(&file_path)
    .map_err(|_| "读取本地文件内容失败。".to_string())?;

  Ok(bytes)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .register_uri_scheme_protocol("preview", |_ctx, request| {
      let path = request.uri().path();
      let opaque_id = if path.starts_with('/') {
        &path[1..]
      } else {
        path
      };

      let file_path = {
        let mapping = get_preview_mapping();
        if let Ok(guard) = mapping.lock() {
          guard.get(opaque_id).cloned()
        } else {
          None
        }
      };

      if let Some(file_path) = file_path {
        if verify_in_active_folder(&file_path) {
          if let Ok(bytes) = std::fs::read(&file_path) {
            let ext = file_path
              .extension()
              .and_then(|e| e.to_str())
              .unwrap_or("")
              .to_lowercase();
            let mime = match ext.as_str() {
              "jpg" | "jpeg" => "image/jpeg",
              "png" => "image/png",
              "webp" => "image/webp",
              _ => "application/octet-stream",
            };

            return tauri::http::Response::builder()
              .header("Content-Type", mime)
              .header("Access-Control-Allow-Origin", "*")
              .body(bytes)
              .unwrap();
          }
        }
      }

      tauri::http::Response::builder()
        .status(tauri::http::StatusCode::NOT_FOUND)
        .body(Vec::new())
        .unwrap()
    })
    .invoke_handler(tauri::generate_handler![
      scan_folder_metadata,
      scan_folder_image_entries,
      scan_folder_image_previews,
      read_native_preview_bytes
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
