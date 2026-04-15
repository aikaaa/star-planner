/**
 * SOC 导出/导入格式
 * 格式：[SOC]<base64(JSON)>
 * JSON 结构：{ v: 2, s: "cn", p: PlanExport[] }
 *
 * 编码策略：UTF-8 bytes → btoa（比 encodeURIComponent+btoa 节省约 3x 空间）
 * 导出时省略 id（由导入方重新生成），并使用短字段名压缩体积。
 */

import { CharacterPlan } from "@/lib/types";
import { supabase } from "@/lib/supabase";

const PREFIX = "[SOC]";
const REF_PREFIX = "[SOC]ref:";
// 超过此长度改用 Supabase 短链，避免 QR 模块过密无法识别
const DIRECT_MAX_LEN = 150;

export interface SocData {
  server: string;
  plans: CharacterPlan[];
}

// ── 短字段名格式（v2），减少 QR 码体积 ───────────────────────────
interface PlanCompact {
  n:  string;           // name
  fm: string;           // farmingMode
  cs: number;           // currentStar
  ts: number;           // targetStar
  ch: number;           // currentShards
  bs?: number;          // bonusShards
  sd: string;           // startDate
  ed?: string;          // endDate
  ic?: string;          // icon
}

// ── UTF-8 安全 base64（比 encodeURIComponent+btoa 节省 ~3x） ────
function toB64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function fromB64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ── 编码 ─────────────────────────────────────────────────────────
export function encodeSoc(plans: CharacterPlan[], server = "cn"): string {
  const p: PlanCompact[] = plans.map(pl => {
    const c: PlanCompact = {
      n:  pl.name,
      fm: pl.farmingMode,
      cs: pl.currentStar,
      ts: pl.targetStar,
      ch: pl.currentShards,
      sd: pl.startDate,
    };
    if (pl.bonusShards) c.bs = pl.bonusShards;
    if (pl.endDate)     c.ed = pl.endDate;
    if (pl.icon)        c.ic = pl.icon;
    return c;
  });
  const json = JSON.stringify({ v: 2, s: server, p });
  return `${PREFIX}${toB64(json)}`;
}

// ── 解码（兼容 v1 旧格式；ref: 需先由调用方 resolve） ─────────────
export function decodeSoc(text: string): SocData | null {
  try {
    const trimmed = text.trim();
    const idx = trimmed.indexOf(PREFIX);
    if (idx === -1) return null;
    const b64 = trimmed.slice(idx + PREFIX.length).trim();

    // 先尝试新格式（UTF-8 base64），再降级到旧格式（encodeURIComponent+btoa）
    let json: string;
    try {
      json = fromB64(b64);
    } catch {
      json = decodeURIComponent(atob(b64));
    }

    const raw = JSON.parse(json);

    let plans: CharacterPlan[];

    if (raw.v === 2) {
      // v2：短字段名
      if (!Array.isArray(raw.p)) return null;
      plans = (raw.p as PlanCompact[]).map(c => ({
        id:           crypto.randomUUID(),
        name:         c.n,
        farmingMode:  c.fm as "star" | "free",
        currentStar:  c.cs,
        targetStar:   c.ts,
        currentShards: c.ch,
        bonusShards:  c.bs,
        startDate:    c.sd,
        endDate:      c.ed,
        icon:         c.ic,
      }));
    } else {
      // v1：完整字段名（旧格式兼容）
      if (!Array.isArray(raw.plans)) return null;
      plans = (raw.plans as Partial<CharacterPlan>[]).map(p => ({
        ...p,
        id: p.id ?? crypto.randomUUID(),
      } as CharacterPlan));
    }

    return { server: raw.s ?? raw.server ?? "cn", plans };
  } catch {
    return null;
  }
}

// ── 生成 8 位短 ID ────────────────────────────────────────────────
function generateShortId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ── 上传到 Supabase，返回短 ID ────────────────────────────────────
export async function uploadSocRef(socStr: string): Promise<string> {
  if (!supabase) throw new Error("Supabase 未配置");
  const id = generateShortId();
  const { error } = await supabase.from("shared_plans").insert({ id, data: socStr });
  if (error) throw error;
  return id;
}

// ── 从 Supabase 拉取数据 ──────────────────────────────────────────
export async function downloadSocRef(id: string): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("shared_plans")
    .select("data")
    .eq("id", id)
    .single();
  if (error || !data) return null;
  return data.data as string;
}

// ── 决定用直接编码还是 Supabase 短链 ─────────────────────────────
export async function encodeSocForQr(plans: CharacterPlan[]): Promise<string> {
  const socStr = encodeSoc(plans);
  if (socStr.length <= DIRECT_MAX_LEN) return socStr;
  const id = await uploadSocRef(socStr);
  return `${REF_PREFIX}${id}`;
}

// ── 从图片识别二维码 ──────────────────────────────────────────────
export async function readQrFromImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width  = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      import("jsqr").then(({ default: jsQR }) => {
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        URL.revokeObjectURL(url);
        resolve(result?.data ?? null);
      }).catch(() => resolve(null));
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
