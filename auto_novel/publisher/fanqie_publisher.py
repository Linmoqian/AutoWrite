"""番茄小说发布器模块"""

import asyncio
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .browser_manager import BrowserManager


@dataclass
class BookInfo:
    """书籍信息"""

    book_id: str
    title: str
    genre: str
    intro: str
    chapter_count: int = 0
    word_count: int = 0


@dataclass
class Chapter:
    """章节信息"""

    title: str
    content: str
    chapter_id: Optional[str] = None


class FanqiePublisher:
    """番茄小说发布器"""

    BASE_URL = "https://fanqienovel.com"
    LOGIN_URL = "https://fanqienovel.com/login"
    WORKS_URL = "https://fanqienovel.com/works"

    def __init__(self, headless: bool = False, cookie_path: Optional[str] = None):
        """
        初始化番茄小说发布器

        Args:
            headless: 是否使用无头模式
            cookie_path: cookies 保存路径
        """
        self._browser_manager = BrowserManager(headless=headless)
        self._cookie_path = cookie_path or "data/cookies/fanqie_cookies.json"
        self._logged_in = False

    async def start(self) -> None:
        """启动发布器"""
        await self._browser_manager.start()

        # 尝试加载已保存的 cookies
        cookie_file = Path(self._cookie_path)
        if cookie_file.exists():
            loaded = await self._browser_manager.load_cookies(self._cookie_path)
            if loaded:
                # 验证 cookies 是否有效
                await self._browser_manager.navigate(self.BASE_URL)
                # 简单检查是否已登录（检查页面元素）
                self._logged_in = await self._check_login_status()

    async def close(self) -> None:
        """关闭发布器"""
        await self._browser_manager.close()
        self._logged_in = False

    async def login(
        self,
        username: Optional[str] = None,
        password: Optional[str] = None,
        manual: bool = True
    ) -> bool:
        """
        登录番茄小说

        Args:
            username: 用户名（可选）
            password: 密码（可选）
            manual: 是否手动登录（扫码）

        Returns:
            是否登录成功
        """
        if self._logged_in:
            return True

        await self._browser_manager.navigate(self.LOGIN_URL)

        if manual:
            # 等待用户手动扫码登录
            # 检测登录成功的标志是跳转到主页或出现用户头像
            try:
                await self._browser_manager.wait_for_selector(
                    '.user-avatar, .user-info, [class*="avatar"]',
                    timeout=120000  # 2分钟超时
                )
                self._logged_in = True
            except Exception:
                self._logged_in = False
        else:
            # 自动登录（如果提供了用户名密码）
            # 注意：番茄小说主要通过扫码登录，账号密码登录可能不可用
            if username and password:
                try:
                    page = self._browser_manager.page
                    # 填写用户名密码（具体选择器需要根据实际页面调整）
                    await page.fill('input[type="text"], input[name="username"]', username)
                    await page.fill('input[type="password"], input[name="password"]', password)
                    await page.click('button[type="submit"], .login-btn')
                    await self._browser_manager.wait_for_selector(
                        '.user-avatar, .user-info',
                        timeout=30000
                    )
                    self._logged_in = True
                except Exception:
                    self._logged_in = False

        if self._logged_in:
            # 保存 cookies
            await self._browser_manager.save_cookies(self._cookie_path)

        return self._logged_in

    async def _check_login_status(self) -> bool:
        """检查登录状态"""
        try:
            page = self._browser_manager.page
            # 检查是否存在登录后才有的元素
            avatar = await page.query_selector('.user-avatar, [class*="avatar"], .user-info')
            return avatar is not None
        except Exception:
            return False

    async def create_book(
        self,
        title: str,
        genre: str,
        intro: str
    ) -> Optional[str]:
        """
        创建新书籍

        Args:
            title: 书名
            genre: 分类
            intro: 简介

        Returns:
            书籍 ID，失败返回 None
        """
        if not self._logged_in:
            raise RuntimeError("请先登录")

        await self._browser_manager.navigate(self.WORKS_URL)

        page = self._browser_manager.page

        try:
            # 点击创建新书按钮（具体选择器需要根据实际页面调整）
            await page.click('button:has-text("创建"), a:has-text("创建新书"), .create-book-btn')
            await asyncio.sleep(1)

            # 填写书名
            await page.fill('input[name="title"], input[placeholder*="书名"]', title)

            # 选择分类
            await page.click(f'.genre-selector:has-text("{genre}"), select:has(option:has-text("{genre}"))')

            # 填写简介
            await page.fill(
                'textarea[name="intro"], textarea[placeholder*="简介"]',
                intro
            )

            # 提交创建
            await page.click('button[type="submit"], button:has-text("确定"), button:has-text("创建")')

            # 等待创建成功，获取书籍 ID
            await asyncio.sleep(2)

            # 从 URL 或页面中获取书籍 ID
            current_url = page.url
            if '/book/' in current_url:
                book_id = current_url.split('/book/')[-1].split('/')[0].split('?')[0]
                return book_id

            return None

        except Exception as e:
            print(f"创建书籍失败: {e}")
            return None

    async def publish_chapter(
        self,
        book_id: str,
        chapter: Chapter,
        is_vip: bool = False
    ) -> bool:
        """
        发布章节

        Args:
            book_id: 书籍 ID
            chapter: 章节信息
            is_vip: 是否为 VIP 章节

        Returns:
            是否发布成功
        """
        if not self._logged_in:
            raise RuntimeError("请先登录")

        # 导航到书籍编辑页面
        edit_url = f"{self.WORKS_URL}/book/{book_id}/edit"
        await self._browser_manager.navigate(edit_url)

        page = self._browser_manager.page

        try:
            # 点击添加新章节
            await page.click('button:has-text("添加章节"), a:has-text("新建章节"), .add-chapter-btn')
            await asyncio.sleep(1)

            # 填写章节标题
            await page.fill(
                'input[name="chapter-title"], input[placeholder*="章节名"], input[placeholder*="标题"]',
                chapter.title
            )

            # 填写章节内容
            await page.fill(
                'textarea[name="content"], .chapter-editor, div[contenteditable="true"]',
                chapter.content
            )

            # 设置 VIP 章节
            if is_vip:
                vip_checkbox = await page.query_selector('input[type="checkbox"][name="vip"], .vip-toggle')
                if vip_checkbox:
                    await vip_checkbox.check()

            # 发布章节
            await page.click('button:has-text("发布"), button:has-text("保存"), button[type="submit"]')

            # 等待发布成功
            await asyncio.sleep(2)

            return True

        except Exception as e:
            print(f"发布章节失败: {e}")
            return False

    async def get_book_info(self, book_id: str) -> Optional[BookInfo]:
        """
        获取书籍信息

        Args:
            book_id: 书籍 ID

        Returns:
            书籍信息，失败返回 None
        """
        book_url = f"{self.BASE_URL}/book/{book_id}"
        await self._browser_manager.navigate(book_url)

        page = self._browser_manager.page

        try:
            # 提取书籍信息（具体选择器需要根据实际页面调整）
            title_elem = await page.query_selector('h1.book-title, .novel-title, h1')
            title = await title_elem.inner_text() if title_elem else ""

            intro_elem = await page.query_selector('.book-intro, .novel-intro, .summary')
            intro = await intro_elem.inner_text() if intro_elem else ""

            # 获取章节数和字数
            chapter_count = 0
            word_count = 0

            stats = await page.query_selector_all('.book-stats .stat, .info-item')
            for stat in stats:
                text = await stat.inner_text()
                if '章' in text:
                    chapter_count = int(''.join(filter(str.isdigit, text)) or 0)
                elif '字' in text:
                    word_count = int(''.join(filter(str.isdigit, text)) or 0)

            return BookInfo(
                book_id=book_id,
                title=title.strip(),
                genre="",  # 需要从分类元素获取
                intro=intro.strip(),
                chapter_count=chapter_count,
                word_count=word_count
            )

        except Exception as e:
            print(f"获取书籍信息失败: {e}")
            return None

    @property
    def is_logged_in(self) -> bool:
        """是否已登录"""
        return self._logged_in

    async def __aenter__(self) -> 'FanqiePublisher':
        """异步上下文管理器入口"""
        await self.start()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        """异步上下文管理器出口"""
        await self.close()
