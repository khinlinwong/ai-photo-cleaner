use std::fs;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use serde::{Serialize, Deserialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri_plugin_dialog::DialogExt;

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
static ACTIVE_FILES: OnceLock<Mutex<std::collections::HashSet<PathBuf>>> = OnceLock::new();

fn get_preview_mapping() -> &'static Mutex<HashMap<String, PathBuf>> {
  PREVIEW_MAPPING.get_or_init(|| Mutex::new(HashMap::new()))
}

fn get_active_files() -> &'static Mutex<std::collections::HashSet<PathBuf>> {
  ACTIVE_FILES.get_or_init(|| Mutex::new(std::collections::HashSet::new()))
}

fn set_active_folder(folder: PathBuf) {
  let cell = ACTIVE_FOLDER.get_or_init(|| Mutex::new(None));
  if let Ok(mut guard) = cell.lock() {
    *guard = Some(folder);
  }
}

fn verify_in_active_folder(path: &Path) -> bool {
  if let Ok(canonical_path) = path.canonicalize() {
    // Check if explicitly allowed via selected files
    if let Ok(guard) = get_active_files().lock() {
      if guard.contains(&canonical_path) {
        return true;
      }
    }
    // Check folder scope
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
fn scan_folder_image_previews(
  folder_path: String,
  limit: Option<usize>,
) -> Result<NativeImagePreviewScanResult, String> {
  let path = Path::new(&folder_path);
  let canonical_active = path.canonicalize()
    .map_err(|_| "无法读取所选文件夹，请重新选择。".to_string())?;

  if !canonical_active.exists() || !canonical_active.is_dir() {
    return Err("无法读取所选文件夹，请重新选择。".to_string());
  }

  // Record the chosen folder path scope (canonicalized)
  set_active_folder(canonical_active.clone());
  expire_all_plans();

  if let Ok(mut guard) = get_active_files().lock() {
    guard.clear();
  }

  let entries = fs::read_dir(&canonical_active)
    .map_err(|_| "当前文件夹暂时无法扫描。".to_string())?;

  let mut preview_items = Vec::new();
  let mut idx = 0;
  let session_token = generate_opaque_token("session");
  
  let target_limit = match limit {
    Some(l) if l > 0 => std::cmp::min(l, 200),
    _ => 100,
  };

  // Clear previous mappings
  if let Ok(mut guard) = get_preview_mapping().lock() {
    guard.clear();
  }

  for entry in entries {
    if preview_items.len() >= target_limit {
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

              let id = format!("native-preview-{}-{}-{}-{}", session_token, idx, size_bytes, ext);
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
    preview_limit: target_limit,
    items: preview_items,
  })
}

#[tauri::command]
fn scan_selected_image_files(
  file_paths: Vec<String>,
  limit: Option<usize>,
) -> Result<NativeImagePreviewScanResult, String> {
  let target_limit = match limit {
    Some(l) if l > 0 => std::cmp::min(l, 200),
    _ => 200,
  };

  // Clear previous active folder/files
  if let Ok(mut guard) = ACTIVE_FOLDER.get_or_init(|| Mutex::new(None)).lock() {
    *guard = None;
  }
  
  let mut active_files_guard = get_active_files().lock().map_err(|_| "系统锁定错误".to_string())?;
  active_files_guard.clear();

  // Clear previous preview mapping
  if let Ok(mut guard) = get_preview_mapping().lock() {
    guard.clear();
  }

  expire_all_plans();

  let mut preview_items = Vec::new();
  let mut idx = 0;
  let session_token = generate_opaque_token("session");

  for file_path_str in file_paths {
    if preview_items.len() >= target_limit {
      break;
    }

    let path = Path::new(&file_path_str);
    
    // Canonicalize path to check exists and resolve symlinks
    if let Ok(canonical_path) = path.canonicalize() {
      if canonical_path.is_file() {
        let ext = canonical_path
          .extension()
          .and_then(|e| e.to_str())
          .unwrap_or("")
          .to_lowercase();

        let is_image = match ext.as_str() {
          "jpg" | "jpeg" | "png" | "webp" | "heic" | "heif" => true,
          _ => false,
        };

        if is_image {
          let size_bytes = match fs::metadata(&canonical_path) {
            Ok(meta) => meta.len(),
            Err(_) => 0,
          };

          let id = format!("native-preview-{}-{}-{}-{}", session_token, idx, size_bytes, ext);
          idx += 1;

          // Store in active files and mapping
          active_files_guard.insert(canonical_path.clone());
          
          if let Ok(mut guard) = get_preview_mapping().lock() {
            guard.insert(id.clone(), canonical_path.clone());
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

  Ok(NativeImagePreviewScanResult {
    total_preview_items: preview_items.len(),
    preview_limit: target_limit,
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

#[derive(Clone)]
struct PlanState {
  result: PhysicalOrgDryRunResult,
  output_folder_token: String,
  status: String, // "planned", "executing", "completed", "failed", "expired"
}

static DRY_RUN_PLANS: OnceLock<Mutex<HashMap<String, PlanState>>> = OnceLock::new();

fn get_dry_run_plans() -> &'static Mutex<HashMap<String, PlanState>> {
  DRY_RUN_PLANS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn expire_all_plans() {
  if let Ok(mut guard) = get_dry_run_plans().lock() {
    for state in guard.values_mut() {
      state.status = "expired".to_string();
    }
  }
}

static OUTPUT_FOLDER_MAPPING: OnceLock<Mutex<HashMap<String, PathBuf>>> = OnceLock::new();

fn get_output_folder_mapping() -> &'static Mutex<HashMap<String, PathBuf>> {
  OUTPUT_FOLDER_MAPPING.get_or_init(|| Mutex::new(HashMap::new()))
}

fn generate_opaque_token(prefix: &str) -> String {
  let start = SystemTime::now();
  let since_the_epoch = start
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default();
  
  static COUNTER: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
  let count = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
  
  format!("{}-{}-{}", prefix, since_the_epoch.as_nanos(), count)
}

#[derive(Deserialize)]
pub struct DryRunRequestItem {
  #[serde(rename = "photoId")]
  photo_id: String,
  #[serde(rename = "displayName")]
  display_name: String,
  #[serde(rename = "targetBucket")]
  target_bucket: String,
}

#[derive(Deserialize)]
pub struct PhysicalOrgDryRunRequest {
  #[serde(rename = "outputFolderToken")]
  output_folder_token: String,
  items: Vec<DryRunRequestItem>,
}

#[derive(Serialize, Clone)]
pub struct PhysicalOrgPlanItem {
  #[serde(rename = "photoId")]
  photo_id: String,
  #[serde(rename = "displayName")]
  display_name: String,
  #[serde(rename = "targetBucket")]
  target_bucket: String,
  #[serde(rename = "targetRelativePath")]
  target_relative_path: String,
  status: String,
  reason: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct PhysicalOrgDryRunResult {
  #[serde(rename = "planId")]
  plan_id: String,
  #[serde(rename = "outputDisplayLabel")]
  output_display_label: String,
  #[serde(rename = "totalItems")]
  total_items: usize,
  #[serde(rename = "keepCount")]
  keep_count: usize,
  #[serde(rename = "cullCandidateCount")]
  cull_candidate_count: usize,
  #[serde(rename = "skippedCount")]
  skipped_count: usize,
  #[serde(rename = "conflictCount")]
  conflict_count: usize,
  #[serde(rename = "estimatedBytes")]
  estimated_bytes: u64,
  #[serde(rename = "canProceed")]
  can_proceed: bool,
  warnings: Vec<String>,
  items: Vec<PhysicalOrgPlanItem>,
}

#[derive(Serialize, Clone)]
pub struct PhysicalOrgExecutionReportItem {
  #[serde(rename = "displayName")]
  display_name: String,
  #[serde(rename = "targetBucket")]
  target_bucket: String,
  #[serde(rename = "outputRelativePath")]
  output_relative_path: String,
  status: String, // "copied", "skipped", "failed"
  reason: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct PhysicalOrgExecutionResult {
  #[serde(rename = "planId")]
  plan_id: String,
  #[serde(rename = "executionId")]
  execution_id: String,
  #[serde(rename = "outputDisplayLabel")]
  output_display_label: String,
  #[serde(rename = "totalItems")]
  total_items: usize,
  #[serde(rename = "copiedCount")]
  copied_count: usize,
  #[serde(rename = "skippedCount")]
  skipped_count: usize,
  #[serde(rename = "failedCount")]
  failed_count: usize,
  #[serde(rename = "reportItems")]
  report_items: Vec<PhysicalOrgExecutionReportItem>,
  warnings: Vec<String>,
}

#[tauri::command]
async fn select_physical_org_output_folder(
  app: tauri::AppHandle,
) -> Result<(String, String), String> {
  let (tx, rx) = std::sync::mpsc::channel();
  
  app.dialog().file().pick_folder(move |file_path| {
    let _ = tx.send(file_path);
  });
  
  let file_path_opt = rx.recv().map_err(|_| "选择目录对话框被取消。".to_string())?;
  let file_path = match file_path_opt {
    Some(fp) => fp,
    None => return Err("用户取消了选择。".to_string()),
  };
  
  let raw_path = match file_path {
    tauri_plugin_dialog::FilePath::Path(p) => p,
    tauri_plugin_dialog::FilePath::Url(u) => {
      u.to_file_path().map_err(|_| "无法将 URL 转换为本地路径。".to_string())?
    }
  };

  let canonical_path = raw_path.canonicalize()
    .map_err(|_| "无法解析所选目录的绝对路径，可能不存在或无权限。".to_string())?;

  // Check if there is an active source folder, and check overlap
  let active_folder = {
    let guard = ACTIVE_FOLDER.get_or_init(|| Mutex::new(None)).lock().map_err(|_| "系统锁定错误")?;
    guard.clone()
  };

  if let Some(src_path) = active_folder {
    let src_canon = src_path.canonicalize()
      .map_err(|_| "安全拒绝：源文件夹路径解析失败。".to_string())?;
    if canonical_path == src_canon 
       || canonical_path.starts_with(&src_canon) 
       || src_canon.starts_with(&canonical_path) 
    {
      return Err("安全拒绝：输出文件夹不能是源文件夹、源文件夹的子文件夹，或源文件夹的父文件夹。".to_string());
    }
  }

  // Generate desensitized token
  let token = generate_opaque_token("org-token");
  
  // Save in the static map
  if let Ok(mut guard) = get_output_folder_mapping().lock() {
    guard.insert(token.clone(), canonical_path);
  } else {
    return Err("系统锁定错误".to_string());
  }

  // Return (token, "已选择输出位置")
  Ok((token, "已选择输出位置".to_string()))
}

#[tauri::command]
fn create_physical_org_dry_run(
  request: PhysicalOrgDryRunRequest,
) -> Result<PhysicalOrgDryRunResult, String> {
  // 1. Check if outputFolderToken exists in map
  let output_path = {
    let mapping = get_output_folder_mapping();
    let guard = mapping.lock().map_err(|_| "系统锁定错误")?;
    guard.get(&request.output_folder_token).cloned()
  };

  let output_path = match output_path {
    Some(path) => path,
    None => return Err("无效或已过期的输出文件夹标识，请重新选择输出位置。".to_string()),
  };

  // Double check active folder and overlap safety in dry-run as well (defense in depth)
  let active_folder = {
    let guard = ACTIVE_FOLDER.get_or_init(|| Mutex::new(None)).lock().map_err(|_| "系统锁定错误")?;
    guard.clone()
  };

  if let Some(src_path) = active_folder {
    let src_canon = src_path.canonicalize()
      .map_err(|_| "安全拒绝：源文件夹路径解析失败。".to_string())?;
    if output_path == src_canon 
       || output_path.starts_with(&src_canon) 
       || src_canon.starts_with(&output_path) 
    {
      return Err("安全拒绝：输出文件夹不能与源文件夹相同，且不能是层级重叠的子/父文件夹。".to_string());
    }
  }

  let plan_id = generate_opaque_token("plan");

  let mut total_items = 0;
  let mut keep_count = 0;
  let mut cull_candidate_count = 0;
  let mut skipped_count = 0;
  let mut conflict_count = 0;
  let mut estimated_bytes = 0;
  let mut warnings = Vec::new();
  let mut plan_items = Vec::new();

  for item in request.items {
    total_items += 1;
    
    // Find the file in PREVIEW_MAPPING by photo_id
    let file_path = {
      let mapping = get_preview_mapping();
      if let Ok(guard) = mapping.lock() {
        guard.get(&item.photo_id).cloned()
      } else {
        None
      }
    };

    let file_path = match file_path {
      Some(path) => path,
      None => {
        skipped_count += 1;
        plan_items.push(PhysicalOrgPlanItem {
          photo_id: item.photo_id,
          display_name: item.display_name,
          target_bucket: item.target_bucket,
          target_relative_path: "".to_string(),
          status: "skipped".to_string(),
          reason: Some("未找到源图片文件缓存".to_string()),
        });
        continue;
      }
    };

    // Verify file is in active folder
    if !verify_in_active_folder(&file_path) {
      skipped_count += 1;
      plan_items.push(PhysicalOrgPlanItem {
        photo_id: item.photo_id,
        display_name: item.display_name,
        target_bucket: item.target_bucket,
        target_relative_path: "".to_string(),
        status: "skipped".to_string(),
        reason: Some("安全拒绝：超出源文件夹授权范围".to_string()),
      });
      continue;
    }

    // Check if the source file exists
    if !file_path.exists() {
      skipped_count += 1;
      plan_items.push(PhysicalOrgPlanItem {
        photo_id: item.photo_id,
        display_name: item.display_name,
        target_bucket: item.target_bucket,
        target_relative_path: "".to_string(),
        status: "skipped".to_string(),
        reason: Some("源文件不存在，可能在外部已被删除".to_string()),
      });
      continue;
    }

    // Get size and extension
    let size_bytes = match fs::metadata(&file_path) {
      Ok(meta) => meta.len(),
      Err(_) => {
        skipped_count += 1;
        plan_items.push(PhysicalOrgPlanItem {
          photo_id: item.photo_id,
          display_name: item.display_name,
          target_bucket: item.target_bucket,
          target_relative_path: "".to_string(),
          status: "skipped".to_string(),
          reason: Some("无法读取文件元数据".to_string()),
        });
        continue;
      }
    };

    let ext = file_path
      .extension()
      .and_then(|e| e.to_str())
      .unwrap_or("")
      .to_lowercase();

    let sub_folder = match item.target_bucket.as_str() {
      "keep" => "Keep",
      "cull-candidate" => "Cull-Candidates",
      _ => {
        skipped_count += 1;
        plan_items.push(PhysicalOrgPlanItem {
          photo_id: item.photo_id,
          display_name: item.display_name,
          target_bucket: item.target_bucket,
          target_relative_path: "".to_string(),
          status: "skipped".to_string(),
          reason: Some("无效的分组目标类型".to_string()),
        });
        continue;
      }
    };

    let target_relative_path = if ext.is_empty() {
      format!("{}/{}", sub_folder, item.display_name)
    } else {
      format!("{}/{}.{}", sub_folder, item.display_name, ext)
    };

    // Check potential conflict in output path
    let dest_path = output_path.join(&target_relative_path);
    let is_conflict = dest_path.exists();
    if is_conflict {
      conflict_count += 1;
    }

    // Increment counts for planned items
    estimated_bytes += size_bytes;
    if item.target_bucket == "keep" {
      keep_count += 1;
    } else {
      cull_candidate_count += 1;
    }

    plan_items.push(PhysicalOrgPlanItem {
      photo_id: item.photo_id,
      display_name: item.display_name,
      target_bucket: item.target_bucket,
      target_relative_path,
      status: "planned".to_string(),
      reason: None,
    });
  }

  // Determine if we can proceed
  let can_proceed = total_items > 0 && skipped_count < total_items;

  if conflict_count > 0 {
    warnings.push(format!("在目标位置发现 {} 个同名冲突文件，如果后续运行将使用冲突命名规则解决。", conflict_count));
  }

  let dry_run_result = PhysicalOrgDryRunResult {
    plan_id: plan_id.clone(),
    output_display_label: "已选择输出位置".to_string(),
    total_items,
    keep_count,
    cull_candidate_count,
    skipped_count,
    conflict_count,
    estimated_bytes,
    can_proceed,
    warnings,
    items: plan_items,
  };

  if let Ok(mut guard) = get_dry_run_plans().lock() {
    guard.insert(plan_id, PlanState {
      result: dry_run_result.clone(),
      output_folder_token: request.output_folder_token,
      status: "planned".to_string(),
    });
  }

  Ok(dry_run_result)
}

#[tauri::command]
fn execute_physical_org_copy(plan_id: String) -> Result<PhysicalOrgExecutionResult, String> {
  // 1. Find the plan in DRY_RUN_PLANS by plan_id and atomically check & set status
  let plan = {
    let plans_map = get_dry_run_plans();
    let mut guard = plans_map.lock().map_err(|_| "系统锁定错误与冲突保护拦截。".to_string())?;
    let plan_state = guard.get_mut(&plan_id).ok_or_else(|| "该整理计划已执行或已失效，请重新生成整理计划。".to_string())?;
    
    if plan_state.status != "planned" {
      return Err("该整理计划已执行或已失效，请重新生成整理计划。".to_string());
    }

    if !plan_state.result.can_proceed {
      return Err("安全拒绝：该整理计划已被标记为不可继续执行。".to_string());
    }
    
    plan_state.status = "executing".to_string();
    plan_state.clone()
  };

  // 2. Retrieve output folder token and path
  let output_path = {
    let mapping = get_output_folder_mapping();
    let guard = mapping.lock().map_err(|_| {
      let _ = set_plan_status(&plan_id, "failed");
      "系统锁定错误".to_string()
    })?;
    guard.get(&plan.output_folder_token).cloned()
  };

  let output_path = match output_path {
    Some(path) => path,
    None => {
      let _ = set_plan_status(&plan_id, "failed");
      return Err("输出位置已失效，请重新选择输出位置。".to_string());
    }
  };

  // 3. Double-check active folder and overlap safety with canonicalize error checking
  let active_folder = {
    let guard = ACTIVE_FOLDER.get_or_init(|| Mutex::new(None)).lock().map_err(|_| {
      let _ = set_plan_status(&plan_id, "failed");
      "系统锁定错误".to_string()
    })?;
    guard.clone()
  };

  let active_folder_path = match active_folder {
    Some(path) => path,
    None => {
      let _ = set_plan_status(&plan_id, "failed");
      return Err("源文件夹会话已改变，当前计划已失效。".to_string());
    }
  };

  let src_canon = active_folder_path.canonicalize().map_err(|_| {
    let _ = set_plan_status(&plan_id, "failed");
    "安全拒绝：无法解析源相册的绝对路径。".to_string()
  })?;
  let dest_canon = output_path.canonicalize().map_err(|_| {
    let _ = set_plan_status(&plan_id, "failed");
    "安全拒绝：无法解析输出位置的绝对路径。".to_string()
  })?;

  if dest_canon == src_canon 
     || dest_canon.starts_with(&src_canon) 
     || src_canon.starts_with(&dest_canon) 
  {
    let _ = set_plan_status(&plan_id, "failed");
    return Err("安全拒绝：输出文件夹不能与源文件夹相同，且不能是层级重叠的子/父文件夹。".to_string());
  }

  // 4. Create base export and unique session directories
  let base_export_dir = dest_canon.join("AI Photo Cleaner Export");
  if !base_export_dir.exists() {
    fs::create_dir_all(&base_export_dir).map_err(|_| {
      let _ = set_plan_status(&plan_id, "failed");
      "无法创建 AI Photo Cleaner Export 基础目录。".to_string()
    })?;
  }

  let session_token = generate_opaque_token("session");
  let session_dir = base_export_dir.join(format!("export-session-{}", session_token));
  fs::create_dir(&session_dir).map_err(|_| {
    let _ = set_plan_status(&plan_id, "failed");
    "无法创建本次整理的会话输出目录。".to_string()
  })?;

  let keep_dir = session_dir.join("Keep");
  let cull_dir = session_dir.join("Cull-Candidates");
  fs::create_dir(&keep_dir).map_err(|_| {
    let _ = set_plan_status(&plan_id, "failed");
    "无法创建 Keep 输出目录。".to_string()
  })?;
  fs::create_dir(&cull_dir).map_err(|_| {
    let _ = set_plan_status(&plan_id, "failed");
    "无法创建 Cull-Candidates 输出目录。".to_string()
  })?;

  // 5. Execute copy
  let mut copied_count = 0;
  let mut skipped_count = 0;
  let mut failed_count = 0;
  let mut report_items = Vec::new();
  let warnings = Vec::new();

  for item in plan.result.items {
    if item.status == "skipped" {
      skipped_count += 1;
      report_items.push(PhysicalOrgExecutionReportItem {
        display_name: item.display_name,
        target_bucket: item.target_bucket,
        output_relative_path: "".to_string(),
        status: "skipped".to_string(),
        reason: item.reason,
      });
      continue;
    }

    // Find real source path
    let file_path = {
      let mapping = get_preview_mapping();
      if let Ok(guard) = mapping.lock() {
        guard.get(&item.photo_id).cloned()
      } else {
        None
      }
    };

    let file_path = match file_path {
      Some(path) => path,
      None => {
        failed_count += 1;
        report_items.push(PhysicalOrgExecutionReportItem {
          display_name: item.display_name,
          target_bucket: item.target_bucket,
          output_relative_path: "".to_string(),
          status: "failed".to_string(),
          reason: Some("未找到源图片文件缓存".to_string()),
        });
        continue;
      }
    };

    // Verify source path canonicalization and safety
    let file_path_canon = match file_path.canonicalize() {
      Ok(p) => p,
      Err(_) => {
        failed_count += 1;
        report_items.push(PhysicalOrgExecutionReportItem {
          display_name: item.display_name,
          target_bucket: item.target_bucket,
          output_relative_path: "".to_string(),
          status: "failed".to_string(),
          reason: Some("源文件路径解析失败。".to_string()),
        });
        continue;
      }
    };

    if !verify_in_active_folder(&file_path_canon) {
      failed_count += 1;
      report_items.push(PhysicalOrgExecutionReportItem {
        display_name: item.display_name,
        target_bucket: item.target_bucket,
        output_relative_path: "".to_string(),
        status: "failed".to_string(),
        reason: Some("安全拒绝：超出源文件夹授权范围".to_string()),
      });
      continue;
    }

    if !file_path_canon.exists() {
      failed_count += 1;
      report_items.push(PhysicalOrgExecutionReportItem {
        display_name: item.display_name,
        target_bucket: item.target_bucket,
        output_relative_path: "".to_string(),
        status: "failed".to_string(),
        reason: Some("源文件已被移动或删除".to_string()),
      });
      continue;
    }

    let ext = file_path_canon
      .extension()
      .and_then(|e| e.to_str())
      .unwrap_or("")
      .to_lowercase();

    let sub_folder = match item.target_bucket.as_str() {
      "keep" => "Keep",
      "cull-candidate" => "Cull-Candidates",
      _ => {
        failed_count += 1;
        report_items.push(PhysicalOrgExecutionReportItem {
          display_name: item.display_name,
          target_bucket: item.target_bucket,
          output_relative_path: "".to_string(),
          status: "failed".to_string(),
          reason: Some("无效的分组目标类型".to_string()),
        });
        continue;
      }
    };

    // Construct target filename, avoiding collisions with atomic create_new(true)
    let mut final_filename = if ext.is_empty() {
      item.display_name.clone()
    } else {
      format!("{}.{}", item.display_name, ext)
    };

    let target_sub_dir = session_dir.join(&sub_folder);
    let mut dest_path = target_sub_dir.join(&final_filename);
    let mut collision_counter = 1;
    let mut dest_file = None;

    while dest_file.is_none() {
      match fs::OpenOptions::new().write(true).create_new(true).open(&dest_path) {
        Ok(file) => {
          dest_file = Some(file);
        }
        Err(ref e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
          final_filename = if ext.is_empty() {
            format!("{}-{}", item.display_name, collision_counter)
          } else {
            format!("{}-{}.{}", item.display_name, collision_counter, ext)
          };
          dest_path = target_sub_dir.join(&final_filename);
          collision_counter += 1;
        }
        Err(_) => {
          break;
        }
      }
    }

    let output_relative_path = format!("{}/{}", sub_folder, final_filename);

    if let Some(mut dest) = dest_file {
      match fs::File::open(&file_path_canon) {
        Ok(mut src) => {
          match std::io::copy(&mut src, &mut dest) {
            Ok(_) => {
              copied_count += 1;
              report_items.push(PhysicalOrgExecutionReportItem {
                display_name: item.display_name,
                target_bucket: item.target_bucket,
                output_relative_path,
                status: "copied".to_string(),
                reason: None,
              });
            }
            Err(_) => {
              failed_count += 1;
              report_items.push(PhysicalOrgExecutionReportItem {
                display_name: item.display_name,
                target_bucket: item.target_bucket,
                output_relative_path: "".to_string(),
                status: "failed".to_string(),
                reason: Some("写入目标文件内容失败，磁盘可能已满。".to_string()),
              });
            }
          }
        }
        Err(_) => {
          failed_count += 1;
          report_items.push(PhysicalOrgExecutionReportItem {
            display_name: item.display_name,
            target_bucket: item.target_bucket,
            output_relative_path: "".to_string(),
            status: "failed".to_string(),
            reason: Some("无法打开源文件进行读取。".to_string()),
          });
        }
      }
    } else {
      failed_count += 1;
      report_items.push(PhysicalOrgExecutionReportItem {
        display_name: item.display_name,
        target_bucket: item.target_bucket,
        output_relative_path: "".to_string(),
        status: "failed".to_string(),
        reason: Some("无法创建目标文件。".to_string()),
      });
    }
  }

  // 6. Build execution result
  let execution_result = PhysicalOrgExecutionResult {
    plan_id: plan_id.clone(),
    execution_id: format!("exec-{}", session_token),
    output_display_label: "已选择输出位置".to_string(),
    total_items: plan.result.total_items,
    copied_count,
    skipped_count,
    failed_count,
    report_items,
    warnings: warnings.clone(),
  };

  // 7. Write report.json
  if let Ok(report_content) = serde_json::to_string_pretty(&execution_result) {
    let _ = fs::write(session_dir.join("report.json"), report_content);
  }

  // 8. Update plan status
  let final_status = if copied_count > 0 {
    "completed"
  } else {
    "failed"
  };
  let _ = set_plan_status(&plan_id, final_status);

  Ok(execution_result)
}

fn set_plan_status(plan_id: &str, status: &str) -> Result<(), String> {
  let plans_map = get_dry_run_plans();
  let mut guard = plans_map.lock().map_err(|_| "系统锁定错误")?;
  if let Some(p) = guard.get_mut(plan_id) {
    p.status = status.to_string();
  }
  Ok(())
}

#[tauri::command]
fn clear_physical_org_session() -> Result<(), String> {
  if let Ok(mut guard) = get_output_folder_mapping().lock() {
    guard.clear();
  }
  if let Ok(mut guard) = get_dry_run_plans().lock() {
    guard.clear();
  }
  Ok(())
}

#[derive(Serialize, Clone)]
pub struct KeepCopySummary {
  #[serde(rename = "copiedCount")]
  copied_count: usize,
  #[serde(rename = "skippedCount")]
  skipped_count: usize,
  #[serde(rename = "failedCount")]
  failed_count: usize,
  #[serde(rename = "targetFolderName")]
  target_folder_name: String,
  errors: Vec<String>,
}

#[tauri::command]
fn save_text_file(target_path: String, contents: String) -> Result<bool, String> {
  let path = std::path::Path::new(&target_path);
  std::fs::write(path, contents).map_err(|_| {
    "写入文件失败，请确认目标位置可写。".to_string()
  })?;
  Ok(true)
}

#[tauri::command]
async fn copy_keep_photos_to_folder(
  output_folder_token: String,
  keep_photo_ids: Vec<String>,
) -> Result<KeepCopySummary, String> {
  // A. 解析 output_folder_token 得到 output_dir
  let output_path = {
    let mapping = get_output_folder_mapping();
    let guard = mapping.lock().map_err(|_| "系统锁定错误".to_string())?;
    guard.get(&output_folder_token).cloned()
  };

  let output_path = match output_path {
    Some(path) => path,
    None => return Err("输出位置已失效，请重新选择输出位置。".to_string()),
  };

  // B. canonicalize output_dir
  let dest_canon = match output_path.canonicalize() {
    Ok(p) => p,
    Err(_) => return Err("安全拒绝：无法解析输出位置的绝对路径，可能不存在或无权限。".to_string()),
  };

  if !dest_canon.exists() || !dest_canon.is_dir() {
    return Err("目标文件夹不可用，可能已被移动或删除。".to_string());
  }

  // C. 校验 keep_photo_ids 非空
  if keep_photo_ids.is_empty() {
    return Err("没有保留照片可导出。".to_string());
  }

  // 校验源路径与目标目录重叠逻辑 (不局限于单一 ACTIVE_FOLDER)
  let active_folder = {
    let guard = ACTIVE_FOLDER.get_or_init(|| Mutex::new(None)).lock().map_err(|_| "系统锁定错误".to_string())?;
    guard.clone()
  };

  if let Some(src_path) = active_folder {
    if let Ok(src_canon) = src_path.canonicalize() {
      if dest_canon == src_canon 
         || dest_canon.starts_with(&src_canon) 
         || src_canon.starts_with(&dest_canon) 
      {
        return Err("安全拒绝：导出目标不能是原照片所在文件夹或其子文件夹，请选择一个新的空文件夹。".to_string());
      }
    }
  }

  // 目标文件夹名称脱敏，只返回文件夹基本名
  let target_folder_name = dest_canon
    .file_name()
    .and_then(|n| n.to_str())
    .unwrap_or("目标文件夹")
    .to_string();

  // 第一轮：Pre-flight 安全与重叠性校验，并收集准备复制的条目
  let mut ready_items = Vec::new();

  for photo_id in &keep_photo_ids {
    let file_path = {
      let mapping = get_preview_mapping();
      if let Ok(guard) = mapping.lock() {
        guard.get(photo_id).cloned()
      } else {
        None
      }
    };

    let file_path = match file_path {
      Some(path) => path,
      None => return Err("未找到部分源图片文件缓存，请刷新后重试。".to_string()),
    };

    // 校验安全性与授权范围
    let file_path_canon = match file_path.canonicalize() {
      Ok(p) => p,
      Err(_) => return Err("源照片路径解析失败，请检查文件是否存在。".to_string()),
    };

    if !verify_in_active_folder(&file_path_canon) {
      return Err("安全拒绝：部分文件超出授权扫描范围。".to_string());
    }

    if !file_path_canon.exists() {
      return Err("源图片不存在，可能已被移动或删除。".to_string());
    }

    // 核心重叠检查：对每个待复制原文件 parent 进行检查
    if let Some(source_parent) = file_path_canon.parent() {
      let source_parent_canon = match source_parent.canonicalize() {
        Ok(p) => p,
        Err(_) => return Err("解析源照片所在文件夹路径失败。".to_string()),
      };

      if dest_canon == source_parent_canon 
         || dest_canon.starts_with(&source_parent_canon) 
         || source_parent_canon.starts_with(&dest_canon) 
      {
        return Err("安全拒绝：导出目标不能是原照片所在文件夹或其子文件夹，请选择一个新的空文件夹。".to_string());
      }
    }

    let ext = file_path_canon
      .extension()
      .and_then(|e| e.to_str())
      .unwrap_or("")
      .to_lowercase();

    let file_stem = file_path_canon
      .file_stem()
      .and_then(|s| s.to_str())
      .unwrap_or("photo")
      .to_string();

    ready_items.push((file_path_canon, file_stem, ext));
  }

  // 核心重叠检查和安全性校验全部通过后，此时才进行目标位置的写权限测试，杜绝在不安全目标创建临时文件
  let test_write_file = dest_canon.join(".ai_photo_cleaner_write_test");
  match fs::write(&test_write_file, "write_test") {
    Ok(_) => {
      let _ = fs::remove_file(test_write_file);
    }
    Err(_) => {
      return Err("目标文件夹没有写入权限，请重新选择。".to_string());
    }
  }

  // 第二轮：物理拷贝阶段 (此时已完全确认所有目标路径安全且可写，无中途失败风险)
  let mut copied_count = 0;
  let mut failed_count = 0;
  let mut errors = Vec::new();

  for (file_path_canon, file_stem, ext) in ready_items {
    let mut final_filename = if ext.is_empty() {
      file_stem.clone()
    } else {
      format!("{}.{}", file_stem, ext)
    };

    let mut dest_path = dest_canon.join(&final_filename);
    let mut collision_counter = 1;
    let mut dest_file = None;

    while dest_file.is_none() {
      match fs::OpenOptions::new().write(true).create_new(true).open(&dest_path) {
        Ok(file) => {
          dest_file = Some(file);
        }
        Err(ref e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
          final_filename = if ext.is_empty() {
            format!("{}-{}", file_stem, collision_counter)
          } else {
            format!("{}-{}.{}", file_stem, collision_counter, ext)
          };
          dest_path = dest_canon.join(&final_filename);
          collision_counter += 1;
        }
        Err(_) => {
          break;
        }
      }
    }

    if let Some(mut dest) = dest_file {
      match fs::File::open(&file_path_canon) {
        Ok(mut src) => {
          match std::io::copy(&mut src, &mut dest) {
            Ok(_) => {
              copied_count += 1;
            }
            Err(_) => {
              failed_count += 1;
              errors.push("写入目标文件内容失败，磁盘可能已满。".to_string());
            }
          }
        }
        Err(_) => {
          failed_count += 1;
          errors.push("无法打开源文件进行读取。".to_string());
        }
      }
    } else {
      failed_count += 1;
      errors.push("无法创建目标文件，可能无权限。".to_string());
    }
  }

  errors.dedup();

  Ok(KeepCopySummary {
    copied_count,
    skipped_count: 0,
    failed_count,
    target_folder_name,
    errors,
  })
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
      scan_selected_image_files,
      read_native_preview_bytes,
      select_physical_org_output_folder,
      create_physical_org_dry_run,
      execute_physical_org_copy,
      clear_physical_org_session,
      copy_keep_photos_to_folder,
      save_text_file
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
