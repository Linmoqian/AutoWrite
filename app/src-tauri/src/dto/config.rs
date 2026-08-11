//! 应用配置 DTO 层（ADR-008）。
//!
//! 领域 `AppConfig` 为扁平结构且字段名与磁盘 YAML 兼容（snake_case），
//! 前端 SPEC 6.3 期望嵌套结构 + camelCase。本模块负责双向映射：
//! - `From<AppConfig> for AppConfigDto`：领域 → IPC 视图（load_config 返回）。
//! - `From<AppConfigDto> for AppConfig`：IPC 视图 → 领域（save_config 入参反序列化）。
//!
//! 反向映射必须覆盖全部领域字段，否则用户保存配置会丢字段（novel_dir 除外，
//! novel_dir 由命令层在反序列化后从现有配置注入，前端不感知该字段）。

use serde::{Deserialize, Serialize};

use crate::domain::config::{AppConfig, LoraConfig, Provider};

/// IPC 视图：应用配置。嵌套结构对齐前端 `AppConfig`（SPEC 6.3）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfigDto {
    pub provider: Provider,
    pub openai: OpenAiConfigDto,
    pub ollama: OllamaConfigDto,
    pub prompts: PromptsDto,
    pub image: ImageConfigDto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenAiConfigDto {
    pub api_key: String,
    pub api_url: String,
    pub model: String,
    pub timeout: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OllamaConfigDto {
    pub api_url: String,
    pub model: String,
    pub timeout: u64,
    pub num_ctx: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageConfigDto {
    pub model: String,
    pub api_url: String,
    pub api_token: String,
    pub loras: Vec<LoraEntryDto>,
    pub size: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoraEntryDto {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub weight: Option<f64>,
}

/// IPC 视图：提示词。仅暴露前端编辑的 4 个，其余（extract_*）保留领域默认值。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptsDto {
    pub world_view: String,
    pub characters: String,
    pub outline: String,
    pub chapter: String,
}

impl From<AppConfig> for AppConfigDto {
    fn from(c: AppConfig) -> Self {
        // 领域 ollama_model 为空时回退到主 model，保证前端始终拿到有效值。
        let ollama_model = if c.ollama_model.is_empty() {
            c.model.clone()
        } else {
            c.ollama_model
        };

        Self {
            provider: c.provider,
            openai: OpenAiConfigDto {
                api_key: c.api_key,
                api_url: c.api_base_url,
                model: c.model.clone(),
                timeout: c.timeout,
            },
            ollama: OllamaConfigDto {
                api_url: c.ollama_url,
                model: ollama_model,
                timeout: c.timeout,
                num_ctx: c.num_ctx,
            },
            prompts: PromptsDto {
                world_view: c.prompts.world,
                characters: c.prompts.character,
                outline: c.prompts.outline,
                chapter: c.prompts.chapter,
            },
            image: ImageConfigDto {
                model: c.image_model,
                api_url: c.image_api_base_url,
                api_token: c.image_api_key,
                loras: c
                    .image_loras
                    .entries
                    .into_iter()
                    .map(|e| LoraEntryDto {
                        name: e.name,
                        weight: e.weight,
                    })
                    .collect(),
                size: c.image_size,
            },
        }
    }
}

impl From<AppConfigDto> for AppConfig {
    /// 反向映射。注意：novel_dir / image_prompts / image_provider 不在此覆盖，
    /// 命令层在反序列化后注入 novel_dir，其余保持 `AppConfig::default()` 的值。
    fn from(d: AppConfigDto) -> Self {
        let prompts = crate::domain::config::Prompts {
            world: d.prompts.world_view,
            character: d.prompts.characters,
            outline: d.prompts.outline,
            chapter: d.prompts.chapter,
            ..crate::domain::config::Prompts::default()
        };

        let loras = LoraConfig {
            entries: d
                .image
                .loras
                .into_iter()
                .map(|e| crate::domain::config::LoraEntry {
                    name: e.name,
                    weight: e.weight,
                })
                .collect(),
        };

        Self {
            // novel_dir 不覆盖：调用方负责注入。
            novel_dir: None,
            provider: d.provider,
            model: d.openai.model,
            ollama_model: d.ollama.model,
            timeout: d.openai.timeout,
            ollama_url: d.ollama.api_url,
            num_ctx: d.ollama.num_ctx,
            api_base_url: d.openai.api_url,
            api_key: d.openai.api_key,
            prompts,
            // image_provider / image_prompts 保持默认。
            image_provider: crate::domain::config::ImageProvider::ModelScope,
            image_model: d.image.model,
            image_api_base_url: d.image.api_url,
            image_api_key: d.image.api_token,
            image_size: d.image.size,
            image_prompts: crate::domain::config::ImagePrompts::default(),
            image_loras: loras,
        }
    }
}
