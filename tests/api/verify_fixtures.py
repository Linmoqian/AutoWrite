"""独立验证脚本 - 验证 API 测试 fixture 逻辑

此脚本不依赖 pytest，用于验证 fixture 逻辑的正确性。
"""

import shutil
import tempfile
from pathlib import Path

# 模拟 storage 模块
class MockStorage:
    DATA_DIR = Path("data/novels")


def temp_data_dir_logic():
    """模拟 temp_data_dir fixture 逻辑"""
    temp_dir = tempfile.mkdtemp()
    original_path = MockStorage.DATA_DIR

    # 临时替换数据目录
    MockStorage.DATA_DIR = Path(temp_dir)
    MockStorage.DATA_DIR.mkdir(parents=True, exist_ok=True)

    return temp_dir, original_path


def cleanup_temp_dir(temp_dir, original_path):
    """模拟 fixture 清理逻辑"""
    shutil.rmtree(temp_dir, ignore_errors=True)
    MockStorage.DATA_DIR = original_path


def test_temp_data_dir_isolation():
    """验证临时目录隔离效果"""
    print("测试 1: 验证临时目录与原始目录隔离")

    original = MockStorage.DATA_DIR
    temp_dir, _ = temp_data_dir_logic()

    # 验证临时目录不是原始目录
    assert str(temp_dir) != str(original), "临时目录应该与原始目录不同"
    assert Path(temp_dir).exists(), "临时目录应该存在"

    # 清理
    cleanup_temp_dir(temp_dir, original)

    # 验证已清理
    assert not Path(temp_dir).exists(), "临时目录应该已清理"

    print(f"  原始目录: {original}")
    print(f"  临时目录: {temp_dir}")
    print(f"  隔离验证: 通过")


def test_multiple_temp_dirs():
    """验证多次调用创建不同的临时目录"""
    print("测试 2: 验证多次调用创建不同临时目录")

    temp_dirs = []
    original = MockStorage.DATA_DIR

    for i in range(3):
        temp_dir, _ = temp_data_dir_logic()
        temp_dirs.append(temp_dir)
        print(f"  创建临时目录 {i+1}: {temp_dir}")

    # 验证所有目录都不相同
    assert len(set(temp_dirs)) == 3, "每次应创建不同的临时目录"

    # 清理所有
    for temp_dir in temp_dirs:
        cleanup_temp_dir(temp_dir, original)

    print(f"  唯一性验证: 通过")


def test_data_dir_restoration():
    """验证原始 DATA_DIR 被正确恢复"""
    print("测试 3: 验证原始 DATA_DIR 恢复")

    original = MockStorage.DATA_DIR

    # 创建并清理
    temp_dir, _ = temp_data_dir_logic()
    cleanup_temp_dir(temp_dir, original)

    # 验证恢复
    assert MockStorage.DATA_DIR == original, "DATA_DIR 应该恢复为原始值"

    print(f"  原始值: {original}")
    print(f"  恢复值: {MockStorage.DATA_DIR}")
    print(f"  恢复验证: 通过")


def main():
    """运行所有验证"""
    print("=" * 50)
    print("API 测试 Fixture 逻辑验证")
    print("=" * 50)

    test_temp_data_dir_isolation()
    print()
    test_multiple_temp_dirs()
    print()
    test_data_dir_restoration()
    print()
    print("=" * 50)
    print("所有验证通过!")
    print("=" * 50)


if __name__ == "__main__":
    main()
