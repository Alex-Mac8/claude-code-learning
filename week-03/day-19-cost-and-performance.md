# Day 19: 成本追踪与性能优化

[← 上一天: 状态管理](./day-18-state-management.md) | [课程首页](../README.md) | [下一天: 多 Agent 系统 →](./day-20-multi-agent.md)

---

## 🎯 学习目标

1. 理解 Claude Code 的**成本追踪系统**
2. 掌握**启动性能优化**策略
3. 了解 **Token 预算管理**
4. 学习**终端渲染性能**优化

**难度:** 🟡 中级 | **预计时间:** 1 小时

---

## 📚 核心概念

### 成本追踪

每次 API 调用都有成本。Claude Code 实时追踪每一分钱：

```typescript
// src/cost-tracker.ts — 成本追踪
export function getTotalCost(): number {
  return state.totalInputCost + state.totalOutputCost
}

// 每次 API 调用后更新成本
function updateCost(usage: {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
}) {
  // Sonnet 4: $3/M input, $15/M output
  state.totalInputCost += usage.input_tokens * 0.000003
  state.totalOutputCost += usage.output_tokens * 0.000015
  
  // 缓存的 token 更便宜
  if (usage.cache_read_input_tokens) {
    state.totalInputCost -= usage.cache_read_input_tokens * 0.0000027
  }
}
```

### 成本阈值警告

```tsx
// src/components/CostThresholdDialog.tsx
// 当成本超过阈值时弹出确认
// "当前会话已花费 $2.50。继续？"
```

### 启动性能优化

Claude Code 对启动速度极其执着（recall Day 02）：

```typescript
// 优化策略汇总
1. profileCheckpoint — 精确计时每个启动阶段
2. startMdmRawRead — 并行预读 MDM 配置
3. startKeychainPrefetch — 并行预读凭证
4. prefetchFastModeStatus — 并行检查快速模式
5. memoize(getSystemContext) — 缓存上下文计算
6. Dead Code Elimination — Bun 编译时移除未用代码
7. feature() gates — 条件导入，减少加载量
```

### Token 预算管理

```typescript
// src/utils/tokenBudget.ts
// 控制每轮对话的 token 使用

// 输出 token 预算
const turnOutputBudget = parseTokenBudget(config.maxOutputTokens)

// 上下文预算管理
const contextBudget = MAX_CONTEXT_TOKENS - reservedForOutput

// 当接近预算时自动触发压缩
if (currentTokens > contextBudget * 0.8) {
  triggerCompaction()
}
```

### 终端渲染性能

```typescript
// src/context/fpsMetrics.ts — FPS 监控
// 终端 UI 也需要关注渲染性能！

// 虚拟列表：只渲染可见的消息
// src/components/VirtualMessageList.tsx
// 类似 web 的虚拟滚动——1000 条消息也不卡
```

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **Cost Tracker** | 成本追踪器 | 实时计算 API 调用费用 |
| **Token Budget** | Token 预算 | 限制每轮对话的 token 使用 |
| **Prompt Cache** | 提示缓存 | 缓存命中的 token 更便宜 |
| **Dead Code Elimination** | 死代码消除 | 编译时移除未用代码 |
| **FPS Metrics** | 帧率监控 | 终端 UI 渲染性能 |
| **Virtual List** | 虚拟列表 | 只渲染可见部分 |

---

## 💻 代码示例

### 示例 1: 简单的成本追踪器

```typescript
class CostTracker {
  private inputTokens = 0
  private outputTokens = 0
  
  // 模型定价 (per million tokens)
  private pricing = {
    'claude-sonnet-4-20250514': { input: 3, output: 15 },
    'claude-haiku-3-5-20241022': { input: 0.25, output: 1.25 },
  }
  
  record(model: string, usage: { input: number, output: number }) {
    this.inputTokens += usage.input
    this.outputTokens += usage.output
  }
  
  getCost(model: string): number {
    const price = this.pricing[model]
    return (this.inputTokens / 1_000_000 * price.input) +
           (this.outputTokens / 1_000_000 * price.output)
  }
  
  format(model: string): string {
    return `$${this.getCost(model).toFixed(4)} (${this.inputTokens} in / ${this.outputTokens} out)`
  }
}
```

---

## ✏️ 动手练习

### 练习 1: 添加成本显示 (⏱️ ~15 分钟)

在你的 Agent CLI 的状态栏中添加实时成本显示。

### 练习 2: 启动分析 (⏱️ ~20 分钟)

为你的 Agent 添加启动性能分析：记录每个阶段的耗时，找到瓶颈。

### 练习 3: Token 估算 (⏱️ ~15 分钟)

实现准确的 token 估算函数（提示：1 个中文字符 ≈ 2 tokens，1 个英文单词 ≈ 1.3 tokens）。

---

## 📖 扩展阅读

1. **Anthropic 定价页面**
   - 🔗 https://www.anthropic.com/pricing

2. **Prompt Caching**
   - 🔗 https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching

---

## 🤔 思考题

1. 如何在不牺牲质量的情况下降低 API 成本？
2. 启动速度对用户体验的影响有多大？值得花多少工程精力优化？
3. Prompt Cache 如何设计才能最大化缓存命中率？

---

## ➡️ 下一步

**明天：** [Day 20 — 多 Agent 系统](./day-20-multi-agent.md)

[← 上一天: 状态管理](./day-18-state-management.md) | [课程首页](../README.md) | [下一天: 多 Agent 系统 →](./day-20-multi-agent.md)
