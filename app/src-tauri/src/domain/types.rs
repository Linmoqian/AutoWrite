use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NovelData {
    pub title: String,
    pub genre: String,
    pub theme: String,
    pub target_chapters: u32,
    pub words_per_chapter: u32,
    pub model: String,
    pub created: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub world: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub characters: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Volume {
    pub volume: String,
    pub chapters: Vec<ChapterEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterEntry {
    pub num: u32,
    pub title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmotionalTag {
    pub tag: String,
    pub intensity: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TensionItem {
    pub item: String,
    #[serde(default = "default_open")]
    pub status: String,
}

fn default_open() -> String {
    "open".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NarrativeIntent {
    pub character_wants: String,
    pub obstacle: String,
    pub reader_should_care: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextData {
    pub current_chapter: u32,
    #[serde(default)]
    pub recent_summaries: Vec<String>,
    #[serde(default)]
    pub character_states: Vec<serde_yaml::Value>,
    #[serde(default)]
    pub pending_plots: Vec<String>,
    #[serde(default)]
    pub plot_events: Vec<String>,
    #[serde(default)]
    pub unresolved_threads: Vec<String>,
    #[serde(default)]
    pub emotional_arc: Vec<EmotionalTag>,
    #[serde(default)]
    pub tension_checklist: Vec<TensionItem>,
    #[serde(default)]
    pub current_intent: Option<NarrativeIntent>,
}

impl Default for ContextData {
    fn default() -> Self {
        Self {
            current_chapter: 0,
            recent_summaries: Vec::new(),
            character_states: Vec::new(),
            pending_plots: Vec::new(),
            plot_events: Vec::new(),
            unresolved_threads: Vec::new(),
            emotional_arc: Vec::new(),
            tension_checklist: Vec::new(),
            current_intent: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChapterMeta {
    pub chapter: u32,
    pub title: String,
    pub words: u32,
    pub created: String,
}
