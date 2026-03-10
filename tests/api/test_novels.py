"""小说 API CRUD 测试"""


def test_list_novels_empty(client):
    """测试获取空小说列表"""
    response = client.get("/api/novels")

    assert response.status_code == 200
    data = response.json()
    assert data["novels"] == []
    assert data["total"] == 0


def test_create_novel(client):
    """测试创建小说"""
    payload = {
        "title": "测试小说",
        "genre": "xuanhuan",
        "theme": "修仙",
        "targetChapters": 50,
        "description": "这是一本测试小说"
    }

    response = client.post("/api/novels", json=payload)

    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "测试小说"
    assert data["genre"] == "xuanhuan"
    assert data["workflowStatus"] == "outline"
    assert "id" in data
    assert "createdAt" in data
