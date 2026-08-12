//! 副驾驶聊天 DTO（IPC 视图，对齐前端 `types/index.ts`，camelCase）。

use crate::state::ChatMessage;
use serde::Serialize;

/// IPC 视图：单条聊天消息。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageDto {
    pub id: String,
    pub role: ChatRole,
    pub content: String,
    /// ISO 8601 (RFC3339)，如 2026-08-12T10:30:00+08:00
    pub created_at: String,
}

/// 消息角色（lowercase 序列化，对齐前端 `"user" | "assistant"`）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ChatRole {
    User,
    Assistant,
}

impl From<ChatMessage> for ChatMessageDto {
    fn from(m: ChatMessage) -> Self {
        Self {
            id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at.to_rfc3339(),
        }
    }
}
