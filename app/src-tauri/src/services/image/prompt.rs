use crate::domain::config::{fill_template, ImagePrompts};

pub fn build_cover_prompt(prompts: &ImagePrompts, title: &str, genre: &str, theme: &str) -> String {
    fill_template(
        &prompts.cover,
        &[
            ("title", title),
            ("genre", genre),
            ("theme", theme),
            ("style_prefix", &prompts.style_prefix),
        ],
    )
}

pub fn build_character_prompt(
    prompts: &ImagePrompts,
    title: &str,
    name: &str,
    desc: &str,
) -> String {
    fill_template(
        &prompts.character_image,
        &[
            ("title", title),
            ("character_name", name),
            ("character_desc", desc),
            ("style_prefix", &prompts.style_prefix),
        ],
    )
}

pub fn build_scene_prompt(
    prompts: &ImagePrompts,
    title: &str,
    chapter_num: u32,
    chapter_title: &str,
    scene_desc: &str,
    mood: &str,
) -> String {
    fill_template(
        &prompts.scene,
        &[
            ("title", title),
            ("chapter_num", &chapter_num.to_string()),
            ("chapter_title", chapter_title),
            ("scene_desc", scene_desc),
            ("mood", mood),
            ("style_prefix", &prompts.style_prefix),
        ],
    )
}
