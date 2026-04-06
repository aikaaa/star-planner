import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/** 兼容所有浏览器的 UUID 生成（polyfill crypto.randomUUID） */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // fallback: 手动生成 RFC4122 v4 UUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/** 匿名设备 ID，存入 localStorage 用于去重统计 */
export function getDeviceId(): string {
  const key = "star-planner-device-id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
