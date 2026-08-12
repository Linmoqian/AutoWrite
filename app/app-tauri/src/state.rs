use crate::dto::ChatRole;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Default)]
pub struct AppState {
    pub novel_dir: Mutex<Option<PathBuf>>,
    pub config_path: Mutex<PathBuf>,
    pub outline_generation: Mutex<OutlineGenerationStatus>,
    /// 副驾驶聊天历史（按当前 novel_dir 维度，切目录时按小说加载）。P1 已落盘 `novel_dir/.chat.json`，跨会话保留。
    pub chat_history: Mutex<Vec<ChatMessage>>,
    /// 副驾驶流式并发守卫：同一时刻只允许一个流式对话，防连点竞态。
    pub chat_running: Mutex<bool>,
}

#[derive(Clone, Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutlineGenerationStatus {
    pub running: bool,
    pub completed: bool,
    pub current_step: Option<String>,
    pub streaming_text: HashMap<String, String>,
    pub error: Option<String>,
}

/// 内部领域结构：单条聊天消息（state 层用，不序列化到磁盘 MVP）。
#[derive(Debug, Clone)]
pub struct ChatMessage {
    pub id: String,
    pub role: ChatRole,
    pub content: String,
    pub created_at: chrono::DateTime<chrono::Local>,
}
