"""YAML front matter 解析与构建模块"""

import yaml
from typing import Tuple, Optional


def parse_yaml_front_matter(content: str, return_body: bool = False) -> dict | Tuple[dict, str]:
    """解析 Markdown 文件中的 YAML front matter

    Args:
        content: Markdown 文件内容
        return_body: 是否同时返回正文内容

    Returns:
        如果 return_body=False: 返回解析后的 YAML 数据字典
        如果 return_body=True: 返回 (数据字典, 正文内容) 元组
    """
    if not content.startswith("---\n"):
        if return_body:
            return {}, content
        return {}

    parts = content.split("---\n", 2)
    if len(parts) < 3:
        if return_body:
            return {}, content
        return {}

    yaml_content = parts[1]
    body = parts[2].strip()

    data = yaml.safe_load(yaml_content) or {}

    if return_body:
        return data, body
    return data


def build_yaml_front_matter(data: dict) -> str:
    """构建 YAML front matter 字符串

    Args:
        data: 要序列化的数据字典

    Returns:
        格式化的 YAML front matter 字符串
    """
    yaml_str = yaml.dump(data, allow_unicode=True, default_flow_style=False)
    return f"---\n{yaml_str}---\n"
