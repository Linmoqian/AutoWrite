const BASE = '/api';

export const fetchNovels = () =>
  fetch(`${BASE}/novels`).then((r) => r.json());

export const fetchNovel = (idx: number) =>
  fetch(`${BASE}/novels/${idx}`).then((r) => r.json());

export const fetchChapters = (idx: number) =>
  fetch(`${BASE}/novels/${idx}/chapters`).then((r) => r.json());

export const writeNext = (idx: number, model?: string) =>
  fetch(`${BASE}/novels/${idx}/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(model ? { model } : {}),
  }).then((r) => r.json());

export const autoStart = (idx: number, model?: string) =>
  fetch(`${BASE}/novels/${idx}/auto-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(model ? { model } : {}),
  }).then((r) => r.json());

export const autoStop = (idx: number) =>
  fetch(`${BASE}/novels/${idx}/auto-stop`, { method: 'POST' }).then((r) =>
    r.json(),
  );

export const fetchStatus = () =>
  fetch(`${BASE}/status`).then((r) => r.json());

export const fetchOllamaStatus = () =>
  fetch(`${BASE}/ollama/status`).then((r) => r.json());

export const createNovel = (data: {
  title: string;
  genre: string;
  theme: string;
  target_chapters: number;
  words_per_chapter: number;
  model?: string;
}) =>
  fetch(`${BASE}/novels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then((r) => r.json());

export const fetchChapterContent = (idx: number, num: number) =>
  fetch(`${BASE}/novels/${idx}/chapters/${num}`).then((r) => r.json());

export const fetchGenres = () =>
  fetch(`${BASE}/genres`).then((r) => r.json());
