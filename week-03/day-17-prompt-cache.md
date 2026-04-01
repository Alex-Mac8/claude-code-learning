# Day 17: Prompt Cache 优化

> "缓存命中率就是省钱率"

## 🎯 学习目标

1. 深入理解 Anthropic Prompt Cache 的工作原理
2. 掌握 Cache-break 检测和防护
3. 学会 Sticky Latches 缓存保持策略
4. 识别并避免 14 种缓存失效场景

## 📖 核心概念

### Prompt Cache 原理

Anthropic 的 Prompt Cache 在 API 层面缓存 System Prompt 前缀：

```
请求 1: [System Prompt (3000 tokens)] + [User: "Hello"]
  → 缓存 System Prompt
  → 费用: 3000 × $3/M + 100 × $3/M = $0.0093

请求 2: [System Prompt (3000 tokens)] + [User: "分析代码"]
  → System Prompt 命中缓存！
  → 费用: 3000 × $0.30/M + 100 × $3/M = $0.00120
  → 节省: 87%！

请求 3: [System Prompt (修改了)] + [User: "测试"]
  → 缓存失效！重新缓存
  → 费用: 3000 × $3.75/M + 100 × $3/M = $0.01155
  → 比正常还贵 24%（缓存创建成本）
```

### Cache-break：缓存杀手

任何对 System Prompt 的修改都会导致缓存失效。Claude Code 的 System Prompt 包含动态部分：

```typescript
// System Prompt 结构（从不变到常变）
const systemPrompt = [
  // 🟢 几乎不变 - 缓存命中率高
  IDENTITY_PROMPT,          // "You are Claude Code..."
  TOOL_DESCRIPTIONS,        // 工具描述（40+ 工具）
  SAFETY_GUIDELINES,        // 安全准则
  
  // 🟡 偶尔变化
  CLAUDE_MD_CONTENT,        // CLAUDE.md 文件内容
  MCP_SERVER_LIST,          // MCP 服务器列表
  
  // 🔴 经常变化 - 缓存杀手
  GIT_STATUS,               // git status 输出
  CURRENT_DIRECTORY,        // 当前工作目录
  LOCAL_DATE,               // 今天的日期
  CONVERSATION_CONTEXT,     // 对话上下文提示
].join('\n\n')
```

### 14 种缓存失效场景

```
1.  工作目录变化（cd 命令）
2.  Git 状态变化（commit, checkout, merge）
3.  Git 分支切换
4.  日期变化（跨天使用）
5.  CLAUDE.md 文件修改
6.  MCP 服务器连接/断开
7.  工具列表变化（插件加载）
8.  Feature Flag 值变化（GrowthBook）
9.  用户配置变更
10. System Prompt 注入变化
11. 思考模式切换（thinking on/off）
12. 工具权限规则变更
13. 内存文件更新
14. 对话上下文溢出触发压缩
```

### Sticky Latches：缓存保持

```typescript
// "Sticky Latch" 策略：一旦某个值被缓存，尽量保持不变
class StickyCacheManager {
  private cachedValues: Map<string, string> = new Map()
  private isDirty = false
  
  // 只有真正需要变化时才更新
  update(key: string, newValue: string): boolean {
    const cached = this.cachedValues.get(key)
    
    if (cached === newValue) {
      return false  // 没变化，保持缓存
    }
    
    // 对于某些字段，使用"粘性"策略
    if (key === 'git_status' && this.isMinorChange(cached, newValue)) {
      return false  // 微小变化不触发更新
    }
    
    this.cachedValues.set(key, newValue)
    this.isDirty = true
    return true
  }
  
  private isMinorChange(old: string | undefined, new_: string): boolean {
    if (!old) return false
    // 如果只是行数变化（如 git status 多了一个文件），可以忽略
    const oldLines = old.split('\n').length
    const newLines = new_.split('\n').length
    return Math.abs(oldLines - newLines) <= 2
  }
}
```

## 🔧 关键技术

### 1. 缓存感知的 System Prompt 构建

```typescript
// 策略：把变化频率低的放前面（贡献缓存前缀）
function buildCacheOptimizedPrompt(parts: SystemPromptParts): string {
  // 静态前缀（~2000 tokens）- 高缓存命中
  const staticPrefix = [
    parts.identity,        // 不变
    parts.toolSchemas,     // 很少变
    parts.safetyRules,     // 不变
  ].join('\n\n')
  
  // 半静态中段（~500 tokens）
  const semiStatic = [
    parts.claudeMd,        // 偶尔变
    parts.mcpServers,      // 偶尔变
  ].join('\n\n')
  
  // 动态后缀（~300 tokens）
  const dynamic = [
    parts.gitStatus,       // 常变
    parts.cwd,             // 常变
    parts.date,            // 每天变
  ].join('\n\n')
  
  return `${staticPrefix}\n\n${semiStatic}\n\n${dynamic}`
}
```

### 2. 缓存命中率监控

```typescript
class CacheMonitor {
  private hits = 0
  private misses = 0
  private breakReasons: Map<string, number> = new Map()
  
  recordHit(): void { this.hits++ }
  
  recordMiss(reason: string): void {
    this.misses++
    this.breakReasons.set(reason, (this.breakReasons.get(reason) || 0) + 1)
  }
  
  getStats(): {
    hitRate: number
    topBreakReasons: [string, number][]
    estimatedSavings: number
  } {
    const total = this.hits + this.misses
    const hitRate = total ? this.hits / total : 0
    
    // 排序失效原因
    const sorted = Array.from(this.breakReasons.entries())
      .sort((a, b) => b[1] - a[1])
    
    // 估算节省金额
    const avgPromptTokens = 3000
    const savingsPerHit = (avgPromptTokens / 1e6) * (3.0 - 0.30)  // input vs cache_read
    
    return {
      hitRate,
      topBreakReasons: sorted.slice(0, 5),
      estimatedSavings: this.hits * savingsPerHit,
    }
  }
  
  printReport(): void {
    const stats = this.getStats()
    console.log(`\n📊 Prompt Cache 报告`)
    console.log(`命中率: ${(stats.hitRate * 100).toFixed(1)}%`)
    console.log(`预估节省: $${stats.estimatedSavings.toFixed(4)}`)
    console.log(`\n失效原因排名:`)
    stats.topBreakReasons.forEach(([reason, count]) => {
      console.log(`  ${count}次 - ${reason}`)
    })
  }
}
```

### 3. 预计算与批量更新

```typescript
// 避免频繁的 System Prompt 重建
class BatchedPromptUpdater {
  private pendingUpdates: Map<string, string> = new Map()
  private lastBuildTime = 0
  private minBuildInterval = 5000  // 至少 5 秒间隔
  
  queueUpdate(key: string, value: string): void {
    this.pendingUpdates.set(key, value)
  }
  
  shouldRebuild(): boolean {
    if (this.pendingUpdates.size === 0) return false
    return Date.now() - this.lastBuildTime >= this.minBuildInterval
  }
  
  flush(): Map<string, string> | null {
    if (!this.shouldRebuild()) return null
    
    const updates = new Map(this.pendingUpdates)
    this.pendingUpdates.clear()
    this.lastBuildTime = Date.now()
    return updates
  }
}
```

## 💻 代码示例

### 成本优化计算器

```typescript
function calculateCacheSavings(
  sessions: {
    promptTokens: number
    turns: number
    cacheHitRate: number
  }[]
): {
  totalWithoutCache: number
  totalWithCache: number
  savings: number
  savingsPercent: number
} {
  let totalWithout = 0
  let totalWith = 0
  
  for (const session of sessions) {
    const { promptTokens, turns, cacheHitRate } = session
    
    for (let i = 0; i < turns; i++) {
      // 无缓存成本
      totalWithout += (promptTokens / 1e6) * 3.0
      
      // 有缓存成本
      if (i === 0) {
        // 首次：创建缓存
        totalWith += (promptTokens / 1e6) * 3.75
      } else if (Math.random() < cacheHitRate) {
        // 命中缓存
        totalWith += (promptTokens / 1e6) * 0.30
      } else {
        // 未命中
        totalWith += (promptTokens / 1e6) * 3.75
      }
    }
  }
  
  return {
    totalWithoutCache: totalWithout,
    totalWithCache: totalWith,
    savings: totalWithout - totalWith,
    savingsPercent: ((totalWithout - totalWith) / totalWithout) * 100,
  }
}
```

## 🏋️ 练习任务

### 练习 1：缓存失效分析（15 分钟）
模拟一个 30 分钟的编码会话，列出每次 System Prompt 变化的原因，计算缓存命中率。

### 练习 2：优化 System Prompt 排列（20 分钟）
给定 10 个 System Prompt 组件及其变化频率，设计最优的排列顺序。

### 练习 3：成本对比（15 分钟）
计算：100 轮对话，System Prompt 3000 tokens，缓存命中率分别为 50%、80%、95% 时的总成本。

## 📚 扩展阅读

1. **[Anthropic Prompt Caching](https://docs.anthropic.com/claude/docs/prompt-caching)** - 官方文档
2. **[KV Cache 原理](https://kipp.ly/transformer-inference-arithmetic/)** - Transformer 推理优化
3. **[缓存策略](https://en.wikipedia.org/wiki/Cache_replacement_policies)** - LRU、LFU 等

## 🤔 反思问题

1. 缓存创建成本（$3.75/M）比正常输入（$3/M）贵 25%，在什么情况下缓存反而更费钱？
2. "Sticky Latch" 策略会不会导致 Agent 使用过时的信息？如何平衡？
3. 如果所有用户共享同一个缓存前缀，安全性如何保证？

---

## 📝 今日总结

✅ Prompt Cache 的工作原理和定价  
✅ Cache-break 的 14 种失效场景  
✅ Sticky Latches 缓存保持策略  
✅ 缓存感知的 System Prompt 构建  
✅ 缓存命中率监控和成本优化  

## 🔗 导航

- [← Day 16: Anti-Distillation](day-16-anti-distillation.md)
- [→ Day 18: Performance](day-18-performance.md)
- [📊 Week 3 Quiz](quiz-03.json)
