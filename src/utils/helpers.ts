export const nowIso = () => new Date().toISOString();
export const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));
