use std::path::PathBuf;

use autowrite_core::domain::config::{fill_template, AppConfig, Prompts, Provider};
use autowrite_lib::services::config::{load_config, save_config};

fn temp_config_path() -> PathBuf {
    let dir = std::env::temp_dir().join("autowrite-test-config");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("config.yaml")
}

#[test]
fn default_config_is_openai_deepseek() {
    let config = AppConfig::default();
    assert_eq!(config.provider, Provider::OpenAI);
    assert_eq!(config.model, "deepseek-chat");
    assert_eq!(config.api_base_url, "https://api.deepseek.com");
    assert_eq!(config.api_key, "");
    assert_eq!(config.timeout, 300);
    assert!(config.novel_dir.is_none());
}

#[test]
fn save_and_load_roundtrip() {
    let path = temp_config_path();
    let original = AppConfig {
        novel_dir: Some("/tmp/test-novels".to_string()),
        provider: Provider::OpenAI,
        model: "gpt-4o".to_string(),
        timeout: 600,
        ollama_url: "http://localhost:11434".to_string(),
        api_base_url: "https://api.openai.com".to_string(),
        api_key: "sk-test-key-12345".to_string(),
        prompts: Prompts::default(),
        ..AppConfig::default()
    };

    save_config(&path, &original).unwrap();
    let loaded = load_config(&path).unwrap();

    assert_eq!(loaded.novel_dir, original.novel_dir);
    assert_eq!(loaded.provider, original.provider);
    assert_eq!(loaded.model, original.model);
    assert_eq!(loaded.timeout, original.timeout);
    assert_eq!(loaded.api_base_url, original.api_base_url);
    assert_eq!(loaded.api_key, original.api_key);

    let _ = std::fs::remove_file(&path);
}

#[test]
fn load_missing_file_returns_default() {
    let path = std::env::temp_dir()
        .join("autowrite-test-nonexistent")
        .join("missing.yaml");
    let config = load_config(&path).unwrap();
    assert_eq!(config.provider, Provider::OpenAI);
}

#[test]
fn partial_deserialization_uses_defaults() {
    let yaml = r#"
model: "qwen3:8b"
timeout: 120
"#;
    let config: AppConfig = serde_yaml::from_str(yaml).unwrap();
    assert_eq!(config.model, "qwen3:8b");
    assert_eq!(config.timeout, 120);
    assert_eq!(config.provider, Provider::OpenAI); // default
    assert_eq!(config.api_base_url, ""); // default empty
    assert_eq!(config.api_key, ""); // default empty
    assert_eq!(config.ollama_url, "http://localhost:11434"); // default
    assert_eq!(config.image_model, "Tongyi-MAI/Z-Image-Turbo"); // default
}

#[test]
fn fill_template_replaces_variables() {
    let result = fill_template(
        "Hello {name}, welcome to {place}!",
        &[("name", "World"), ("place", "Rust")],
    );
    assert_eq!(result, "Hello World, welcome to Rust!");
}

#[test]
fn provider_serialization_roundtrip() {
    let yaml = serde_yaml::to_string(&Provider::OpenAI).unwrap();
    assert!(yaml.contains("openai"));

    let yaml = serde_yaml::to_string(&Provider::Ollama).unwrap();
    assert!(yaml.contains("ollama"));

    let p: Provider = serde_yaml::from_str("openai").unwrap();
    assert_eq!(p, Provider::OpenAI);

    let p: Provider = serde_yaml::from_str("ollama").unwrap();
    assert_eq!(p, Provider::Ollama);
}
