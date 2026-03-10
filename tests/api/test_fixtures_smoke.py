"""API 测试框架冒烟测试

验证 fixture 和基本测试基础设施工作正常。
"""

# 注意: 此测试文件需要安装 fastapi 和 pytest 才能运行
# 使用环境安装依赖后运行: pytest tests/api/test_fixtures_smoke.py -v

import tempfile
import shutil
from pathlib import Path


def test_temp_data_dir_manual():
    """手动验证临时目录逻辑（不依赖 pytest）"""
    # 创建临时目录
    temp_dir = tempfile.mkdtemp()

    try:
        # 验证目录存在
        assert Path(temp_dir).exists()

        # 创建测试数据
        test_file = Path(temp_dir) / "test.txt"
        test_file.write_text("测试数据")

        # 验证文件可读写
        assert test_file.read_text() == "测试数据"

        print("临时目录读写测试通过")
    finally:
        # 清理
        shutil.rmtree(temp_dir, ignore_errors=True)
        # 验证已清理
        assert not Path(temp_dir).exists()


if __name__ == "__main__":
    test_temp_data_dir_manual()
