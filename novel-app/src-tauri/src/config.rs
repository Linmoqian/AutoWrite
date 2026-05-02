use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prompts {
    pub world: String,
    pub character: String,
    pub outline: String,
    pub chapter: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub model: String,
    pub timeout: u64,
    pub ollama_url: String,
    pub prompts: Prompts,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            model: "deepseek-r1:7b".to_string(),
            timeout: 300,
            ollama_url: "http://localhost:11434".to_string(),
            prompts: Prompts {
                world: "请为一部{genre}类型的小说创建世界观设定。\n主题：{theme}\n要求：\n1. 修炼/能力体系（3-5个等级）\n2. 世界背景（势力分布、历史背景）\n3. 特色元素（2-3个独特的设定）\n4. 字数：500-800字\n直接输出世界观内容，不要有标题和额外说明。".to_string(),
                character: "基于以下世界观，创建小说角色：\n{world}\n要求创建：\n1. 主角（1人）：要有独特的金手指或优势\n2. 重要配角（2-3人）：与主角有明确关系\n每个角色包含：姓名、身份、性格、与主角关系、目标\n直接输出角色信息，用列表格式。".to_string(),
                outline: "基于以下设定，生成小说大纲：\n## 世界观\n{world}\n## 角色\n{characters}\n## 要求\n- 总章数：{total_chapters}章\n- 分卷规划（每卷20-30章）\n- 每章一行，格式：章节号. 标题\n- 主线清晰，有起承转合\n直接输出大纲，按卷分组。".to_string(),
                chapter: "{context}\n## 本章任务\n第{num}章：{title}\n## 大纲描述\n{outline_detail}\n## 要求\n- 字数：{words}字\n- 风格：{style}\n- 场景描写细腻，对话生动\n- 章末留悬念或转折\n直接输出章节正文内容。".to_string(),
            },
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
