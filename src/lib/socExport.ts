/**
 * SOC 导出/导入格式
 * 格式：[SOC]<base64(JSON)>
 * JSON 结构：{ server: "cn", plans: CharacterPlan[] }
 */

import { CharacterPlan } from "@/lib/types";

const PREFIX = "[SOC]";

export interface SocData {
  server: string;
  plans: CharacterPlan[];
}

/** 将跑片计划编码为 SOC 字符串 */
export function encodeSoc(plans: CharacterPlan[], server = "cn"): string {
  const data: SocData = { server, plans };
  const json = JSON.stringify(data);
  const base64 = btoa(encodeURIComponent(json));
  return `${PREFIX}${base64}`;
}

/** 从 SOC 字符串解码跑片计划，失败返回 null */
export function decodeSoc(text: string): SocData | null {
  try {
    const trimmed = text.trim();
    const idx = trimmed.indexOf(PREFIX);
    if (idx === -1) return null;
    const base64 = trimmed.slice(idx + PREFIX.length).trim();
    const json = decodeURIComponent(atob(base64));
    const data = JSON.parse(json) as SocData;
    if (!Array.isArray(data.plans)) return null;
    return data;
  } catch {
    return null;
  }
}

/** 从图片文件中识别二维码，返回 SOC 字符串 */
export async function readQrFromImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
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
