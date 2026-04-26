#!/usr/bin/env node
/**
 * 角色数据审计脚本
 *
 * 第一步（生成报告 + 待审核清单）：
 *   node scripts/audit-characters.mjs
 *   → 生成 audit-report.txt（人读报告）
 *   → 生成 audit-apply.json（待审核的变更清单，可手动编辑名称或删除条目）
 *
 * 第二步（审核通过后写入 Supabase）：
 *   node scripts/audit-characters.mjs --apply
 *   → 读取 audit-apply.json，将其中的角色写入 Supabase（characters 表 + avatars Storage）
 *
 * 环境变量：SUPABASE_URL、SUPABASE_SERVICE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { load } from "cheerio";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_TXT  = join(__dirname, "audit-report.txt");
const CACHE_FILE  = join(__dirname, "audit-cache.json");
const APPLY_FILE  = join(__dirname, "audit-apply.json");

const WIKI_BASE = "https://wiki.biligame.com/llzj";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DELAY_MS = 1500;
const APPLY = process.argv.includes("--apply");

// wiki 全称 → Supabase 中存储的名称
const WIKI_TO_ROLES = {
  "全装甲麦莎": "SP麦莎",
  "内尔伽勒":   "内尔伽勃",
};

function resolveZh(wikiZh) {
  if (WIKI_TO_ROLES[wikiZh]) return WIKI_TO_ROLES[wikiZh];
  if (wikiZh.includes("•") || wikiZh.includes("·")) {
    return `SP${wikiZh.split(/[•·]/)[0]}`;
  }
  return wikiZh;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Supabase ─────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("缺少环境变量 SUPABASE_URL / SUPABASE_SERVICE_KEY");
  return createClient(url, key);
}

async function fetchSupabaseChars(sb) {
  const { data, error } = await sb.from("characters").select("zh, en, sort_order");
  if (error) throw error;
  return data;
}

async function uploadAvatar(sb, imgUrl, enName) {
  try {
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
      .upload(`${enName}.png`, resized, { contentType: "image/png", upsert: true });
    return !error;
  } catch {
    return false;
  }
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

// ── 第一步：生成报告 + audit-apply.json ──────────────────────

async function runAudit() {
  const logs = [];
  const log = (...a) => { const s = a.join(" "); console.log(s); logs.push(s); };

  log("=".repeat(55));
  log(`角色数据审计`);
  log(`运行时间: ${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`);
  log("=".repeat(55));

  const sb = getSupabase();

  log("\n[1/4] 读取 Supabase characters 表...");
  const sbChars = await fetchSupabaseChars(sb);
  const sbMap = new Map(sbChars.map((r) => [r.zh, r]));
  const minOrder = sbChars.length > 0 ? Math.min(...sbChars.map((r) => r.sort_order)) : 100;
  log(`  → 已有 ${sbChars.length} 个角色，最小 sort_order: ${minOrder}`);

  const cache = existsSync(CACHE_FILE)
    ? JSON.parse(readFileSync(CACHE_FILE, "utf-8"))
    : {};

  log("\n[2/4] 抓取 wiki 评价表...");
  const html = await fetchEvalPage();
  const $ = load(html);

  const wikiChars = [];
  $('tr[data-param1="传说"]').each((_, el) => {
    const tds = $(el).find("td");
    const zh    = tds.eq(1).text().trim();
    const imgSrc = tds.eq(0).find("img").first().attr("src") || "";
    if (zh) wikiChars.push({ wikiZh: zh, rolesZh: resolveZh(zh), imgSrc });
  });
  log(`  → wiki 传说角色: ${wikiChars.length} 个`);

  const uncached = wikiChars.filter((c) => cache[c.wikiZh] === undefined);
  log(`\n[3/4] 获取英文名（缓存 ${Object.keys(cache).length}，待请求 ${uncached.length}）...`);

  for (let i = 0; i < wikiChars.length; i++) {
    const c = wikiChars[i];
    if (cache[c.wikiZh] !== undefined) {
      process.stdout.write(`  [${i + 1}/${wikiChars.length}] ${c.wikiZh} (cached)\n`);
      continue;
    }
    const en = await fetchEnName(c.wikiZh);
    cache[c.wikiZh] = en;
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
    process.stdout.write(`  [${i + 1}/${wikiChars.length}] ${c.wikiZh} → ${en || "（未找到）"}\n`);
    await sleep(DELAY_MS);
  }

  log("\n[4/4] 生成报告...");

  // 分类差异
  const notInSb   = []; // wiki 有，Supabase 没有（新角色）
  const enMissing = []; // Supabase en 为空，wiki 有
  const enDiff    = []; // en 有差异（仅报告，不自动改）

  for (const c of wikiChars) {
    const wikiEn  = cache[c.wikiZh] || "";
    const sbEntry = sbMap.get(c.rolesZh);

    if (!sbEntry) {
      notInSb.push({ zh: c.rolesZh, wikiZh: c.wikiZh, en: wikiEn, imgSrc: c.imgSrc });
      continue;
    }
    if (sbEntry.en === "" && wikiEn) {
      enMissing.push({ zh: c.rolesZh, wikiZh: c.wikiZh, en: wikiEn, imgSrc: c.imgSrc });
    } else if (sbEntry.en && wikiEn && sbEntry.en !== wikiEn) {
      enDiff.push({ zh: c.rolesZh, sbEn: sbEntry.en, wikiEn });
    }
  }

  const wikiRolesZhSet = new Set(wikiChars.map((c) => c.rolesZh));
  const onlyInSb = sbChars.filter((r) => !wikiRolesZhSet.has(r.zh));

  // 打印报告
  const section = (title) => { log(""); log(`=== ${title} ===`); };

  section("wiki 有但 Supabase 没有（新角色）");
  if (notInSb.length === 0) log("  （无）");
  notInSb.forEach((r) => log(`  ${r.wikiZh} → zh="${r.zh}"  en="${r.en}"`));

  section("英文名缺失（Supabase en 为空，wiki 有）");
  if (enMissing.length === 0) log("  （无）");
  enMissing.forEach((r) => log(`  ${r.zh}: en="${r.en}"`));

  section("英文名差异（Supabase ≠ wiki，仅供参考）");
  if (enDiff.length === 0) log("  （无）");
  enDiff.forEach((r) => log(`  ${r.zh}: 当前="${r.sbEn}"  wiki="${r.wikiEn}"`));

  section("Supabase 有但 wiki 传说列表没有");
  if (onlyInSb.length === 0) log("  （无）");
  onlyInSb.forEach((r) => log(`  ${r.zh} (en: ${r.en || "空"})`));

  writeFileSync(REPORT_TXT, logs.join("\n") + "\n");
  log(`\n报告已写入: ${REPORT_TXT}`);

  // 生成 audit-apply.json
  const applyPlan = {
    _readme: [
      "审核通过后运行：node scripts/audit-characters.mjs --apply",
      "可手动修改 zh / en 字段，或删除不需要写入的条目",
      "imgSrc 用于下载头像，留空则跳过头像上传",
    ],
    newChars: notInSb.map((r) => ({ zh: r.zh, en: r.en, imgSrc: r.imgSrc })),
    fillEn:   enMissing.map((r) => ({ zh: r.zh, en: r.en, imgSrc: r.imgSrc })),
  };

  writeFileSync(APPLY_FILE, JSON.stringify(applyPlan, null, 2) + "\n");
  log(`待审核清单: ${APPLY_FILE}`);
  log(`\n下一步：检查 audit-apply.json，确认/修改名称后运行 --apply`);
}

// ── 第二步：读取 audit-apply.json 写入 Supabase ──────────────

async function runApply() {
  if (!existsSync(APPLY_FILE)) {
    console.error(`找不到 ${APPLY_FILE}，请先运行不带 --apply 的审计脚本`);
    process.exit(1);
  }

  const plan = JSON.parse(readFileSync(APPLY_FILE, "utf-8"));
  const sb = getSupabase();

  // 获取当前最小 sort_order
  const { data: sbChars, error: sbErr } = await sb.from("characters").select("zh, sort_order");
  if (sbErr) throw sbErr;
  let nextOrder = sbChars.length > 0 ? Math.min(...sbChars.map((r) => r.sort_order)) - 1 : 99;

  console.log(`\n[apply] 读取 ${APPLY_FILE}`);
  console.log(`  新角色: ${plan.newChars?.length ?? 0} 个`);
  console.log(`  补全英文名: ${plan.fillEn?.length ?? 0} 个`);

  // 补全缺失英文名
  for (const r of (plan.fillEn ?? [])) {
    if (!r.en) { console.log(`  跳过 ${r.zh}（en 为空）`); continue; }
    const { error } = await sb.from("characters").update({ en: r.en }).eq("zh", r.zh);
    console.log(`  ${r.zh}: en → "${r.en}" ${error ? "❌ " + error.message : "✅"}`);
    if (r.imgSrc) {
      const ok = await uploadAvatar(sb, r.imgSrc, r.en);
      console.log(`    头像: ${ok ? "✅" : "❌"}`);
      await sleep(500);
    }
  }

  // 新增角色
  for (const r of (plan.newChars ?? [])) {
    if (!r.en) { console.log(`  跳过 ${r.zh}（en 为空）`); continue; }
    const { error } = await sb.from("characters").upsert(
      { zh: r.zh, en: r.en, sort_order: nextOrder },
      { onConflict: "zh" }
    );
    console.log(`  新增 ${r.zh} (en="${r.en}", order=${nextOrder}) ${error ? "❌ " + error.message : "✅"}`);
    if (r.imgSrc) {
      const ok = await uploadAvatar(sb, r.imgSrc, r.en);
      console.log(`    头像: ${ok ? "✅" : "❌"}`);
      await sleep(500);
    }
    nextOrder--;
    await sleep(DELAY_MS);
  }

  console.log("\n完成。（audit-cache.json / audit-apply.json 可删除）");
}

// ── 入口 ─────────────────────────────────────────────────────

if (APPLY) {
  runApply().catch((e) => { console.error(e); process.exit(1); });
} else {
  runAudit().catch((e) => { console.error(e); process.exit(1); });
}
