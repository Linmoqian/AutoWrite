"""角色 API 测试"""

import pytest


def test_create_character(client):
    """测试创建角色"""
    novel_payload = {"title": "角色测试", "genre": "xuanhuan", "theme": "修仙"}
    novel_resp = client.post("/api/novels", json=novel_payload)
    novel_id = novel_resp.json()["id"]

    character_payload = {
        "name": "主角",
        "role": "protagonist",
        "description": "故事主角",
        "traits": ["勇敢", "善良"]
    }
    response = client.post(f"/api/novels/{novel_id}/characters", json=character_payload)

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "主角"
    assert data["role"] == "protagonist"
    assert data["traits"] == ["勇敢", "善良"]


def test_list_characters(client):
    """测试获取角色列表"""
    novel_payload = {"title": "角色列表", "genre": "xuanhuan", "theme": "修仙"}
    novel_resp = client.post("/api/novels", json=novel_payload)
    novel_id = novel_resp.json()["id"]

    character_payload = {"name": "配角", "role": "supporting", "description": "配角描述"}
    client.post(f"/api/novels/{novel_id}/characters", json=character_payload)

    response = client.get(f"/api/novels/{novel_id}/characters")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "配角"


def test_update_character(client):
    """测试更新角色"""
    novel_payload = {"title": "更新角色", "genre": "xuanhuan", "theme": "修仙"}
    novel_resp = client.post("/api/novels", json=novel_payload)
    novel_id = novel_resp.json()["id"]

    character_payload = {"name": "原名", "role": "protagonist", "description": "原描述"}
    character_resp = client.post(f"/api/novels/{novel_id}/characters", json=character_payload)
    character_id = character_resp.json()["id"]

    update_payload = {"name": "新名称", "traits": ["勇敢"]}
    response = client.patch(
        f"/api/novels/{novel_id}/characters/{character_id}",
        json=update_payload
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "新名称"
    assert data["traits"] == ["勇敢"]


def test_delete_character(client):
    """测试删除角色"""
    novel_payload = {"title": "删除角色", "genre": "xuanhuan", "theme": "修仙"}
    novel_resp = client.post("/api/novels", json=novel_payload)
    novel_id = novel_resp.json()["id"]

    character_payload = {"name": "待删除", "role": "minor", "description": "描述"}
    character_resp = client.post(f"/api/novels/{novel_id}/characters", json=character_payload)
    character_id = character_resp.json()["id"]

    response = client.delete(f"/api/novels/{novel_id}/characters/{character_id}")

    assert response.status_code == 204

    # 验证已删除 - 通过角色列表检查
    list_resp = client.get(f"/api/novels/{novel_id}/characters")
    characters = list_resp.json()
    character_ids = [c["id"] for c in characters]
    assert character_id not in character_ids
