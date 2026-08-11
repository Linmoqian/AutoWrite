use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::error::Result;
use crate::services::files;
use crate::services::image::{ImageKind, ImageResult};

pub fn images_dir(dir: &Path) -> PathBuf {
    dir.join("images")
}

pub fn images_meta_file(dir: &Path) -> PathBuf {
    images_dir(dir).join("meta.json")
}

pub fn save_image_file(dir: &Path, kind: &ImageKind, id: &str, bytes: &[u8]) -> Result<String> {
    let img_dir = images_dir(dir);
    std::fs::create_dir_all(&img_dir)?;

    let prefix = match kind {
        ImageKind::Cover => "cover",
        ImageKind::Character => "char",
        ImageKind::Scene => "scene",
    };
    let filename = format!("{}_{}.png", prefix, id);
    let file_path = img_dir.join(&filename);
    std::fs::write(&file_path, bytes)?;

    Ok(filename)
}

pub fn list_images(dir: &Path) -> Result<Vec<ImageResult>> {
    let meta_path = images_meta_file(dir);
    if !meta_path.exists() {
        return Ok(Vec::new());
    }
    let content = std::fs::read_to_string(&meta_path)?;
    let images: Vec<ImageResult> = serde_json::from_str(&content)?;
    Ok(images)
}

pub fn append_image_meta(dir: &Path, result: &ImageResult) -> Result<()> {
    let mut images = list_images(dir)?;
    images.push(result.clone());
    save_all_images_meta(dir, &images)
}

pub fn save_all_images_meta(dir: &Path, images: &[ImageResult]) -> Result<()> {
    let img_dir = images_dir(dir);
    std::fs::create_dir_all(&img_dir)?;
    let content = serde_json::to_string_pretty(images)?;
    files::write_file_atomic(&images_meta_file(dir), &content)
}

pub fn delete_image(dir: &Path, image_id: &str) -> Result<()> {
    let mut images = list_images(dir)?;
    let img_dir = images_dir(dir);

    images.retain(|img| {
        if img.id == image_id {
            let path = img_dir.join(&img.local_path);
            let _ = std::fs::remove_file(path);
            false
        } else {
            true
        }
    });

    save_all_images_meta(dir, &images)
}

pub fn generate_id() -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{:x}", ts)
}
