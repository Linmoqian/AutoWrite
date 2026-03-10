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


def test_get_novel(client):
    """测试获取小说详情"""
    # 先创建
    payload = {
        "title": "详情测试",
        "genre": "dushi",
        "theme": "都市"
    }
    create_resp = client.post("/api/novels", json=payload)
    novel_id = create_resp.json()["id"]

    # 获取详情
    response = client.get(f"/api/novels/{novel_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == novel_id
    assert data["title"] == "详情测试"
    assert data["chapters"] == []
    assert data["characters"] == []


def test_update_novel(client):
    """测试更新小说"""
    # 先创建
    payload = {"title": "原始标题", "genre": "xuanhuan", "theme": "修仙"}
    create_resp = client.post("/api/novels", json=payload)
    novel_id = create_resp.json()["id"]

    # 更新
    update_payload = {"title": "新标题", "workflowStatus": "writing"}
    response = client.patch(f"/api/novels/{novel_id}", json=update_payload)

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "新标题"
    assert data["workflowStatus"] == "writing"


def test_delete_novel(client):
    """测试删除小说"""
    # 先创建
    payload = {"title": "待删除", "genre": "xuanhuan", "theme": "修仙"}
    create_resp = client.post("/api/novels", json=payload)
    novel_id = create_resp.json()["id"]

    # 删除
    response = client.delete(f"/api/novels/{novel_id}")

    assert response.status_code == 204

    # 验证已删除
    get_resp = client.get(f"/api/novels/{novel_id}")
    assert get_resp.status_code == 404
