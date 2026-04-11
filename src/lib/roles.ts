/**
 * 角色数据表 —— 单一数据源
 *
 * 排序规则：最新角色在最前面（倒序）
 * 新增角色：直接在 Supabase characters 表插入一行即可，无需改代码
 *
 * 头像文件存放：/public/avatars/<en>.png
 * CDN 地址：https://cdn.jsdelivr.net/gh/aikaaa/star-planner@main/public/avatars/<en>.png
 */

import { supabase } from "@/lib/supabase";

const CDN_BASE = `${import.meta.env.BASE_URL}avatars`;

export interface RoleEntry {
  /** 游戏内中文名（与 CharacterPlan.name 对应） */
  zh: string;
  /** 头像文件名（不含扩展名），对应 /public/avatars/<en>.png；无图片时留空 */
  en: string;
  /** 无图片时的指定 emoji；未指定则随机取 CHAR_ICON_OPTIONS */
  emoji?: string;
}

/** 角色列表，最新角色在最前面 */
export const ROLES: RoleEntry[] = [
  // ── 最新角色（往这里加） ───────────────────────────────────
  { zh: "麦莎",     en: "Maitha"       },
  { zh: "拉维耶",   en: "Rawiyah"      },
  { zh: "法卡尔",   en: "Faycal"       },
  { zh: "贝拉",     en: "Beryl"        },
  { zh: "歌洛莉亚", en: "Gloria"       },
  { zh: "泰登",     en: "Teadon"       },
  { zh: "伊南娜",   en: "Inanna"       },
  { zh: "迪塔利奥", en: "Dantalion"    },
  { zh: "马格努斯", en: "Magnus"       },
  { zh: "泽维尔",   en: "Xavier"       },
  { zh: "米格尔",   en: "Miguel"       },
  { zh: "科尔",     en: "Col"          },
  { zh: "萨曼莎",   en: "Samantha"     },
  { zh: "列奥尼德", en: "Leonide"      },
  { zh: "嘉西娅",   en: "Garcia"       },
  { zh: "古兹曼",   en: "Guzman"       },
  { zh: "莉莉薇儿", en: "LilyWill"     },
  { zh: "诺诺薇儿", en: "NonoWill"     },
  { zh: "伊奇",     en: "Iggy"         },
  { zh: "内尔伽勃", en: "Nergal"       },
  { zh: "伦伽勒",   en: "Nungal"       },
  { zh: "艾达",     en: "Edda"         },
  { zh: "茉茉",     en: "Momo"         },
  { zh: "阿列克谢", en: "Alexei"       },
  { zh: "席梦娜",   en: "Simona"       },
  { zh: "索菲亚",   en: "Safiyyah"     },
  { zh: "奥古斯特", en: "Auguste"      },
  { zh: "蔻蔻娜",   en: "Cocoa"        },
  { zh: "阿坎贝",   en: "Acambe"       },
  { zh: "哈斯娜",   en: "Hasna"        },
  { zh: "霍玛",     en: "Homa"         },
  { zh: "卡丽丝",   en: "Caris"        },
  { zh: "夏可露露", en: "SchackLulu"   },
  { zh: "阿加塔",   en: "Agata"        },
  { zh: "塔埃尔",   en: "Taair"        },
  { zh: "SP拉维耶", en: "SP_Rawiyah"   },
  { zh: "帕米娜",   en: "Pamina"       },
  { zh: "翠斯坦",   en: "Tristan"      },
  { zh: "莉拉",     en: "Layla"        },
  { zh: "SP索菲亚", en: "SP_Safiyyah"  },
  { zh: "奇亚",     en: "Kiya"         },
  { zh: "柯瓦雷",   en: "Kvare"        },
  { zh: "露维塔",   en: "Luvata"       },
  { zh: "伊斯特拉", en: "Estra"        },
  { zh: "芙拉维娅", en: "Flavia"       },
  { zh: "流星队",   en: "Team_Meteor"  },
  { zh: "鲁特菲",   en: "Lutfi"        },
  { zh: "阿芙拉",   en: "Afra"         },
  { zh: "SP伊南娜", en: "SP_Inanna"    },
  { zh: "妮蒂娅",   en: "Nydia"        },
  { zh: "森西",     en: "Senshi"       },
  { zh: "玛露西尔", en: "Marcille"     },
  { zh: "法琳",     en: "Falin"        },
  { zh: "黎各",     en: "Rico"         },
  { zh: "爱莎",     en: "Ayishah"      },
  { zh: "柯莱丹萨", en: "Credenza"     },
  { zh: "帕西法尔", en: "Parsifal"     },
  { zh: "SP萨曼莎", en: "SP_Samantha"  },
  { zh: "伊瑟琳德", en: "Yserinde"     },
  { zh: "SP麦莎",   en: "SP_Maitha"    },
  { zh: "卡姆洛特", en: "Camelot"      },
  { zh: "SP法卡尔", en: "SP_Faycal"    },
  { zh: "SP伦伽勒", en: "SP_Nungal"    }, // ⚠️ 请将 "SP_Nungal .png" 重命名为 "SP_Nungal.png"（去掉空格）
  { zh: "露卡玛尔", en: "Lukamar"      },
  { zh: "波奇茸茸", en: "Pooch_Runrun" },
  { zh: "沙姆斯",   en: "Shams"        },
  { zh: "克拉拉",   en: "Clara"        },
  { zh: "赛琳娜",   en: "Selina"       },
  { zh: "叶迦内",   en: "Yeganeh"      },
  { zh: "赫砂",     en: "Heshan"       }, // ❓ Shams.png 是否也是赫砂？请确认
  { zh: "沙娜姿",   en: "Shahnaz"      },
  { zh: "基安希尔", en: "Kianshir"     },
  // ── 巫师联动 ──────────────────────────────────────────────
  { zh: "希里",     en: "Ciri"         },
  { zh: "杰洛特",   en: "Geralt"       },
  { zh: "叶奈法",   en: "Yennefer"     },
  { zh: "特莉丝",   en: "Triss"        },
  { zh: "安娜",     en: "Anna"         },
  // ── 早期角色 ──────────────────────────────────────────────
  { zh: "SP阿列克谢", en: "SP_Alexei"  },
  { zh: "罗格妮达",   en: "Rogneda"    },
  { zh: "乌莉娅",     en: "Ulya"       },
  { zh: "伊凡",       en: "Ivan"       },
  { zh: "芬恩",       en: "Finn"       },
  { zh: "塞娜",     en: "", emoji: "🦊" },
  { zh: "SP阿加塔", en: "", emoji: "🐺" },
  { zh: "阿尔曼",   en: "", emoji: "🦁" },
];

// ─────────────────────────────────────────────────────────────
// 以下为派生数据，供各组件直接使用，无需修改
// ─────────────────────────────────────────────────────────────

/** 角色名列表（本地兜底，最早角色在最前） */
export const ROLE_LIST: string[] = [...ROLES].reverse().map((r) => r.zh);

// ─────────────────────────────────────────────────────────────
// 远程角色列表（从 Supabase characters 表拉取，失败时降级到本地）
// ─────────────────────────────────────────────────────────────

let _remoteRoles: RoleEntry[] | null = null;

/** 从 Supabase 拉取角色列表，结果缓存在内存中 */
export async function fetchRemoteRoles(): Promise<RoleEntry[]> {
  if (_remoteRoles) return _remoteRoles;
  if (!supabase) return ROLES;

  const { data, error } = await supabase
    .from("characters")
    .select("zh, en")
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) return ROLES;

  _remoteRoles = data.map((r: { zh: string; en: string }) => ({ zh: r.zh, en: r.en }));
  return _remoteRoles;
}

/** 从远程角色列表中获取角色名列表（最新角色在最前） */
export async function fetchRemoteRoleList(): Promise<string[]> {
  const roles = await fetchRemoteRoles();
  return [...roles].reverse().map((r) => r.zh);
}

/** 角色名 → 头像 CDN URL（无图片时返回 null） */
export function getAvatarUrl(roleName: string): string | null {
  const role = ROLES.find((r) => r.zh === roleName);
  if (!role || !role.en) return null;
  return `${CDN_BASE}/${role.en}.png`;
}

/** 所有已映射角色的名称列表（调试用） */
export function getMappedRoles(): string[] {
  return ROLES.map((r) => r.zh);
}

/** 获取角色的指定 emoji（无图片时使用）；无指定则返回 null */
export function getRoleEmoji(roleName: string): string | null {
  return ROLES.find((r) => r.zh === roleName)?.emoji ?? null;
}
