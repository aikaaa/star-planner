/**
 * 日历卡片间距配置
 *
 * 修改这些值即可调整卡片的所有间距，无需编辑组件代码
 * 使用 Tailwind 类名格式（pb-2、mb-2 等）
 */

export const CARD_SPACING = {
  // 卡片头部（角色名、头像、今日可达星级）
  header: {
    paddingBottom: "pb-2", // 头部文字到分割线：8px
  },

  // 每行计划的上下间距（所有行统一）
  planRow: {
    paddingTop: "pt-2",    // 分割线到行内容：8px
    paddingBottom: "pb-2", // 行内容到下方（分割线或卡片底边）：8px
  },

  // 分割线样式
  divider: {
    headerBorder: "border-b border-border/60",
    rowBorder: "border-t border-border/40",
  },
};
