#!/usr/bin/env node
/**
 * 从 biligame wiki 自动抓取传说角色，更新 src/lib/roles.ts 和 public/avatars/
 *
 * 策略：
 *   - 精确匹配已有角色 → 跳过
 *   - wiki 名含 "·" 或在 SP_ALIAS 里 → 视为 SP 角色，只写日志，不自动添加
 *   - 全新普通角色 → 自动获取英文名、下载头像、插入 roles.ts 最前面
 *
 * 运行：node scripts/scrape-characters.mjs
 */

import { load } from "cheerio";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ROLES_FILE = join(ROOT, "src/lib/roles.ts");
const AVATARS_DIR = join(ROOT, "public/avatars");
const LOG_FILE = join(__dirname, "character-diff.log");

const WIKI_BASE = "https://wiki.biligame.com/llzj";
const WIKI_API = `${WIKI_BASE}/api.php`;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// wiki 全称 → roles.ts 中的名称（SP 角色或名称不一致的角色）
const SP_ALIAS = {
  "全装甲麦莎": "SP麦莎",
};

// wiki 名称 → roles.ts 中对应名称（同一角色在 wiki 和游戏内名称不同）
const NAME_ALIAS = {
  "内尔伽勒": "内尔伽勃",
};

// ── 工具函数 ────────────────────────────────────────────────

async function wikiGet(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res;
}

/** 获取评价表渲染后的 HTML */
async function fetchEvalPage() {
  const url = `${WIKI_BASE}/${encodeURIComponent("角色评价表")}`;
  const res = await wikiGet(url);
  return res.text();
}

/** 从角色详情页提取英文名 */
async function fetchEnName(zhName) {
  const url = `${WIKI_BASE}/${encodeURIComponent("角色图鉴库")}/${encodeURIComponent(zhName)}`;
  try {
    const res = await wikiGet(url);
    const html = await res.text();
    const $ = load(html);
    const title = $("h1.firstHeading, h1").first().text().trim();
    // 标题格式："索菲亚 Safiyyah" —— 取末尾英文部分
    const match = title.match(/([A-Za-z][A-Za-z0-9'\-\s]*)$/);
    if (!match) return "";
    return match[1].trim().replace(/\s+/g, "_");
  } catch {
    return "";
  }
}

/** 下载并 resize 头像到 64×64 */
async function downloadAvatar(imgUrl, enName) {
  const dest = join(AVATARS_DIR, `${enName}.png`);
  if (existsSync(dest)) return "already_exists";
  try {
    // wiki 缩略图 URL 可能是相对路径，补全
    const fullUrl = imgUrl.startsWith("http") ? imgUrl : `https://wiki.biligame.com${imgUrl}`;
    const res = await wikiGet(fullUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    await sharp(buf)
      .resize(64, 64, { fit: "cover", position: "top" })
      .png()
      .toFile(dest);
    return "downloaded";
  } catch (e) {
    return `failed: ${e.message}`;
  }
}

/** 从 roles.ts 提取现有角色 zh 名集合 */
function getExistingZhNames() {
  const content = readFileSync(ROLES_FILE, "utf-8");
  const matches = [...content.matchAll(/zh:\s*"([^"]+)"/g)];
  return new Set(matches.map((m) => m[1]));
}

/** 在 roles.ts ROLES 数组最前面插入新角色行 */
function prependRoles(entries) {
  const content = readFileSync(ROLES_FILE, "utf-8");
  const anchor = "// ── 最新角色（往这里加） ───────────────────────────────────";
  if (!content.includes(anchor)) throw new Error("找不到插入锚点");
  const lines = entries
    .map(({ zh, en }) => `  { zh: "${zh}",${" ".repeat(Math.max(1, 11 - zh.length))}en: "${en}" },`)
    .join("\n");
  writeFileSync(ROLES_FILE, content.replace(anchor, `${anchor}\n${lines}`), "utf-8");
}

// ── 主流程 ───────────────────────────────────────────────────

async function main() {
  if (!existsSync(AVATARS_DIR)) mkdirSync(AVATARS_DIR, { recursive: true });

  const logs = [];
  const log = (...args) => { const msg = args.join(" "); console.log(msg); logs.push(msg); };

  log(`\n${"=".repeat(50)}`);
  log(`角色爬取运行时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
  log("=".repeat(50));

  // 1. 获取并解析评价表
  log("\n[1/4] 抓取 wiki 评价表...");
  const html = await fetchEvalPage();
  const $ = load(html);

  const wikiChars = [];
  // data-param 或 data-param1 都可能含"传说"
  $('tr[data-param1="传说"]').each((_, el) => {
    // 第2个td是角色名（第1个是头像）
    const tds = $(el).find("td");
    const nameTd = tds.eq(1);
    const zh = nameTd.text().trim();
    const imgSrc = tds.eq(0).find("img").first().attr("src") || "";
    if (zh) wikiChars.push({ zh, imgSrc });
  });

  log(`  → 找到传说角色 ${wikiChars.length} 个`);

  // 2. 对比现有列表
  log("\n[2/4] 对比现有 roles.ts...");
  const existing = getExistingZhNames();

  const toAdd = [];      // 普通新角色
  const spWarnings = []; // SP 角色，需人工处理

  for (const char of wikiChars) {
    // wiki 与游戏内名称不一致的别名处理
    if (NAME_ALIAS[char.zh]) {
      char.zh = NAME_ALIAS[char.zh];
    }

    // SP 角色判断：名称含"·"或"•"（wiki 使用 bullet U+2022）或在 SP_ALIAS 表里
    const isSP = char.zh.includes("·") || char.zh.includes("•") || SP_ALIAS[char.zh];
    if (isSP) {
      const base = char.zh.split(/[·•]/)[0];
      const mapped = SP_ALIAS[char.zh] || `SP${base}`;
      if (!existing.has(mapped)) {
        spWarnings.push({ wikiName: char.zh, suggestedName: mapped, imgSrc: char.imgSrc });
      }
      continue;
    }

    if (!existing.has(char.zh)) {
      toAdd.push(char);
    }
  }

  log(`  → 普通新角色: ${toAdd.length} 个`);
  log(`  → SP 待确认:  ${spWarnings.length} 个`);

  // 3. 处理新角色
  log("\n[3/4] 处理新角色...");
  const addedEntries = [];

  for (const char of toAdd) {
    log(`\n  ▸ ${char.zh}`);

    const en = await fetchEnName(char.zh);
    log(`    英文名: ${en || "（未找到）"}`);

    let avatarStatus = "skipped";
    if (en && char.imgSrc) {
      avatarStatus = await downloadAvatar(char.imgSrc, en);
    }
    log(`    头像:   ${avatarStatus}`);

    addedEntries.push({ zh: char.zh, en: en || "" });
    // 避免请求过快
    await new Promise((r) => setTimeout(r, 800));
  }

  // 4. 写入 roles.ts
  log("\n[4/4] 更新文件...");
  if (addedEntries.length > 0) {
    prependRoles(addedEntries);
    log(`  → roles.ts 已新增 ${addedEntries.length} 个角色`);
  } else {
    log("  → 无新角色，roles.ts 未改动");
  }

  // SP 警告
  if (spWarnings.length > 0) {
    log("\n⚠️  以下 SP 角色需手动确认（未自动添加）：");
    for (const w of spWarnings) {
      log(`   wiki: "${w.wikiName}"  →  建议名: "${w.suggestedName}"`);
    }
  }

  // 写日志
  writeFileSync(LOG_FILE, logs.join("\n") + "\n", "utf-8");
  log(`\n日志已写入: ${LOG_FILE}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
