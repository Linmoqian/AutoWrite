use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),
    #[error("YAML 解析错误: {0}")]
    Yaml(#[from] serde_yaml::Error),
    #[error("JSON 解析错误: {0}")]
    Json(#[from] serde_json::Error),
    #[error("HTTP 请求错误: {0}")]
    Http(#[from] reqwest::Error),
    #[error("小说未找到: {0}")]
    NovelNotFound(String),
    #[error("第 {0} 章大纲缺失，请先在「大纲管理」页面生成大纲")]
    OutlineMissing(u32),
    #[error("AI 调用失败: {0}")]
    AiFailed(String),
    #[error("未选择小说目录")]
    NoNovelDir,
    #[error("目录下已有小说「{0}」，请先选择新目录")]
    NovelAlreadyExists(String),
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_str())
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
