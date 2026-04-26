import { createContext, useContext, useState } from "react";

const CN = {
  app: {
    title: "铃兰跑片助手",
    subtitle: "管理你的角色碎片养成进度",
  },
  header: {
    toggleTheme: "切换主题",
    toggleLanguage: "切换语言",
  },
  actions: {
    setPlan: "设置计划",
    community: "大家在跑谁",
    screenshot: "截图保存",
    generating: "生成中…",
    copyCode: "复制计划码",
    reset: "重置",
    importPlan: "导入计划",
    trialPlan: "一键试配",
    newBadge: "新",
  },
  empty: {
    noPlan: "暂未设置跑片计划",
  },
  toast: {
    trialLoaded: "已加载试配计划，可直接编辑",
    resetDone: "已恢复默认设置",
    copySuccess: "复制成功",
    copyFail: "复制失败，请手动复制",
    copyFail2: "复制失败，请重试",
    exportFail: "导出失败，请重试",
    importSuccess: "导入成功",
    planExpired: "计划数据已过期或不存在，请重新导出",
    planFormatError: "计划数据格式错误",
    planLoadFail: "加载计划失败，请重试",
  },
  calendar: {
    year: "年",
    month: "月",
    today: "今",
    todayReachable: "今日可达",
    fullStar: "★ 满星",
    excess: "超",
    shards: "片",
    remaining: "余",
    days: "天",
    rosterChangeDay: "阵容变动日",
    estimated: "预计",
    doubleDropDay: "双倍跑片",
  },
  export: {
    saveInstruction: "移动端长按图片保存",
    download: "下载图片",
    close: "关闭",
  },
  importDialog: {
    title: "导入跑片计划",
    replaceTitle: "替换现有计划？",
    replaceDesc1: "当前已有",
    replaceDesc2: "个角色的计划，导入将替换全部数据，此操作不可撤销。",
    cancel: "取消",
    confirmReplace: "确认替换",
    method1: "方式一：上传导出的图片",
    recognizing: "识别中…",
    uploadInstruction: "点击选择图片，或将图片拖拽到此处",
    uploadHint: "自动识别图中二维码",
    errorNotImage: "请上传图片文件",
    errorNoQR: "未能识别到二维码，请确认是铃兰跑片助手导出的图片",
    errorQRFormat: "二维码内容格式不正确",
    or: "或",
    method2: "方式二：粘贴计划码",
    codePlaceholder: "粘贴以 [SOC] 开头的计划码…",
    confirmImport: "确认导入",
    planCodeError: "计划码错误",
  },
  setPlanDialog: {
    title: "设置跑片计划",
    character: "角色",
    modeStar: "按星跑片",
    modeFree: "自由跑片",
    characterName: "角色名称",
    selectCharacter: "选择角色",
    searchCharacter: "搜索角色...",
    notFound: "未找到角色",
    currentShards: "已有碎片",
    need: "还需",
    bonusShards: "追忆/万能",
    currentStar: "当前星级",
    targetStar: "目标星级",
    startDate: "开始日期",
    endDate: "结束日期",
    estimated: "预计可达：",
    fullStar: "★ 满星",
    excess: "超",
    days: "天",
    estimatedNeeds: "⏱ 预计需要",
    daysToComplete: "天完成",
    addCharacter: "添加角色",
    savePlan: "保存计划",
    tooManyChars: "当日名额已超限，请调整日期",
    shardsUnit: "片",
    universalShards: "片万能可",
    doubleDrop: "双倍跑片",
    doubleDropRange: "双倍日期",
    doubleDropStart: "双倍开始",
    doubleDropEnd: "双倍结束",
  },
  feedback: {
    title: "问题反馈",
    desc: "描述具体问题，我会尽快回复处理。",
    sendEmail: "发送邮件",
    copyEmail: "复制邮箱",
    dmAuthor: "私信作者",
    aika: "@aika",
  },
  communityDialog: {
    title: "热门角色 Top 10 - 近 30 天",
    tabDefault: "国服",
    tabOther: "外服",
    justUpdated: "刚刚更新",
    minutesAgo: "分钟前更新",
    hoursAgo: "小时前更新",
    daysAgo: "天前更新",
    updateSchedule: "每日 00:00 更新",
    loaded: "数据已加载",
    noService: "暂未连接统计服务，显示示例数据",
    loading: "加载中…",
    morePeople: "更多人跑",
    peopleUnit: "人",
  },
  exportTemplate: {
    planTitle: "我的跑片计划",
    gameName: "铃兰之剑：为这和平的世界",
    rosterChangeDay: "阵容变动日",
    footerPlatform: "TapTap 游戏工具",
    footerTool: "铃兰跑片助手",
    footerHint: "保存图片，可直接导入计划",
    todayLabel: "今",
    doubleDropDay: "双倍跑片",
  },
} as const;

const EN: typeof CN = {
  app: {
    title: "SOC Shard Planner",
    subtitle: "Manage your shard farming progress",
  },
  header: {
    toggleTheme: "Toggle Theme",
    toggleLanguage: "Toggle Language",
  },
  actions: {
    setPlan: "Schedule",
    community: "Rankings",
    screenshot: "Save as Screenshot",
    generating: "Generating...",
    copyCode: "Copy Plan Code",
    reset: "Reset",
    importPlan: "Import Plan",
    trialPlan: "Quick Setup",
    newBadge: "NEW",
  },
  empty: {
    noPlan: "No plan set yet",
  },
  toast: {
    trialLoaded: "Trial plan loaded, you can edit it",
    resetDone: "Reset to default",
    copySuccess: "Copied successfully",
    copyFail: "Copy failed, please copy manually",
    copyFail2: "Copy failed, please retry",
    exportFail: "Export failed, please retry",
    importSuccess: "Import successful",
    planExpired: "Plan data expired or does not exist, please export again",
    planFormatError: "Plan data format error",
    planLoadFail: "Failed to load plan, please retry",
  },
  calendar: {
    year: "",
    month: "",
    today: "T",
    todayReachable: "Today",
    fullStar: "★ Max",
    excess: "Excess",
    shards: "shards",
    remaining: "Left",
    days: "d",
    rosterChangeDay: "Lineup Change",
    estimated: "ETA",
    doubleDropDay: "Double Shard",
  },
  export: {
    saveInstruction: "Long press image to save on mobile",
    download: "Download",
    close: "Close",
  },
  importDialog: {
    title: "Import Plan",
    replaceTitle: "Replace existing plan?",
    replaceDesc1: "Current plan has",
    replaceDesc2: " character(s). Importing will replace all data. This action is irreversible.",
    cancel: "Cancel",
    confirmReplace: "Confirm",
    method1: "Method 1: Upload exported image",
    recognizing: "Recognizing...",
    uploadInstruction: "Click or drag image to scan",
    uploadHint: "QR code will be auto-detected",
    errorNotImage: "Please upload your plan image",
    errorNoQR: "No QR code detected. Please confirm the image exported from SOC Shard Farm Planner",
    errorQRFormat: "QR code format is incorrect",
    or: "or",
    method2: "Method 2: Paste plan code",
    codePlaceholder: "Paste plan code starting with [SOC]...",
    confirmImport: "Confirm Import",
    planCodeError: "Plan code is incorrect",
  },
  setPlanDialog: {
    title: "Schedule",
    character: "Character",
    modeStar: "Star-based",
    modeFree: "Date-based",
    characterName: "Character Name",
    selectCharacter: "Select Character",
    searchCharacter: "Search character...",
    notFound: "Character not found",
    currentShards: "Owned",
    need: "Needed",
    bonusShards: "Immortal Recollection",
    currentStar: "Current Star",
    targetStar: "Target Star",
    startDate: "Start Date",
    endDate: "End Date",
    estimated: "Estimated reachable：",
    fullStar: "★ Max Stars",
    excess: "Excess",
    days: "days",
    estimatedNeeds: "⏱ Estimated time",
    daysToComplete: "days to complete",
    addCharacter: "Add Character",
    savePlan: "Save",
    tooManyChars: "Daily slot limit exceeded, please adjust dates",
    shardsUnit: "shards",
    universalShards: "Recollection shards required",
    doubleDrop: "Double Shard",
    doubleDropRange: "Double Shard Dates",
    doubleDropStart: "Start",
    doubleDropEnd: "End",
  },
  feedback: {
    title: "Feedback",
    desc: "Describe the issue. I'll reply and handle it.",
    sendEmail: "Send an Email",
    copyEmail: "Copy Address",
    dmAuthor: "DM on TapTap",
    aika: "@aika",
  },
  communityDialog: {
    title: "Top 10 Chars - Last 30 days",
    tabDefault: "GL",
    tabOther: "CN",
    justUpdated: "Just updated",
    minutesAgo: "min ago",
    hoursAgo: "hr ago",
    daysAgo: "days ago",
    updateSchedule: "Daily update at 00:00 (UTC+8)",
    loaded: "Data loaded",
    noService: "Stats service unavailable, showing sample data",
    loading: "Loading...",
    morePeople: "Most",
    peopleUnit: "players",
  },
  exportTemplate: {
    planTitle: "Shard Farming Plan",
    gameName: "Sword of Convallaria: For This World of Peace",
    rosterChangeDay: "Lineup Change",
    footerPlatform: "TapTap Game Tool",
    footerTool: "SOC Shard Planner",
    footerHint: "Save the image, import your plan anytime.",
    todayLabel: "T",
    doubleDropDay: "Double Shard",
  },
};

export type Translations = typeof CN;
export type Lang = "cn" | "en";

interface I18nContextValue {
  lang: Lang;
  t: Translations;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "cn",
  t: CN,
  toggleLang: () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("lang");
    if (saved) return saved === "en" ? "en" : "cn";
    // 首次访问：根据浏览器语言自动判断
    const browserLang = navigator.language || "";
    return browserLang.startsWith("zh") ? "cn" : "en";
  });

  const toggleLang = () => {
    setLang((l) => {
      const next = l === "cn" ? "en" : "cn";
      localStorage.setItem("lang", next);
      return next;
    });
  };

  return (
    <I18nContext.Provider value={{ lang, t: lang === "en" ? EN : CN, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
