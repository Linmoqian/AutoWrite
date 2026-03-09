"""番茄小说发布器测试模块"""

import pytest

from auto_novel.publisher import BrowserManager, FanqiePublisher
from auto_novel.publisher.fanqie_publisher import BookInfo, Chapter


class TestBrowserManager:
    """浏览器管理器测试"""

    def test_init_default_headless(self):
        """测试默认无头模式为 False"""
        manager = BrowserManager()
        assert manager.headless is False

    def test_init_headless_true(self):
        """测试设置无头模式为 True"""
        manager = BrowserManager(headless=True)
        assert manager.headless is True

    def test_page_raises_when_not_started(self):
        """测试未启动时访问 page 属性抛出异常"""
        manager = BrowserManager()
        with pytest.raises(RuntimeError, match="浏览器未启动"):
            _ = manager.page

    def test_is_running_false_initially(self):
        """测试初始状态未运行"""
        manager = BrowserManager()
        assert manager.is_running is False


class TestFanqiePublisher:
    """番茄小说发布器测试"""

    def test_base_url(self):
        """测试 BASE_URL 正确"""
        assert FanqiePublisher.BASE_URL == "https://fanqienovel.com"

    def test_login_url(self):
        """测试登录 URL 正确"""
        assert FanqiePublisher.LOGIN_URL == "https://fanqienovel.com/login"

    def test_works_url(self):
        """测试作品管理 URL 正确"""
        assert FanqiePublisher.WORKS_URL == "https://fanqienovel.com/works"

    def test_init_default_values(self):
        """测试默认初始化值"""
        publisher = FanqiePublisher()
        assert publisher._browser_manager is not None
        assert publisher._logged_in is False

    def test_init_with_custom_cookie_path(self):
        """测试自定义 cookie 路径"""
        custom_path = "custom/cookies.json"
        publisher = FanqiePublisher(cookie_path=custom_path)
        assert publisher._cookie_path == custom_path

    def test_init_headless_mode(self):
        """测试无头模式初始化"""
        publisher = FanqiePublisher(headless=True)
        assert publisher._browser_manager.headless is True

    def test_is_logged_in_initially_false(self):
        """测试初始登录状态为 False"""
        publisher = FanqiePublisher()
        assert publisher.is_logged_in is False


class TestBookInfo:
    """书籍信息数据类测试"""

    def test_book_info_creation(self):
        """测试创建书籍信息"""
        book = BookInfo(
            book_id="123456",
            title="测试小说",
            genre="玄幻",
            intro="这是一本测试小说"
        )
        assert book.book_id == "123456"
        assert book.title == "测试小说"
        assert book.genre == "玄幻"
        assert book.intro == "这是一本测试小说"

    def test_book_info_default_values(self):
        """测试书籍信息默认值"""
        book = BookInfo(
            book_id="1",
            title="Test",
            genre="Test",
            intro="Test"
        )
        assert book.chapter_count == 0
        assert book.word_count == 0


class TestChapter:
    """章节数据类测试"""

    def test_chapter_creation(self):
        """测试创建章节"""
        chapter = Chapter(
            title="第一章",
            content="章节内容..."
        )
        assert chapter.title == "第一章"
        assert chapter.content == "章节内容..."
        assert chapter.chapter_id is None

    def test_chapter_with_id(self):
        """测试带 ID 的章节"""
        chapter = Chapter(
            title="第一章",
            content="内容",
            chapter_id="ch001"
        )
        assert chapter.chapter_id == "ch001"


class TestPublisherIntegration:
    """发布器集成测试（不实际启动浏览器）"""

    def test_publisher_has_required_methods(self):
        """测试发布器具有必需的方法"""
        publisher = FanqiePublisher()
        assert hasattr(publisher, 'start')
        assert hasattr(publisher, 'close')
        assert hasattr(publisher, 'login')
        assert hasattr(publisher, 'create_book')
        assert hasattr(publisher, 'publish_chapter')
        assert hasattr(publisher, 'get_book_info')

    def test_publisher_methods_are_coroutines(self):
        """测试发布器方法都是协程"""
        publisher = FanqiePublisher()
        import asyncio
        assert asyncio.iscoroutinefunction(publisher.start)
        assert asyncio.iscoroutinefunction(publisher.close)
        assert asyncio.iscoroutinefunction(publisher.login)
        assert asyncio.iscoroutinefunction(publisher.create_book)
        assert asyncio.iscoroutinefunction(publisher.publish_chapter)
        assert asyncio.iscoroutinefunction(publisher.get_book_info)

    def test_context_manager_protocol(self):
        """测试上下文管理器协议"""
        publisher = FanqiePublisher()
        assert hasattr(publisher, '__aenter__')
        assert hasattr(publisher, '__aexit__')
        import asyncio
        assert asyncio.iscoroutinefunction(publisher.__aenter__)
        assert asyncio.iscoroutinefunction(publisher.__aexit__)
