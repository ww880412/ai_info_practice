# AI Practice Hub 前端体验与设计模式评审报告

> 评审日期：2026-03-13 | 评审工具：everything-claude-code:architect（前端视角）

## 一、页面结构和用户流程

**优点：** 首页直达 Dashboard、快速入口设计合理、Library 筛选/排序/批量操作完整

**问题：**

| 编号 | 问题 | 优先级 |
|------|------|--------|
| P1 | 导航栏移动端不可用（无 hamburger menu，5 项水平溢出） | 高 |
| P2 | Entry Detail 630 行 God Component（7 tab + 5 mutation + 2 query） | 高 |
| P3 | Library 757 行，20+ useState，筛选状态来源不一致 | 中 |

## 二、组件设计模式

**优点：** DynamicSummary 策略模式优秀、IngestDialog 多输入方式清晰、EntryCard 职责单一

**问题：**

| 编号 | 问题 | 优先级 |
|------|------|--------|
| P4 | 常量映射（sourceIconMap 等）在 EntryCard 和 Entry Detail 重复定义 | 中 |
| P5 | DynamicSummary 545 行，300 行是数据解析逻辑，应分离 | 中 |
| P6 | IngestDialog 和 SearchDialog 各自实现 modal 逻辑，无统一基础组件 | 中 |
| P7 | UI 中英文混杂（"退出选择" vs "Delete selected"） | 高 |

## 三、状态管理策略

**优点：** TanStack Query 使用得当、staleTime 30s 合理、useEntry 动态轮询设计优秀

**问题：**

| 编号 | 问题 | 优先级 |
|------|------|--------|
| P8 | useIngest 的 getConfig() 从 localStorage 读取，catch 静默返回空对象 | 低 |
| P9 | useEntries queryKey 用整个 params 对象（每次新引用） | 低 |
| P10 | Hook 返回数据格式不统一（部分解包 .data，部分未解包） | 中 |

## 四、前端性能优化

**优点：** 搜索 300ms debounce、条件渲染 tab、Dashboard 30s refetch

**问题：**

| 编号 | 问题 | 优先级 |
|------|------|--------|
| P11 | 无代码拆分 / lazy loading，7 个 tab 组件全部同步引入 | 中 |
| P12 | Tab 切换时组件完全卸载重挂载（vs CSS display:none） | 低 |
| P13 | Dashboard Weekly Trend 每个 bar 重复计算 Math.max | 低 |
| P14 | 有 Skeleton 组件但大部分页面只用文字 "Loading..." | 低 |

## 五、用户体验改进点

**优点：** IngestDialog 处理进度条、重复内容检测、批量 URL 逐条状态反馈、Toast 支持 action

**问题：**

| 编号 | 问题 | 优先级 |
|------|------|--------|
| P15 | 错误状态无重试按钮，mutation 错误无 toast | 高 |
| P16 | 空状态无 CTA 引导（如 Practice 空状态无跳转链接） | 低 |
| P17 | 删除成功后无 toast 反馈 | 低 |
| P18 | SearchDialog 不支持键盘上下导航和 Enter 选中 | 中 |

## 六、响应式设计和无障碍性

**优点：** max-w-7xl 布局、响应式 grid、tab aria-current、checkbox aria-label

**问题：**

| 编号 | 问题 | 优先级 |
|------|------|--------|
| P19 | 导航栏移动端完全不可用（同 P1） | 高 |
| P20 | Dialog 缺少焦点陷阱（Focus Trap） | 低 |
| P21 | `text-xs text-secondary` 颜色对比度潜在不达标 | 低 |
| P22 | EntryCard 用 div+onClick 模拟可点击，缺键盘可访问性 | 中 |

## 七、建议执行顺序

| 优先级 | 编号 | 描述 | 复杂度 |
|--------|------|------|--------|
| 高 | P1/P19 | 导航栏移动端适配 | 中 |
| 高 | P2 | Entry Detail 页面拆分 | 中 |
| 高 | P7 | UI 语言统一 | 低 |
| 高 | P15 | 错误状态增加重试和 toast | 低 |
| 中 | P3 | Library 状态管理重构 | 中 |
| 中 | P4 | 常量去重 | 低 |
| 中 | P5 | DynamicSummary 解析逻辑分离 | 低 |
| 中 | P6 | 统一 Dialog 基础组件 | 中 |
| 中 | P10 | Hook 返回数据格式统一 | 低 |
| 中 | P11 | 代码拆分 / lazy loading | 低 |
| 中 | P18 | 搜索键盘导航 | 中 |
| 中 | P22 | EntryCard 键盘可访问性 | 低 |
| 低 | P8-P9 | Hook 配置/queryKey 优化 | 低 |
| 低 | P12-P14 | Tab 保活、计算优化、骨架屏 | 低 |
| 低 | P16-P17 | 空状态 CTA、删除反馈 | 低 |
| 低 | P20-P21 | 焦点陷阱、对比度审查 | 低-中 |
