# 连接测试实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Ollama 连接测试和前后端 API 集成测试，确保系统核心组件通信正常。

**架构:** 使用 pytest 框架编写单元测试和集成测试。Ollama 测试使用 mock 和真实连接两种方式，API 测试使用 FastAPI TestClient。

**Tech Stack:** pytest, pytest-asyncio, httpx, aioresponses

---

## Chunk 1: Ollama 连接测试

### Task 1: 增强 OllamaClient 健康检查测试

**Files:**
- Modify: `tests/test_ollama_client.py`

- [ ] **Step 1: 添加健康检查失败的测试（mock）**

```python
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_ollama_health_check_failure():
    """测试 Ollama 服务不可用时的健康检查"""
    client = OllamaClient()

    # mock aiohttp 异常
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_get.side_effect = Exception("Connection refused")

        result = await client.check_health()
        assert result is False
```

- [ ] **Step 2: 添加健康检查成功的测试（mock）**

```python
@pytest.mark.asyncio
async def test_ollama_health_check_success():
    """测试 Ollama 服务可用时的健康检查"""
    client = OllamaClient()

    # mock 成功响应
    with patch("aiohttp.ClientSession.get") as mock_get:
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_get.return_value.__aenter__.return_value = mock_response

        result = await client.check_health()
        assert result is True
```

- [ ] **Step 3: 运行测试验证**

```bash
pytest tests/test_ollama_client.py::TestOllamaClient::test_ollama_health_check_failure -v
pytest tests/test_ollama_client.py::TestOllamaClient::test_ollama_health_check_success -v
```

Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add tests/test_ollama_client.py
git commit -m "test: 添加 Ollama 健康检查 mock 测试"
```

### Task 2: 添加真实 Ollama 连接集成测试

**Files:**
- Create: `tests/integration/test_ollama_integration.py`
- Create: `tests/conftest.py` (如不存在)

- [ ] **Step 1: 创建测试配置**

```python
# tests/conftest.py
import pytest

@pytest.fixture(scope="session")
def ollama_enabled():
    """检查是否启用 Ollama 真实连接测试"""
    import os
    return os.getenv("OLLAMA_TEST_ENABLED", "false").lower() == "true"

@pytest.fixture(scope="session")
def ollama_host():
    """获取测试用 Ollama 地址"""
    import os
    return os.getenv("OLLAMA_HOST", "http://localhost:11434")
```

- [ ] **Step 2: 创建集成测试文件**

```python
# tests/integration/test_ollama_integration.py
import pytest

from auto_novel.models.ollama_client import OllamaClient


@pytest.mark.integration
@pytest.mark.asyncio
async def test_real_ollama_health_check(ollama_enabled, ollama_host):
    """测试真实 Ollama 服务健康检查"""
    pytest.skipif(not ollama_enabled, reason="需要设置 OLLAMA_TEST_ENABLED=true")

    client = OllamaClient(host=ollama_host)
    result = await client.check_health()

    assert result is True, "Ollama 服务不可用"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_real_ollama_generate(ollama_enabled, ollama_host):
    """测试真实 Ollama 文本生成"""
    pytest.skipif(not ollama_enabled, reason="需要设置 OLLAMA_TEST_ENABLED=true")

    client = OllamaClient(host=ollama_host)
    result = await client.generate("你好", stream=False)

    assert isinstance(result, str)
    assert len(result) > 0
```

- [ ] **Step 3: 创建 integration 标记配置**

```ini
# pytest.ini (如不存在则创建)
[pytest]
markers =
    integration: 集成测试（需要外部服务）
```

- [ ] **Step 4: 运行测试验证（不启用集成测试）**

```bash
pytest tests/integration/test_ollama_integration.py -v
```

Expected: SKIP

- [ ] **Step 5: 运行测试验证（启用集成测试，需要 Ollama 运行）**

```bash
OLLAMA_TEST_ENABLED=true pytest tests/integration/test_ollama_integration.py -v
```

Expected: PASS (需要 Ollama 运行中)

- [ ] **Step 6: 提交**

```bash
git add tests/integration/ tests/conftest.py pytest.ini
git commit -m "test: 添加 Ollama 集成测试"
```

### Task 3: 添加 CLI 健康检查命令

**Files:**
- Create: `auto_novel/commands.py` (或添加到 `cli.py`)
- Modify: `main.py`

- [ ] **Step 1: 创建健康检查函数**

```python
# auto_novel/commands.py
async def check_ollama():
    """检查 Ollama 服务状态"""
    from auto_novel.models.ollama_client import OllamaClient
    from rich.console import Console

    console = Console()
    client = OllamaClient()

    with console.status("[bold cyan]检查 Ollama 服务...[/bold cyan]"):
        is_healthy = await client.check_health()

    if is_healthy:
        console.print("[green]✓[/green] Ollama 服务运行正常")
        return 0
    else:
        console.print("[red]✗[/red] Ollama 服务不可用")
        return 1
```

- [ ] **Step 2: 添加到 CLI**

```python
# main.py 添加 check 子命令
@app.command()
def check():
    """检查 Ollama 服务状态"""
    import asyncio
    from auto_novel.commands import check_ollama

    exit_code = asyncio.run(check_ollama())
    raise typer.Exit(exit_code)
```

- [ ] **Step 3: 手动测试**

```bash
python main.py check
```

Expected: 显示 Ollama 服务状态

- [ ] **Step 4: 提交**

```bash
git add auto_novel/commands.py main.py
git commit -m "feat: 添加 Ollama 健康检查命令"
```

---

## Chunk 2: 前后端 API 连接测试

### Task 4: 创建 API 测试基础框架

**Files:**
- Create: `tests/api/__init__.py`
- Create: `tests/api/conftest.py`

- [ ] **Step 1: 创建 API 测试 fixture**

```python
# tests/api/conftest.py
import pytest
import tempfile
import shutil
from pathlib import Path

from auto_novel.api.app import app
from auto_novel.api import storage


@pytest.fixture
def temp_data_dir():
    """创建临时数据目录"""
    temp_dir = tempfile.mkdtemp()
    original_path = storage.DATA_DIR

    storage.DATA_DIR = Path(temp_dir)
    storage.DATA_DIR.mkdir(parents=True, exist_ok=True)

    yield temp_dir

    # 清理
    shutil.rmtree(temp_dir, ignore_errors=True)
    storage.DATA_DIR = original_path


@pytest.fixture
def client(temp_data_dir):
    """创建测试客户端"""
    from fastapi.testclient import TestClient

    return TestClient(app)
```

- [ ] **Step 2: 运行测试验证 fixture 可用**

```bash
pytest tests/api/conftest.py -v --collect-only
```

Expected: 收集到 fixture

- [ ] **Step 3: 提交**

```bash
git add tests/api/
git commit -m "test: 添加 API 测试框架"
```

### Task 5: 小说 API CRUD 测试

**Files:**
- Create: `tests/api/test_novels.py`

- [ ] **Step 1: 写获取空列表测试**

```python
# tests/api/test_novels.py
def test_list_novels_empty(client):
    """测试获取空小说列表"""
    response = client.get("/api/novels")

    assert response.status_code == 200
    data = response.json()
    assert data["novels"] == []
    assert data["total"] == 0
```

- [ ] **Step 2: 运行测试验证**

```bash
pytest tests/api/test_novels.py::test_list_novels_empty -v
```

Expected: PASS

- [ ] **Step 3: 写创建小说测试**

```python
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
```

- [ ] **Step 4: 运行测试验证**

```bash
pytest tests/api/test_novels.py::test_create_novel -v
```

Expected: PASS

- [ ] **Step 5: 写获取小说详情测试**

```python
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
```

- [ ] **Step 6: 运行测试验证**

```bash
pytest tests/api/test_novels.py::test_get_novel -v
```

Expected: PASS

- [ ] **Step 7: 写更新小说测试**

```python
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
```

- [ ] **Step 8: 运行测试验证**

```bash
pytest tests/api/test_novels.py::test_update_novel -v
```

Expected: PASS

- [ ] **Step 9: 写删除小说测试**

```python
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
```

- [ ] **Step 10: 运行所有 API 测试验证**

```bash
pytest tests/api/test_novels.py -v
```

Expected: 全部 PASS

- [ ] **Step 11: 提交**

```bash
git add tests/api/test_novels.py
git commit -m "test: 添加小说 API CRUD 测试"
```

### Task 6: 章节 API 测试

**Files:**
- Create: `tests/api/test_chapters.py`

- [ ] **Step 1: 写章节 CRUD 测试**

```python
# tests/api/test_chapters.py
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
```

- [ ] **Step 2: 运行测试验证**

```bash
pytest tests/api/test_chapters.py -v
```

Expected: 全部 PASS

- [ ] **Step 3: 提交**

```bash
git add tests/api/test_chapters.py
git commit -m "test: 添加章节 API 测试"
```

### Task 7: 角色和健康检查 API 测试

**Files:**
- Create: `tests/api/test_characters.py`
- Create: `tests/api/test_health.py`

- [ ] **Step 1: 创建角色测试**

```python
# tests/api/test_characters.py
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
```

- [ ] **Step 2: 创建健康检查测试**

```python
# tests/api/test_health.py
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
    response = client.get("/", headers={"Origin": "http://localhost:3000"})

    assert response.status_code == 200
    # CORS 预检请求需要 OPTIONS
    options_response = client.options(
        "/api/novels",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET"
        }
    )
    assert options_response.status_code == 200
```

- [ ] **Step 3: 运行所有 API 测试**

```bash
pytest tests/api/ -v
```

Expected: 全部 PASS

- [ ] **Step 4: 提交**

```bash
git add tests/api/test_characters.py tests/api/test_health.py
git commit -m "test: 添加角色和健康检查 API 测试"
```

---

## Chunk 3: 前后端端到端测试

### Task 8: 创建前端 API 客户端测试

**Files:**
- Create: `kanban/src/lib/__tests__/api.test.ts`

- [ ] **Step 1: 创建 Vitest 配置**

```typescript
// kanban/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
});
```

- [ ] **Step 2: 创建 API 测试**

```typescript
// kanban/src/lib/__tests__/api.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { novelApi, chapterApi, characterApi } from '../api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

describe('Novel API', () => {
  let createdId: string;

  it('应该能够创建小说', async () => {
    const data = {
      title: '测试小说 E2E',
      genre: 'xuanhuan',
      theme: '修仙',
      targetChapters: 100,
    };

    const result = await novelApi.create(data);
    expect(result.title).toBe(data.title);
    expect(result.workflowStatus).toBe('outline');
    createdId = result.id;
  });

  it('应该能够获取小说列表', async () => {
    const result = await novelApi.list();
    expect(result.novels).toBeInstanceOf(Array);
    expect(result.total).toBeGreaterThan(0);
  });

  it('应该能够获取小说详情', async () => {
    const result = await novelApi.get(createdId);
    expect(result.id).toBe(createdId);
    expect(result.chapters).toBeInstanceOf(Array);
    expect(result.characters).toBeInstanceOf(Array);
  });

  it('应该能够更新小说', async () => {
    const result = await novelApi.update(createdId, {
      workflowStatus: 'writing',
    });
    expect(result.workflowStatus).toBe('writing');
  });

  afterAll(async () => {
    // 清理测试数据
    await novelApi.delete(createdId);
  });
});

describe('Chapter API', () => {
  const novelId = 'test-novel-id';
  let chapterId: string;

  it('应该能够创建章节', async () => {
    const data = {
      number: 1,
      title: '第一章',
      content: '章节内容',
    };

    const result = await chapterApi.create(novelId, data);
    chapterId = result.id;
    expect(result.title).toBe(data.title);
  });

  it('应该能够获取章节列表', async () => {
    const result = await chapterApi.list(novelId);
    expect(result).toBeInstanceOf(Array);
  });
});

describe('Character API', () => {
  const novelId = 'test-novel-id';

  it('应该能够创建角色', async () => {
    const data = {
      name: '主角',
      role: 'protagonist' as const,
      description: '测试角色',
      traits: ['勇敢'],
    };

    const result = await characterApi.create(novelId, data);
    expect(result.name).toBe(data.name);
    expect(result.role).toBe(data.role);
  });

  it('应该能够获取角色列表', async () => {
    const result = await characterApi.list(novelId);
    expect(result).toBeInstanceOf(Array);
  });
});
```

- [ ] **Step 3: 添加测试脚本到 package.json**

```json
// kanban/package.json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Step 4: 安装测试依赖**

```bash
cd kanban
npm install -D vitest @vitest/ui
```

- [ ] **Step 5: 运行测试（需要后端运行）**

```bash
# 终端1: 启动后端
python run_api.py

# 终端2: 运行前端测试
cd kanban
npm run test:run
```

Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add kanban/vitest.config.ts kanban/src/lib/__tests__/ kanban/package.json
git commit -m "test: 添加前端 API 客户端测试"
```

### Task 9: 创建手动验证脚本

**Files:**
- Create: `scripts/verify_connections.py`

- [ ] **Step 1: 创建验证脚本**

```python
#!/usr/bin/env python3
"""连接验证脚本

验证 Ollama 和 API 服务的连接状态。
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from auto_novel.models.ollama_client import OllamaClient
from auto_novel.api.app import app
from fastapi.testclient import TestClient


console = Console()


async def check_ollama():
    """检查 Ollama 连接"""
    with console.status("[bold cyan]检查 Ollama 服务...[/bold cyan]"):
        client = OllamaClient()
        is_healthy = await client.check_health()

    if is_healthy:
        console.print("[green]✓[/green] Ollama 服务正常")
        return True
    else:
        console.print("[red]✗[/red] Ollama 服务不可用")
        return False


def check_api():
    """检查 API 服务"""
    with console.status("[bold cyan]检查 API 服务...[/bold cyan]"):
        client = TestClient(app)
        response = client.get("/health")

    if response.status_code == 200:
        console.print("[green]✓[/green] API 服务正常")
        return True
    else:
        console.print("[red]✗[/red] API 服务异常")
        return False


def check_api_crud():
    """检查 API CRUD 功能"""
    client = TestClient(app)

    # 创建测试小说
    payload = {
        "title": "连接测试",
        "genre": "xuanhuan",
        "theme": "修仙"
    }

    with console.status("[bold cyan]测试 API CRUD...[/bold cyan]"):
        # 创建
        resp = client.post("/api/novels", json=payload)
        if resp.status_code != 201:
            console.print("[red]✗[/red] 创建失败")
            return False
        novel_id = resp.json()["id"]

        # 读取
        resp = client.get(f"/api/novels/{novel_id}")
        if resp.status_code != 200:
            console.print("[red]✗[/red] 读取失败")
            return False

        # 更新
        resp = client.patch(f"/api/novels/{novel_id}", json={"title": "已更新"})
        if resp.status_code != 200:
            console.print("[red]✗[/red] 更新失败")
            return False

        # 删除
        resp = client.delete(f"/api/novels/{novel_id}")
        if resp.status_code != 204:
            console.print("[red]✗[/red] 删除失败")
            return False

    console.print("[green]✓[/green] API CRUD 正常")
    return True


async def main():
    """主函数"""
    console.print(Panel.fit("[bold]连接验证[/bold]", padding=(1, 2)))

    results = {
        "Ollama": await check_ollama(),
        "API 服务": check_api(),
        "API CRUD": check_api_crud(),
    }

    # 汇总表格
    table = Table(title="\n验证结果汇总")
    table.add_column("服务", style="cyan")
    table.add_column("状态", justify="center")

    all_passed = True
    for name, passed in results.items():
        status = "[green]通过[/green]" if passed else "[red]失败[/red]"
        table.add_row(name, status)
        if not passed:
            all_passed = False

    console.print(table)

    if all_passed:
        console.print("\n[green bold]所有检查通过！[/green bold]")
        return 0
    else:
        console.print("\n[yellow]部分检查失败，请查看上面的详细信息。[/yellow]")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
```

- [ ] **Step 2: 创建脚本目录并添加执行权限**

```bash
mkdir -p scripts
chmod +x scripts/verify_connections.py
```

- [ ] **Step 3: 运行验证脚本**

```bash
python scripts/verify_connections.py
```

Expected: 显示所有服务的连接状态

- [ ] **Step 4: 提交**

```bash
git add scripts/
git commit -m "test: 添加连接验证脚本"
```

### Task 10: 更新文档

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: 添加测试相关文档**

在 CLAUDE.md 中添加：

```markdown
## 测试

### 运行测试

```bash
# 运行所有单元测试
pytest tests/ -v

# 运行 API 测试
pytest tests/api/ -v

# 运行集成测试（需要 Ollama 运行）
OLLAMA_TEST_ENABLED=true pytest tests/integration/ -v

# 排除集成测试
pytest tests/ -v -m "not integration"

# 前端测试（需要后端运行）
cd kanban
npm run test
```

### 连接验证

```bash
# 快速验证所有服务连接
python scripts/verify_connections.py

# 单独检查 Ollama
python main.py check
```

### 测试结构

```
tests/
├── __init__.py
├── conftest.py           # 共享 fixtures
├── test_ollama_client.py # Ollama 客户端单元测试
├── test_prompts.py       # 提示词测试
├── test_novel_manager.py # 小说管理器测试
├── api/                  # API 集成测试
│   ├── conftest.py       # API fixtures
│   ├── test_novels.py    # 小说 API 测试
│   ├── test_chapters.py  # 章节 API 测试
│   ├── test_characters.py # 角色 API 测试
│   └── test_health.py    # 健康检查测试
└── integration/          # 外部服务集成测试
    └── test_ollama_integration.py
```
```

- [ ] **Step 2: 提交文档更新**

```bash
git add CLAUDE.md
git commit -m "docs: 添加测试文档"
```

---

## 附录：运行所有测试

在完成所有任务后，运行以下命令验证：

```bash
# 后端单元测试
pytest tests/ -v -m "not integration"

# 后端集成测试（需要 Ollama）
OLLAMA_TEST_ENABLED=true pytest tests/integration/ -v

# API 测试
pytest tests/api/ -v

# 前端测试（需要后端运行）
cd kanban && npm run test:run

# 完整验证脚本
python scripts/verify_connections.py
```
