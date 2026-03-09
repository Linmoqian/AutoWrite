"""浏览器管理器模块"""

import asyncio
import json
from pathlib import Path
from typing import Optional

from playwright.async_api import async_playwright, Browser, Page, BrowserContext


class BrowserManager:
    """浏览器管理器，封装 Playwright 浏览器操作"""

    def __init__(self, headless: bool = False):
        """
        初始化浏览器管理器

        Args:
            headless: 是否使用无头模式
        """
        self.headless = headless
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None

    async def start(self) -> None:
        """启动浏览器"""
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=self.headless,
            args=['--disable-blink-features=AutomationControlled']
        )
        self._context = await self._browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        self._page = await self._context.new_page()

    async def close(self) -> None:
        """关闭浏览器"""
        if self._page:
            await self._page.close()
            self._page = None
        if self._context:
            await self._context.close()
            self._context = None
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

    @property
    def page(self) -> Page:
        """获取当前页面对象"""
        if self._page is None:
            raise RuntimeError("浏览器未启动，请先调用 start() 方法")
        return self._page

    @property
    def is_running(self) -> bool:
        """检查浏览器是否正在运行"""
        return self._browser is not None and self._browser.is_connected()

    async def save_cookies(self, filepath: str) -> None:
        """
        保存 cookies 到文件

        Args:
            filepath: cookies 保存路径
        """
        if self._context is None:
            raise RuntimeError("浏览器上下文不存在，请先调用 start() 方法")

        cookies = await self._context.cookies()
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, 'w', encoding='utf-8') as f:
            json.dump(cookies, f, ensure_ascii=False, indent=2)

    async def load_cookies(self, filepath: str) -> bool:
        """
        从文件加载 cookies

        Args:
            filepath: cookies 文件路径

        Returns:
            是否成功加载 cookies
        """
        if self._context is None:
            raise RuntimeError("浏览器上下文不存在，请先调用 start() 方法")

        path = Path(filepath)
        if not path.exists():
            return False

        with open(path, 'r', encoding='utf-8') as f:
            cookies = json.load(f)

        await self._context.add_cookies(cookies)
        return True

    async def navigate(self, url: str, wait_until: str = 'load') -> None:
        """
        导航到指定 URL

        Args:
            url: 目标 URL
            wait_until: 等待条件
        """
        await self.page.goto(url, wait_until=wait_until)

    async def screenshot(self, filepath: str) -> None:
        """
        截取当前页面截图

        Args:
            filepath: 截图保存路径
        """
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        await self.page.screenshot(path=str(path))

    async def wait_for_selector(self, selector: str, timeout: int = 30000) -> None:
        """
        等待选择器出现

        Args:
            selector: CSS 选择器
            timeout: 超时时间（毫秒）
        """
        await self.page.wait_for_selector(selector, timeout=timeout)

    async def __aenter__(self) -> 'BrowserManager':
        """异步上下文管理器入口"""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """异步上下文管理器出口"""
        await self.close()
