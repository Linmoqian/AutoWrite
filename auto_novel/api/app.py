"""FastAPI 应用入口"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import router

app = FastAPI(
    title="AI 小说自动化 API",
    description="小说创作管理 API",
    version="1.0.0",
)

# CORS 配置 - 允许前端访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3005"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    """健康检查"""
    return {"status": "ok", "message": "AI 小说 API 运行中"}


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "healthy"}
