const BASE = '/api';

export const fetchNovels = () =>
  fetch(`${BASE}/novels`).then((r) => r.json());

export const fetchNovel = (idx: number) =>
  fetch(`${BASE}/novels/${idx}`).then((r) => r.json());

export const fetchChapters = (idx: number) =>
  fetch(`${BASE}/novels/${idx}/chapters`).then((r) => r.json());

export const writeNext = (idx: number) =>
  fetch(`${BASE}/novels/${idx}/write`, { method: 'POST' }).then((r) =>
    r.json(),
  );

export const autoStart = (idx: number) =>
  fetch(`${BASE}/novels/${idx}/auto-start`, { method: 'POST' }).then((r) =>
    r.json(),
  );

export const autoStop = (idx: number) =>
  fetch(`${BASE}/novels/${idx}/auto-stop`, { method: 'POST' }).then((r) =>
    r.json(),
  );

export const fetchStatus = () =>
  fetch(`${BASE}/status`).then((r) => r.json());
