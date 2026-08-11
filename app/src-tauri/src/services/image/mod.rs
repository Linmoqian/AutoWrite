mod generate;
mod lora;
mod meta;
mod prompt;

pub use generate::{download_image, extract_scene, generate_image, GeneratedImageData};
pub use lora::serialize_loras;
pub use meta::{
    append_image_meta, delete_image, generate_id, images_dir, images_meta_file, list_images,
    save_all_images_meta, save_image_file,
};
pub use prompt::{build_character_prompt, build_cover_prompt, build_scene_prompt};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ImageKind {
    Cover,
    Character,
    Scene,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageResult {
    pub id: String,
    pub kind: ImageKind,
    pub prompt: String,
    pub revised_prompt: Option<String>,
    pub local_path: String,
    pub file_size: u64,
    pub created: String,
    pub ref_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneDescription {
    pub scene_desc: String,
    pub mood: String,
}
