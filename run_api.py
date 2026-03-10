#!/usr/bin/env python3
"""启动 API 服务器"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "auto_novel.api.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
