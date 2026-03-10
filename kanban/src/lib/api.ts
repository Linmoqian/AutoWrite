/**
 * 前端 API 客户端
 *
 * 封装与后端 FastAPI 的通信，提供小说、章节、角色的 CRUD 操作。
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

// =============================================================================
// 类型定义 - 与后端 schemas.py 保持一致
// =============================================================================

export type NovelStatus = 'todo' | 'writing' | 'reviewing' | 'published';

export type WorkflowStatus =
  | 'outline'
  | 'outline_review'
  | 'character_design'
  | 'writing'
  | 'ai_review'
  | 'human_finalization'
  | 'published';

export type ChapterStatus = 'draft' | 'reviewing' | 'finalized';

export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'minor';

export interface Novel {
  id: string;
  title: string;
  genre: string;
  theme: string;
  targetChapters: number;
  writtenChapters: number;
  status: NovelStatus;
  workflowStatus: WorkflowStatus;
  outline?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
}

export interface NovelDetail extends Novel {
  chapters: Chapter[];
  characters: Character[];
}

export interface Chapter {
  id: string;
  novelId: string;
  number: number;
  title: string;
  content: string;
  wordCount: number;
  status: ChapterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Character {
  id: string;
  novelId: string;
  name: string;
  role: CharacterRole;
  description: string;
  traits: string[];
}

// 请求类型
export interface NovelCreate {
  title: string;
  genre: string;
  theme: string;
  targetChapters?: number;
  description?: string;
}

export interface NovelUpdate {
  title?: string;
  genre?: string;
  theme?: string;
  targetChapters?: number;
  writtenChapters?: number;
  wordCount?: number;
  description?: string;
  status?: NovelStatus;
  workflowStatus?: WorkflowStatus;
  outline?: string;
}

export interface ChapterCreate {
  number: number;
  title: string;
  content?: string;
  status?: ChapterStatus;
}

export interface ChapterUpdate {
  title?: string;
  content?: string;
  status?: ChapterStatus;
}

export interface CharacterCreate {
  name: string;
  role: CharacterRole;
  description?: string;
  traits?: string[];
}

export interface CharacterUpdate {
  name?: string;
  role?: CharacterRole;
  description?: string;
  traits?: string[];
}

// 响应类型
export interface NovelListResponse {
  novels: Novel[];
  total: number;
}

// =============================================================================
// 通用请求函数
// =============================================================================

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
}

async function request<T>(path: string, options?: RequestOptions): Promise<T> {
  const url = `${API_BASE}${path}`;

  const fetchOptions: RequestInit = {
    method: options?.method,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  };

  const res = await fetch(url, fetchOptions);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(error.detail || '请求失败');
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

// =============================================================================
// Novel API
// =============================================================================

export const novelApi = {
  /** 获取小说列表 */
  list: () => request<NovelListResponse>('/novels'),

  /** 获取小说详情 */
  get: (novelId: string) => request<NovelDetail>(`/novels/${novelId}`),

  /** 创建小说 */
  create: (data: NovelCreate) =>
    request<Novel>('/novels', {
      method: 'POST',
      body: data,
    }),

  /** 更新小说 */
  update: (novelId: string, data: NovelUpdate) =>
    request<Novel>(`/novels/${novelId}`, {
      method: 'PATCH',
      body: data,
    }),

  /** 删除小说 */
  delete: (novelId: string) =>
    request<void>(`/novels/${novelId}`, {
      method: 'DELETE',
    }),
};

// =============================================================================
// Chapter API
// =============================================================================

export const chapterApi = {
  /** 获取章节列表 */
  list: (novelId: string) =>
    request<Chapter[]>(`/novels/${novelId}/chapters`),

  /** 创建章节 */
  create: (novelId: string, data: ChapterCreate) =>
    request<Chapter>(`/novels/${novelId}/chapters`, {
      method: 'POST',
      body: data,
    }),

  /** 更新章节 */
  update: (novelId: string, chapterId: string, data: ChapterUpdate) =>
    request<Chapter>(`/novels/${novelId}/chapters/${chapterId}`, {
      method: 'PATCH',
      body: data,
    }),

  /** 删除章节 */
  delete: (novelId: string, chapterId: string) =>
    request<void>(`/novels/${novelId}/chapters/${chapterId}`, {
      method: 'DELETE',
    }),
};

// =============================================================================
// Character API
// =============================================================================

export const characterApi = {
  /** 获取角色列表 */
  list: (novelId: string) =>
    request<Character[]>(`/novels/${novelId}/characters`),

  /** 创建角色 */
  create: (novelId: string, data: CharacterCreate) =>
    request<Character>(`/novels/${novelId}/characters`, {
      method: 'POST',
      body: data,
    }),

  /** 更新角色 */
  update: (novelId: string, characterId: string, data: CharacterUpdate) =>
    request<Character>(`/novels/${novelId}/characters/${characterId}`, {
      method: 'PATCH',
      body: data,
    }),

  /** 删除角色 */
  delete: (novelId: string, characterId: string) =>
    request<void>(`/novels/${novelId}/characters/${characterId}`, {
      method: 'DELETE',
    }),
};

// 导出默认对象
export default {
  novel: novelApi,
  chapter: chapterApi,
  character: characterApi,
};
