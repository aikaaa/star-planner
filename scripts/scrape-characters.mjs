#!/usr/bin/env node
/**
 * 从 biligame wiki 自动抓取传说角色，写入 Supabase（characters 表 + avatars Storage）
 *
 * 环境变量（本地放 .env，GitHub Actions 用 secrets）：
 *   SUPABASE_URL          项目 URL
 *   SUPABASE_SERVICE_KEY  service_role 密钥（有写权限）
 *
 * 策略：
 *   - 精确匹配已有角色 → 跳过
 *   - SP 角色（wiki 名含 •/· 或在 SP_ALIAS 里）→ 写日志，不自动添加
 *   - 全新普通角色 → 获取英文名 → 下载头像上传 Storage → upsert characters 表
 *
 * 运行：node scripts/scrape-characters.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { load } from "cheerio";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = join(__dirname, "character-diff.log");

const WIKI_BASE = "https://wiki.biligame.com/llzj";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DELAY_MS = 1200;

// SP 角色：wiki 全称 → Supabase 中的名称
const SP_ALIAS = {
  "全装甲麦莎": "SP麦莎",
};

// wiki 名与游戏内名称不一致的映射
const NAME_ALIAS = {
  "内尔伽勒": "内尔伽勃",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Supabase ─────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("缺少环境变量 SUPABASE_URL / SUPABASE_SERVICE_KEY");
  return createClient(url, key);
}

/** 获取 Supabase characters 表中已有的 zh 名集合，以及当前最小 sort_order */
async function getExistingChars(sb) {
  const { data, error } = await sb.from("characters").select("zh, sort_order");
  if (error) throw error;
  const zhSet = new Set(data.map((r) => r.zh));
  const minOrder = data.length > 0 ? Math.min(...data.map((r) => r.sort_order)) : 100;
  return { zhSet, minOrder };
}

/** 上传头像到 Supabase Storage avatars bucket */
async function uploadAvatar(sb, imgUrl, enName) {
  const fullUrl = imgUrl.startsWith("http") ? imgUrl : `https://wiki.biligame.com${imgUrl}`;
  const res = await fetch(fullUrl, { headers: { "User-Agent": UA } });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  const resized = await sharp(buf)
    .resize(64, 64, { fit: "cover", position: "top" })
    .png()
    .toBuffer();
  const { error } = await sb.storage
    .from("avatars")
    .upload(`${enName}.png`, resized, {
      contentType: "image/png",
      upsert: true,
    });
  return !error;
}

// ── Wiki ─────────────────────────────────────────────────────

async function fetchEvalPage() {
  const res = await fetch(`${WIKI_BASE}/${encodeURIComponent("角色评价表")}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchEnName(wikiZhName) {
  const url = `${WIKI_BASE}/${encodeURIComponent("角色图鉴库")}/${encodeURIComponent(wikiZhName)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return "";
    const html = await res.text();
    const $ = load(html);
    const title = $("h1.firstHeading, h1").first().text().trim();
    const match = title.match(/([A-Za-z][A-Za-z0-9'\-\s]*)$/);
    return match ? match[1].trim() : "";
  } catch {
    return "";
  }
}

// ── 主流程 ───────────────────────────────────────────────────

async function main() {
  const logs = [];
  const log = (...a) => { const s = a.join(" "); console.log(s); logs.push(s); };

  log("=".repeat(50));
  log(`角色爬取 ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
  log("=".repeat(50));

  const sb = getSupabase();

  // 1. 抓取评价表
  log("\n[1/4] 抓取 wiki 评价表...");
  const html = await fetchEvalPage();
  const $ = load(html);

  const wikiChars = [];
  $('tr[data-param1="传说"]').each((_, el) => {
    const tds = $(el).find("td");
    const zh = tds.eq(1).text().trim();
    const imgSrc = tds.eq(0).find("img").first().attr("src") || "";
    if (zh) wikiChars.push({ zh, imgSrc });
  });
  log(`  → wiki 传说角色: ${wikiChars.length} 个`);

  // 2. 对比 Supabase 已有数据
  log("\n[2/4] 读取 Supabase characters 表...");
  const { zhSet: existing, minOrder } = await getExistingChars(sb);
  log(`  → 已有角色: ${existing.size} 个，最小 sort_order: ${minOrder}`);

  const toAdd = [];
  const spWarnings = [];

  for (let char of wikiChars) {
    // 名称别名处理
    if (NAME_ALIAS[char.zh]) char = { ...char, zh: NAME_ALIAS[char.zh] };

    // SP 角色判断
    const isSP = char.zh.includes("·") || char.zh.includes("•") || SP_ALIAS[char.zh];
    if (isSP) {
      const base = char.zh.split(/[·•]/)[0];
      const mapped = SP_ALIAS[char.zh] || `SP${base}`;
      if (!existing.has(mapped)) spWarnings.push({ wikiName: char.zh, suggestedName: mapped });
      continue;
    }

    if (!existing.has(char.zh)) toAdd.push(char);
  }

  log(`  → 普通新角色: ${toAdd.length} 个`);
  log(`  → SP 待确认:  ${spWarnings.length} 个`);

  // 3. 处理新角色
  log("\n[3/4] 处理新角色...");
  let nextOrder = minOrder - 1;

  for (const char of toAdd) {
    log(`\n  ▸ ${char.zh}`);

    // 英文名
    const en = await fetchEnName(char.zh);
    log(`    英文名: ${en || "（未找到）"}`);
    await sleep(DELAY_MS);

    // 上传头像
    let avatarOk = false;
    if (en && char.imgSrc) {
      avatarOk = await uploadAvatar(sb, char.imgSrc, en);
      log(`    头像:   ${avatarOk ? "✅ 已上传" : "❌ 上传失败"}`);
    }

    // 写入 characters 表
    const { error } = await sb.from("characters").upsert(
      { zh: char.zh, en: en || "", sort_order: nextOrder },
      { onConflict: "zh" }
    );
    if (error) log(`    DB:     ❌ ${error.message}`);
    else log(`    DB:     ✅ sort_order=${nextOrder}`);

    nextOrder--;
    await sleep(DELAY_MS);
  }

  // 4. 汇总
  log("\n[4/4] 完成");
  if (toAdd.length > 0) log(`  → 新增 ${toAdd.length} 个角色到 Supabase`);
  else log("  → 无新角色");

  if (spWarnings.length > 0) {
    log("\n⚠️  SP 角色需手动确认（未自动添加）：");
    spWarnings.forEach((w) => log(`   wiki: "${w.wikiName}" → 建议: "${w.suggestedName}"`));
  }

  writeFileSync(LOG_FILE, logs.join("\n") + "\n");
  log(`\n日志: ${LOG_FILE}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
