"""数据存储服务 - JSON 文件持久化"""

import json
import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

DATA_DIR = Path("data/novels")


def ensure_data_dir() -> None:
    """确保数据目录存在"""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_novel_path(novel_id: str) -> Path:
    """获取小说数据文件路径"""
    return DATA_DIR / novel_id / "state.json"


def list_novels() -> List[Dict[str, Any]]:
    """列出所有小说"""
    ensure_data_dir()
    novels = []
    for novel_dir in DATA_DIR.iterdir():
        if novel_dir.is_dir():
            state_file = novel_dir / "state.json"
            if state_file.exists():
                with open(state_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    novels.append(data)
    return novels


def get_novel(novel_id: str) -> Optional[Dict[str, Any]]:
    """获取单个小说"""
    path = get_novel_path(novel_id)
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_novel(novel_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """保存小说数据"""
    ensure_data_dir()
    novel_dir = DATA_DIR / novel_id
    novel_dir.mkdir(parents=True, exist_ok=True)

    data["updatedAt"] = datetime.now().isoformat()

    path = novel_dir / "state.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return data


def create_novel(data: Dict[str, Any]) -> Dict[str, Any]:
    """创建新小说"""
    novel_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()

    novel = {
        "id": novel_id,
        "title": data["title"],
        "genre": data["genre"],
        "theme": data["theme"],
        "targetChapters": data.get("targetChapters", 100),
        "writtenChapters": 0,
        "wordCount": 0,
        "status": "todo",
        "workflowStatus": "outline",
        "outline": None,
        "description": data.get("description"),
        "createdAt": now,
        "updatedAt": now,
        "chapters": [],
        "characters": [],
    }

    return save_novel(novel_id, novel)


def delete_novel(novel_id: str) -> bool:
    """删除小说"""
    path = get_novel_path(novel_id)
    if not path.exists():
        return False

    novel_dir = DATA_DIR / novel_id
    shutil.rmtree(novel_dir)
    return True


# 章节管理
def add_chapter(novel_id: str, chapter_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """添加章节"""
    novel = get_novel(novel_id)
    if not novel:
        return None

    chapter_id = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()

    chapter = {
        "id": chapter_id,
        "novelId": novel_id,
        "number": chapter_data["number"],
        "title": chapter_data["title"],
        "content": chapter_data.get("content", ""),
        "wordCount": len(chapter_data.get("content", "")),
        "status": chapter_data.get("status", "draft"),
        "createdAt": now,
        "updatedAt": now,
    }

    novel["chapters"].append(chapter)
    novel["writtenChapters"] = len(novel["chapters"])
    novel["wordCount"] = sum(c["wordCount"] for c in novel["chapters"])

    save_novel(novel_id, novel)
    return chapter


def update_chapter(
    novel_id: str, chapter_id: str, chapter_data: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """更新章节"""
    novel = get_novel(novel_id)
    if not novel:
        return None

    for chapter in novel["chapters"]:
        if chapter["id"] == chapter_id:
            chapter.update(chapter_data)
            chapter["updatedAt"] = datetime.now().isoformat()
            if "content" in chapter_data:
                chapter["wordCount"] = len(chapter_data["content"])
            novel["wordCount"] = sum(c["wordCount"] for c in novel["chapters"])
            save_novel(novel_id, novel)
            return chapter

    return None


def delete_chapter(novel_id: str, chapter_id: str) -> bool:
    """删除章节"""
    novel = get_novel(novel_id)
    if not novel:
        return False

    original_len = len(novel["chapters"])
    novel["chapters"] = [c for c in novel["chapters"] if c["id"] != chapter_id]

    if len(novel["chapters"]) == original_len:
        return False

    novel["writtenChapters"] = len(novel["chapters"])
    novel["wordCount"] = sum(c["wordCount"] for c in novel["chapters"])
    save_novel(novel_id, novel)
    return True


# 角色管理
def add_character(novel_id: str, character_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """添加角色"""
    novel = get_novel(novel_id)
    if not novel:
        return None

    character_id = str(uuid.uuid4())[:8]

    character = {
        "id": character_id,
        "novelId": novel_id,
        "name": character_data["name"],
        "role": character_data.get("role", "supporting"),
        "description": character_data.get("description", ""),
        "traits": character_data.get("traits", []),
    }

    novel.setdefault("characters", []).append(character)
    save_novel(novel_id, novel)
    return character


def update_character(
    novel_id: str, character_id: str, character_data: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """更新角色"""
    novel = get_novel(novel_id)
    if not novel:
        return None

    for character in novel.get("characters", []):
        if character["id"] == character_id:
            character.update(character_data)
            save_novel(novel_id, novel)
            return character

    return None


def delete_character(novel_id: str, character_id: str) -> bool:
    """删除角色"""
    novel = get_novel(novel_id)
    if not novel:
        return False

    original_len = len(novel.get("characters", []))
    novel["characters"] = [
        c for c in novel.get("characters", []) if c["id"] != character_id
    ]

    if len(novel["characters"]) == original_len:
        return False

    save_novel(novel_id, novel)
    return True
