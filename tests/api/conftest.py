"""API 测试 fixtures"""

import pytest
import shutil
import tempfile
from pathlib import Path

from auto_novel.api.app import app
from auto_novel.api import storage


@pytest.fixture
def temp_data_dir():
    """创建临时数据目录，确保测试隔离不污染 data/ 目录"""
    temp_dir = tempfile.mkdtemp()
    original_path = storage.DATA_DIR

    # 临时替换数据目录
    storage.DATA_DIR = Path(temp_dir)
    storage.DATA_DIR.mkdir(parents=True, exist_ok=True)

    yield temp_dir

    # 清理临时目录
    shutil.rmtree(temp_dir, ignore_errors=True)
    # 恢复原始数据目录
    storage.DATA_DIR = original_path


@pytest.fixture
def client(temp_data_dir):
    """创建 FastAPI 测试客户端

    依赖 temp_data_dir fixture，确保每个测试使用独立的临时数据目录。
    """
    from fastapi.testclient import TestClient

    return TestClient(app)
