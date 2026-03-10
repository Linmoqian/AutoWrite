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
