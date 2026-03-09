"""定时任务调度器"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from typing import Callable, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class TaskScheduler:
    """任务调度器

    支持:
    - 定时任务 (每天固定时间执行)
    - 间隔任务 (每隔固定时间执行)
    """

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.jobs: Dict[str, str] = {}

    def start(self):
        """启动调度器"""
        self.scheduler.start()
        logger.info("调度器已启动")

    def stop(self):
        """停止调度器"""
        self.scheduler.shutdown()
        logger.info("调度器已停止")

    def add_chapter_job(
        self,
        job_id: str,
        func: Callable,
        hour: int = 10,
        minute: int = 0
    ):
        """添加每日章节发布任务

        Args:
            job_id: 任务ID
            func: 要执行的函数
            hour: 小时 (0-23)
            minute: 分钟 (0-59)
        """
        trigger = CronTrigger(hour=hour, minute=minute)
        self.scheduler.add_job(
            func,
            trigger=trigger,
            id=job_id,
            replace_existing=True
        )
        self.jobs[job_id] = f"每天 {hour:02d}:{minute:02d}"
        logger.info(f"已添加定时任务: {job_id} -> 每天 {hour:02d}:{minute:02d}")

    def add_interval_job(
        self,
        job_id: str,
        func: Callable,
        hours: int = 12
    ):
        """添加间隔任务

        Args:
            job_id: 任务ID
            func: 要执行的函数
            hours: 间隔小时数
        """
        trigger = IntervalTrigger(hours=hours)
        self.scheduler.add_job(
            func,
            trigger=trigger,
            id=job_id,
            replace_existing=True
        )
        self.jobs[job_id] = f"每 {hours} 小时"
        logger.info(f"已添加间隔任务: {job_id} -> 每 {hours} 小时")

    def add_cron_job(
        self,
        job_id: str,
        func: Callable,
        cron_expression: str
    ):
        """添加 cron 表达式任务

        Args:
            job_id: 任务ID
            func: 要执行的函数
            cron_expression: cron 表达式 (如 "0 10 * * *" 表示每天10点)
        """
        trigger = CronTrigger.from_crontab(cron_expression)
        self.scheduler.add_job(
            func,
            trigger=trigger,
            id=job_id,
            replace_existing=True
        )
        self.jobs[job_id] = f"cron: {cron_expression}"
        logger.info(f"已添加 cron 任务: {job_id} -> {cron_expression}")

    def remove_job(self, job_id: str):
        """移除任务

        Args:
            job_id: 任务ID
        """
        self.scheduler.remove_job(job_id)
        if job_id in self.jobs:
            del self.jobs[job_id]
        logger.info(f"已移除任务: {job_id}")

    def pause_job(self, job_id: str):
        """暂停任务"""
        self.scheduler.pause_job(job_id)
        logger.info(f"已暂停任务: {job_id}")

    def resume_job(self, job_id: str):
        """恢复任务"""
        self.scheduler.resume_job(job_id)
        logger.info(f"已恢复任务: {job_id}")

    def list_jobs(self) -> Dict[str, str]:
        """列出所有任务

        Returns:
            任务ID到描述的映射
        """
        return self.jobs.copy()

    def get_next_run_time(self, job_id: str) -> Optional[str]:
        """获取任务下次运行时间

        Args:
            job_id: 任务ID

        Returns:
            下次运行时间字符串，如果任务不存在则返回 None
        """
        job = self.scheduler.get_job(job_id)
        if job and job.next_run_time:
            return job.next_run_time.strftime("%Y-%m-%d %H:%M:%S")
        return None
