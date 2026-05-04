use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prompts {
    pub world: String,
    pub character: String,
    pub outline: String,
    pub chapter: String,
    #[serde(default)]
    pub extract_facts: String,
    #[serde(default)]
    pub extract_intent: String,
    #[serde(default)]
    pub extract_emotion: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ImageProvider {
    #[default]
    OpenAI,
}

fn default_image_model() -> String {
    "dall-e-3".to_string()
}

fn default_image_size() -> String {
    "1024x1024".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImagePrompts {
    #[serde(default = "default_image_style_prefix")]
    pub style_prefix: String,
    #[serde(default)]
    pub cover: String,
    #[serde(default)]
    pub character_image: String,
    #[serde(default)]
    pub scene: String,
    #[serde(default)]
    pub extract_scene: String,
}

fn default_image_style_prefix() -> String {
    "水墨风格，深色基调，金色点缀，东方美学".to_string()
}

impl Default for ImagePrompts {
    fn default() -> Self {
        Self {
            style_prefix: default_image_style_prefix(),
            cover: "为小说《{title}》绘制封面。类型：{genre}，主题：{theme}。\n要求：构图宏大，突出小说核心意象，适合作为书籍封面，无文字。{style_prefix}".to_string(),
            character_image: "为小说《{title}》中的角色「{character_name}」绘制立绘。\n角色描述：{character_desc}\n要求：全身或半身像，突出角色外貌特征和气质，背景简洁。{style_prefix}".to_string(),
            scene: "为小说《{title}》第{chapter_num}章「{chapter_title}」绘制场景插图。\n场景描述：{scene_desc}\n氛围关键词：{mood}\n要求：以场景氛围为主，不出现清晰人脸，无文字。{style_prefix}".to_string(),
            extract_scene: "请从以下章节内容中提取适合生成场景插图的视觉描述。\n\n要求：\n1. 提取最具视觉冲击力的场景（一个即可）\n2. 将文学性描述转化为具体的视觉元素：构图、光影、色调、关键物体\n3. 用简洁的中文描述，100字以内\n4. 附带氛围关键词（2-3个词，如\"阴郁、紧张\"、\"温暖、治愈\"）\n\n请严格按以下JSON格式输出：\n{\"scene_desc\": \"视觉场景描述\", \"mood\": \"氛围关键词1、氛围关键词2\"}\n\n章节内容：\n{content}".to_string(),
        }
    }
}

impl Default for Prompts {
    fn default() -> Self {
        Self {
            world: "请为一部{genre}类型的小说创建世界观设定。\n主题：{theme}\n要求：\n1. 修炼/能力体系（3-5个等级）\n2. 世界背景（势力分布、历史背景）\n3. 特色元素（2-3个独特的设定）\n4. 字数：500-800字\n直接输出世界观内容，不要有标题和额外说明。".to_string(),
            character: "基于以下世界观，创建小说角色：\n{world}\n要求创建：\n1. 主角（1人）：要有独特的金手指或优势\n2. 重要配角（2-3人）：与主角有明确关系\n每个角色包含：姓名、身份、性格、与主角关系、目标\n直接输出角色信息，用列表格式。".to_string(),
            outline: "基于以下设定，生成小说大纲：\n## 世界观\n{world}\n## 角色\n{characters}\n## 要求\n- 总章数：{total_chapters}章\n- 分卷规划（每卷20-30章）\n- 每章一行，格式：章节号. 标题\n- 主线清晰，有起承转合\n直接输出大纲，按卷分组。".to_string(),
            chapter: "你是一位资深小说作家，正在创作一部{genre}类型小说，主题为{theme}。\n\n## 叙事核心\n{intent_block}\n\n## 事实基础\n### 角色当前位置与状态\n{character_states}\n\n### 已发生的关键事件\n{plot_events}\n\n### 尚未解决的悬念\n{tension_checklist}\n\n### 情感走向\n最近几章的情感轨迹：{emotional_arc}\n\n## 本章写作任务\n第{num}章：{title}\n\n写作要求：围绕核心叙事张力展开，用场景和对话推进剧情，\n自然处理至少一个未解决的悬念。字数约{words}字。\n直接输出章节正文内容。".to_string(),
            extract_facts: "请从以下章节内容中提取结构化信息，严格按JSON格式输出：\n\n{{\n  \"character_states\": [\n    {{\"name\": \"角色名\", \"location\": \"当前位置\", \"power_level\": \"当前实力\", \"recent_action\": \"最近行动\", \"status\": \"状态\"}}\n  ],\n  \"plot_events\": [\"关键事件1\", \"关键事件2\", \"关键事件3\"],\n  \"unresolved_threads\": [\"未解决的悬念1\", \"未解决的悬念2\"]\n}}\n\n要求：\n- character_states 包含本章出现的所有重要角色\n- plot_events 只记录推动剧情的关键事件，最多5个\n- unresolved_threads 记录本章新增或延续的未解决线索\n\n章节内容：\n{content}".to_string(),
            extract_intent: "请阅读以下章节内容，用简洁的语言回答三个问题：\n\n1. 角色想要什么？（一句话）\n2. 什么阻碍了他？（一句话）\n3. 读者该在意什么？（一句话）\n\n请严格按以下JSON格式输出：\n{{\"character_wants\": \"...\", \"obstacle\": \"...\", \"reader_should_care\": \"...\"}}\n\n章节内容：\n{content}".to_string(),
            extract_emotion: "请为以下章节的情感走向打标签。输出JSON：\n{{\"tags\": [{{\"tag\": \"情感标签\", \"intensity\": 1}}]}}\n\n可选标签：紧张、愤怒、悲伤、温馨、热血、恐惧、希望、绝望、迷茫、震撼\nintensity范围1-5，每章最多3个标签。\n\n章节内容：\n{content}".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    #[default]
    OpenAI,
    Ollama,
}

fn default_timeout() -> u64 {
    300
}

fn default_ollama_url() -> String {
    "http://localhost:11434".to_string()
}

fn default_model() -> String {
    "deepseek-chat".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub novel_dir: Option<String>,
    #[serde(default)]
    pub provider: Provider,
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default)]
    pub ollama_model: String,
    #[serde(default = "default_timeout")]
    pub timeout: u64,
    #[serde(default = "default_ollama_url")]
    pub ollama_url: String,
    #[serde(default)]
    pub api_base_url: String,
    #[serde(default)]
    pub api_key: String,
    #[serde(default)]
    pub prompts: Prompts,
    #[serde(default)]
    pub image_provider: ImageProvider,
    #[serde(default = "default_image_model")]
    pub image_model: String,
    #[serde(default)]
    pub image_api_base_url: String,
    #[serde(default)]
    pub image_api_key: String,
    #[serde(default = "default_image_size")]
    pub image_size: String,
    #[serde(default)]
    pub image_prompts: ImagePrompts,
}

impl AppConfig {
    pub fn active_model(&self) -> &str {
        match self.provider {
            Provider::Ollama => {
                if self.ollama_model.is_empty() {
                    &self.model
                } else {
                    &self.ollama_model
                }
            }
            Provider::OpenAI => &self.model,
        }
    }

    pub fn image_api_base_url(&self) -> &str {
        if self.image_api_base_url.is_empty() {
            &self.api_base_url
        } else {
            &self.image_api_base_url
        }
    }

    pub fn image_api_key(&self) -> &str {
        if self.image_api_key.is_empty() {
            &self.api_key
        } else {
            &self.image_api_key
        }
    }
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            novel_dir: None,
            provider: Provider::OpenAI,
            model: "deepseek-chat".to_string(),
            ollama_model: String::new(),
            timeout: 300,
            ollama_url: "http://localhost:11434".to_string(),
            api_base_url: "https://api.deepseek.com".to_string(),
            api_key: String::new(),
            prompts: Prompts::default(),
            image_provider: ImageProvider::OpenAI,
            image_model: "dall-e-3".to_string(),
            image_api_base_url: String::new(),
            image_api_key: String::new(),
            image_size: "1024x1024".to_string(),
            image_prompts: ImagePrompts::default(),
        }
    }
}

pub fn fill_template(template: &str, vars: &[(&str, &str)]) -> String {
    let mut result = template.to_string();
    for (key, value) in vars {
        result = result.replace(&format!("{{{}}}", key), value);
    }
    result
}

pub fn load_config(path: &Path) -> Result<AppConfig> {
    if !path.exists() {
        return Ok(AppConfig::default());
    }
    let content = std::fs::read_to_string(path)?;
    let config: AppConfig = serde_yaml::from_str(&content)?;
    Ok(config)
}

pub fn save_config(path: &Path, config: &AppConfig) -> Result<()> {
    let content = serde_yaml::to_string(config)?;
    std::fs::write(path, content)?;
    Ok(())
}
