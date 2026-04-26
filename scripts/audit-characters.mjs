#!/usr/bin/env node
/**
 * 角色数据审计脚本（一次性使用）
 *
 * 功能：
 *   1. 从 wiki 抓取所有传说角色
 *   2. 逐一访问详情页获取英文名
 *   3. 与 roles.ts 对比，生成 audit-report.json + audit-report.txt
 *
 * 注意：会访问 wiki 详情页，每次间隔 1.5s，共约需 2-3 分钟
 * 运行：node scripts/audit-characters.mjs
 */

import { load } from "cheerio";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ROLES_FILE = join(ROOT, "src/lib/roles.ts");
const REPORT_JSON = join(__dirname, "audit-report.json");
const REPORT_TXT = join(__dirname, "audit-report.txt");
const CACHE_FILE = join(__dirname, "audit-cache.json"); // 中断后可续跑

const WIKI_BASE = "https://wiki.biligame.com/llzj";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DELAY_MS = 1500;

// wiki 名与 roles.ts 名的映射（wiki 用全称，我们用 SP 前缀）
const WIKI_TO_ROLES = {
  "阿列克谢•风雪孤行": "SP阿列克谢",
  "伦伽勒•传承之枪":   "SP伦伽勒",
  "萨曼莎•不灭微光":   "SP萨曼莎",
  "拉维耶•初夏记忆":   "SP拉维耶",
  "伊南娜•铃兰之剑":   "SP伊南娜",
  "索菲亚•夏日约定":   "SP索菲亚",
  "全装甲麦莎":        "SP麦莎",
  "内尔伽勒":          "内尔伽勃",
};

// ── 工具函数 ─────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wikiGet(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res;
}

/** 获取评价表 HTML */
async function fetchEvalPage() {
  const url = `${WIKI_BASE}/${encodeURIComponent("角色评价表")}`;
  const res = await wikiGet(url);
  return res.text();
}

/** 从详情页提取英文名 */
async function fetchEnName(wikiZhName) {
  const url = `${WIKI_BASE}/${encodeURIComponent("角色图鉴库")}/${encodeURIComponent(wikiZhName)}`;
  try {
    const res = await wikiGet(url);
    const html = await res.text();
    const $ = load(html);
    const title = $("h1.firstHeading, h1").first().text().trim();
    // "索菲亚 Safiyyah" → 取末尾英文
    const match = title.match(/([A-Za-z][A-Za-z0-9'\-\s]*)$/);
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
}

/** 读取 roles.ts 中所有角色 */
function readRoles() {
  const content = readFileSync(ROLES_FILE, "utf-8");
  const entries = [];
  for (const m of content.matchAll(/\{\s*zh:\s*"([^"]+)",\s*en:\s*"([^"]*)"/g)) {
    entries.push({ zh: m[1], en: m[2] });
  }
  return entries;
}

// ── 主流程 ───────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(55));
  console.log("角色数据审计");
  console.log("=".repeat(55));

  // 读缓存（支持中断续跑）
  const cache = existsSync(CACHE_FILE)
    ? JSON.parse(readFileSync(CACHE_FILE, "utf-8"))
    : {};

  // 1. 抓取评价表
  console.log("\n[1/3] 抓取 wiki 评价表...");
  const html = await fetchEvalPage();
  const $ = load(html);

  const wikiChars = [];
  $('tr[data-param1="传说"]').each((_, el) => {
    const tds = $(el).find("td");
    const zh = tds.eq(1).text().trim();
    if (zh) wikiChars.push(zh);
  });
  console.log(`  → wiki 传说角色: ${wikiChars.length} 个`);

  // 2. 逐一获取英文名（有缓存则跳过）
  console.log(`\n[2/3] 获取英文名（已缓存 ${Object.keys(cache).length} 个，剩余约需 ${Math.ceil((wikiChars.length - Object.keys(cache).length) * DELAY_MS / 1000 / 60)} 分钟）...`);

  for (let i = 0; i < wikiChars.length; i++) {
    const zh = wikiChars[i];
    if (cache[zh] !== undefined) {
      process.stdout.write(`  [${i + 1}/${wikiChars.length}] ${zh} (cached)\n`);
      continue;
    }
    // SP 角色详情页用全称
    const en = await fetchEnName(zh);
    cache[zh] = en;
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    process.stdout.write(`  [${i + 1}/${wikiChars.length}] ${zh} → ${en || "（未找到）"}\n`);
    await sleep(DELAY_MS);
  }

  // 3. 生成对比报告
  console.log("\n[3/3] 生成对比报告...");
  const rolesEntries = readRoles();
  const rolesMap = new Map(rolesEntries.map((r) => [r.zh, r.en]));

  const rows = [];

  for (const wikiZh of wikiChars) {
    const wikiEn = cache[wikiZh] || "";
    // 对应到 roles.ts 中的名称
    const rolesZh = WIKI_TO_ROLES[wikiZh] || wikiZh;
    const rolesEn = rolesMap.has(rolesZh) ? rolesMap.get(rolesZh) : null;

    rows.push({
      wikiZh,
      rolesZh,
      wikiEn,
      rolesEn,
      inRoles: rolesMap.has(rolesZh),
      nameMismatch: rolesZh !== wikiZh,
      enMismatch: rolesEn !== null && rolesEn !== wikiEn,
      enMissing: rolesEn === "",
    });
  }

  // 还有 roles.ts 里有但 wiki 没有的
  const wikiRolesNames = new Set(rows.map((r) => r.rolesZh));
  const onlyInRoles = rolesEntries.filter((r) => !wikiRolesNames.has(r.zh));

  writeFileSync(REPORT_JSON, JSON.stringify({ rows, onlyInRoles }, null, 2));

  // 文本报告
  const lines = [];
  const add = (...args) => { const s = args.join(" "); lines.push(s); console.log(s); };

  add("\n=== 英文名差异（wiki 有，我们不同）===");
  const enDiff = rows.filter((r) => r.inRoles && r.enMismatch);
  if (enDiff.length === 0) add("  （无差异）");
  enDiff.forEach((r) => add(`  ${r.rolesZh}: 我们="${r.rolesEn}" wiki="${r.wikiEn}"`));

  add("\n=== 英文名缺失（roles.ts 为空，wiki 有）===");
  const enEmpty = rows.filter((r) => r.inRoles && r.enMissing && r.wikiEn);
  if (enEmpty.length === 0) add("  （无）");
  enEmpty.forEach((r) => add(`  ${r.rolesZh}: wiki="${r.wikiEn}"`));

  add("\n=== wiki 有但 roles.ts 没有（可能是新角色）===");
  const notInRoles = rows.filter((r) => !r.inRoles);
  if (notInRoles.length === 0) add("  （无）");
  notInRoles.forEach((r) => add(`  ${r.wikiZh} (英文: ${r.wikiEn || "未找到"})`));

  add("\n=== roles.ts 有但 wiki 传说列表没有 ===");
  if (onlyInRoles.length === 0) add("  （无）");
  onlyInRoles.forEach((r) => add(`  ${r.zh} (en: ${r.en || "空"})`));

  add("\n=== SP 角色名称映射（供参考）===");
  rows.filter((r) => r.nameMismatch).forEach((r) =>
    add(`  wiki: "${r.wikiZh}" → roles.ts: "${r.rolesZh}" (wiki英文: ${r.wikiEn || "未找到"})`)
  );

  writeFileSync(REPORT_TXT, lines.join("\n") + "\n");
  console.log(`\n报告已写入:\n  ${REPORT_JSON}\n  ${REPORT_TXT}`);
  console.log("（audit-cache.json 可删除）");
}

main().catch((e) => { console.error(e); process.exit(1); });
