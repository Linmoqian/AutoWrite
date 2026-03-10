"""章节 API 测试"""

import pytest


def test_create_chapter(client):
    """测试创建章节"""
    # 先创建小说
    novel_payload = {"title": "章节测试", "genre": "xuanhuan", "theme": "修仙"}
    novel_resp = client.post("/api/novels", json=novel_payload)
    novel_id = novel_resp.json()["id"]

    # 创建章节
    chapter_payload = {
        "number": 1,
        "title": "第一章：开始",
        "content": "这是第一章的内容",
        "status": "draft"
    }
    response = client.post(f"/api/novels/{novel_id}/chapters", json=chapter_payload)

    assert response.status_code == 201
    data = response.json()
    assert data["number"] == 1
    assert data["title"] == "第一章：开始"
    assert data["wordCount"] == len("这是第一章的内容")


def test_list_chapters(client):
    """测试获取章节列表"""
    # 创建小说和章节
    novel_payload = {"title": "章节列表", "genre": "xuanhuan", "theme": "修仙"}
    novel_resp = client.post("/api/novels", json=novel_payload)
    novel_id = novel_resp.json()["id"]

    chapter_payload = {"number": 1, "title": "第一章", "content": "内容"}
    client.post(f"/api/novels/{novel_id}/chapters", json=chapter_payload)

    # 获取列表
    response = client.get(f"/api/novels/{novel_id}/chapters")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "第一章"


def test_update_chapter(client):
    """测试更新章节"""
    # 创建小说和章节
    novel_payload = {"title": "更新章节", "genre": "xuanhuan", "theme": "修仙"}
    novel_resp = client.post("/api/novels", json=novel_payload)
    novel_id = novel_resp.json()["id"]

    chapter_payload = {"number": 1, "title": "原标题", "content": "内容"}
    chapter_resp = client.post(f"/api/novels/{novel_id}/chapters", json=chapter_payload)
    chapter_id = chapter_resp.json()["id"]

    # 更新
    update_payload = {"title": "新标题", "status": "reviewing"}
    response = client.patch(
        f"/api/novels/{novel_id}/chapters/{chapter_id}",
        json=update_payload
    )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "新标题"
    assert data["status"] == "reviewing"


def test_delete_chapter(client):
    """测试删除章节"""
    # 创建小说和章节
    novel_payload = {"title": "删除章节", "genre": "xuanhuan", "theme": "修仙"}
    novel_resp = client.post("/api/novels", json=novel_payload)
    novel_id = novel_resp.json()["id"]

    chapter_payload = {"number": 1, "title": "待删除", "content": "内容"}
    chapter_resp = client.post(f"/api/novels/{novel_id}/chapters", json=chapter_payload)
    chapter_id = chapter_resp.json()["id"]

    # 删除
    response = client.delete(f"/api/novels/{novel_id}/chapters/{chapter_id}")

    assert response.status_code == 204
