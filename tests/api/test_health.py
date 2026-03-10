"""健康检查 API 测试"""


def test_root_health(client):
    """测试根路径健康检查"""
    response = client.get("/")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_api_health(client):
    """测试 /health 健康检查"""
    response = client.get("/health")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_cors_headers(client):
    """测试 CORS 响应头"""
    # CORS 预检请求需要 OPTIONS
    options_response = client.options(
        "/api/novels",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert options_response.status_code == 200

    # 验证 CORS 头存在
    headers = options_response.headers
    assert "access-control-allow-origin" in headers or "Access-Control-Allow-Origin" in headers
