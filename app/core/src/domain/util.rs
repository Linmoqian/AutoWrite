//! 领域层通用纯函数。

/// 将后端内部大纲步骤名映射为前端 `OutlineStep` 契约值。
///
/// 前端 `OutlineStep = "worldView" | "characters" | "outline"`（见
/// `src/types/index.ts`），后端流式生成内部用 `"world"`（与提示词模板
/// 对齐）。其余步骤（`characters` / `outline`）两端一致，原样返回。
///
/// 此函数为纯字符串映射，无类型依赖，供 `domain` 与 `dto` 两层共享，
/// 避免出现 `domain → dto` 的反向模块引用（ADR-008 遗留风险修复）。
pub fn map_step(s: &str) -> &str {
    match s {
        "world" => "worldView",
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::map_step;

    #[test]
    fn maps_world_to_worldview() {
        assert_eq!(map_step("world"), "worldView");
    }

    #[test]
    fn passes_through_other_steps() {
        assert_eq!(map_step("characters"), "characters");
        assert_eq!(map_step("outline"), "outline");
    }

    #[test]
    fn passes_through_unknown() {
        assert_eq!(map_step(""), "");
        assert_eq!(map_step("custom"), "custom");
    }
}
