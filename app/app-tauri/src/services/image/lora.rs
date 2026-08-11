use crate::domain::config::LoraConfig;
use crate::error::{AppError, Result};

pub fn serialize_loras(config: &LoraConfig) -> Result<Option<serde_json::Value>> {
    if config.entries.is_empty() {
        return Ok(None);
    }
    if config.entries.len() > 6 {
        return Err(AppError::Image("ModelScope LoRA 最多支持 6 个".to_string()));
    }
    if config.entries.len() == 1 && config.entries[0].weight.is_none() {
        return Ok(Some(serde_json::Value::String(
            config.entries[0].name.clone(),
        )));
    }

    let explicit_weight_sum: f64 = config.entries.iter().filter_map(|entry| entry.weight).sum();
    if explicit_weight_sum > 0.0 && (explicit_weight_sum - 1.0).abs() > 0.001 {
        return Err(AppError::Image(format!(
            "ModelScope 多 LoRA 权重总和必须为 1.0，当前为 {:.3}",
            explicit_weight_sum
        )));
    }

    let mut map = serde_json::Map::new();
    for entry in &config.entries {
        let weight = entry
            .weight
            .unwrap_or_else(|| 1.0_f64 / config.entries.len() as f64);
        map.insert(entry.name.clone(), serde_json::Value::from(weight));
    }
    Ok(Some(serde_json::Value::Object(map)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::config::{LoraConfig, LoraEntry};

    #[test]
    fn serialize_single_lora_without_weight_as_string() {
        let value = serialize_loras(&LoraConfig {
            entries: vec![LoraEntry {
                name: "user/lora".to_string(),
                weight: None,
            }],
        })
        .unwrap();

        assert_eq!(
            value,
            Some(serde_json::Value::String("user/lora".to_string()))
        );
    }

    #[test]
    fn serialize_multiple_loras_requires_weight_sum_one() {
        let err = serialize_loras(&LoraConfig {
            entries: vec![
                LoraEntry {
                    name: "user/a".to_string(),
                    weight: Some(0.7),
                },
                LoraEntry {
                    name: "user/b".to_string(),
                    weight: Some(0.4),
                },
            ],
        })
        .unwrap_err();

        assert!(err.to_string().contains("权重总和必须为 1.0"));
    }
}
