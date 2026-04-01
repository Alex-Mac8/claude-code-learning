# Day 5: Context Management

> "上下文窗口是 Agent 最宝贵的资源 — 管理好它，就像管理好你的内存一样重要"

## 🎯 学习目标

完成今天的学习后，你将能够：

1. 理解 Token 上下文窗口的工作原理和限制
2. 掌握 Claude Code 的三级上下文压缩策略
3. 学会 Prompt Cache 的缓存机制和失效场景
4. 理解 System Prompt 的分层组装
5. 实现基本的上下文管理策略

## 📖 核心概念

### 上下文窗口：Agent 的"工作记忆"

AI 模型的上下文窗口就像人的工作记忆 — 有限且宝贵。Claude 的上下文窗口为 200K tokens，看似很多，但在复杂的 Agent 任务中很快就会被填满：

```
一次典型的编码任务消耗：
├── System Prompt:        ~3,000 tokens
├── 用户消息:             ~200 tokens
├── 工具调用 1 (读文件):   ~2,000 tokens
├── 工具调用 2 (读文件):   ~3,000 tokens
├── 工具调用 3 (grep):     ~5,000 tokens
├── Agent 思考:           ~500 tokens
├── 工具调用 4 (写文件):   ~1,500 tokens
└── 最终回复:             ~300 tokens
    ─────────────────────────────
    总计:                  ~15,500 tokens（仅一轮对话！）
```

10 轮对话后就可能消耗 150K+ tokens。所以上下文管理至关重要。

### 三级上下文压缩

Claude Code 使用分层策略来管理上下文：

```
┌───────────────────────────────────────┐
│ Level 1: 工具结果截断                  │
│ 大文件只保留摘要 + 文件路径            │
│ maxResultSizeChars 控制上限            │
├───────────────────────────────────────┤
│ Level 2: 消息压缩（Compaction）        │
│ 旧消息被总结为简短摘要                 │
│ 保留关键信息，丢弃细节                 │
├───────────────────────────────────────┤
│ Level 3: 会话截断                     │
│ 超过阈值时，移除最早的消息             │
│ 保留 System Prompt + 最近 N 轮        │
└───────────────────────────────────────┘
```

### Level 1：工具结果截断

每个工具都有 `maxResultSizeChars` 限制：

```typescript
// 各工具的结果大小限制
const GlobTool = buildTool({
  maxResultSizeChars: 100_000,    // 100K 字符
  // ...
})

const GrepTool = buildTool({
  maxResultSizeChars: 100_000,
  // ...
})

const FileReadTool = buildTool({
  maxResultSizeChars: Infinity,   // 特殊：永不截断
  // 因为截断后会产生"读文件→存文件→读文件"的死循环
  // ...
})
```

超大结果会被存到磁盘，只返回预览：

```typescript
// src/utils/toolResultStorage.ts
export async function buildLargeToolResultMessage(
  content: string,
  toolUseId: string,
): Promise<string> {
  // 保存完整结果到文件
  const filePath = getToolResultPath(toolUseId)
  await writeFile(filePath, content)
  
  // 生成预览
  const preview = generatePreview(content, PREVIEW_SIZE_BYTES)
  
  return `Result too large (${content.length} chars). ` +
    `Saved to: ${filePath}\n\nPreview:\n${preview}`
}
```

### Level 2：消息压缩（Snip Compaction）

当上下文接近上限时，Claude Code 会触发压缩：

```typescript
// 压缩的核心思路
async function compactMessages(
  messages: Message[],
  keepRecent: number = 5
): Promise<Message[]> {
  // 1. 分离：保留最近 N 轮，其余标记为待压缩
  const recentMessages = messages.slice(-keepRecent)
  const oldMessages = messages.slice(0, -keepRecent)
  
  // 2. 让 Claude 总结旧消息
  const summary = await callClaude({
    system: 'Summarize the key information from these messages...',
    messages: oldMessages
  })
  
  // 3. 用总结替换旧消息
  return [
    { role: 'system', content: `Previous context summary:\n${summary}` },
    ...recentMessages
  ]
}
```

### Level 3：Prompt Cache 优化

Anthropic 的 Prompt Cache 可以大幅降低成本和延迟：

```
首次调用：
  System Prompt (3000 tokens) → 完整发送 → 缓存
  用户消息 (200 tokens) → 完整发送
  
后续调用：
  System Prompt (3000 tokens) → 命中缓存（免费！）
  用户消息 (200 tokens) → 完整发送
  
节省：~90% 的 System Prompt 成本
```

Claude Code 的缓存策略：

```typescript
// System Prompt 结构（为缓存优化）
function buildSystemPrompt(context: ToolUseContext): SystemPrompt {
  return {
    // 1. 静态部分（缓存命中率高）
    basePrompt: `You are Claude Code, a powerful AI assistant...`,
    
    // 2. 工具描述（变化较少）
    toolDescriptions: tools.map(t => t.description).join('\n'),
    
    // 3. 动态部分（每次可能不同）
    gitStatus: await getGitStatus(),
    cwd: getCwd(),
    localDate: getLocalISODate(),
  }
}
```

**Cache-break（缓存失效）场景**：

System Prompt 的任何部分改变都会导致缓存失效。常见的失效原因：

1. **工作目录变化**：`cd` 命令改变了 `cwd`
2. **Git 状态变化**：新的 commit、branch 切换
3. **工具列表变化**：MCP 服务器连接/断开
4. **日期变化**：跨天使用
5. **配置变化**：用户修改了设置

## 🔧 关键技术

### 1. System Prompt 组装

```typescript
// src/utils/queryContext.ts
export async function fetchSystemPromptParts(context) {
  const [
    userContext,     // 用户相关信息
    systemContext,   // 系统环境信息
    claudeMds,       // CLAUDE.md 文件内容
    memoryPrompt,    // 记忆系统提示
  ] = await Promise.all([
    getUserContext(),
    getSystemContext(),
    getClaudeMds(),
    loadMemoryPrompt(),
  ])
  
  return assembleSystemPrompt({
    userContext,
    systemContext,
    claudeMds,
    memoryPrompt,
    tools: context.options.tools,
  })
}
```

### 2. Token 计数

```typescript
// Claude Code 使用 API 级别的 token 计数
import { countTokensWithAPI } from './services/tokenEstimation.js'

// 粗略估算（快速但不精确）
function roughTokenCount(text: string): number {
  // 英文：~4 字符 ≈ 1 token
  // 中文：~1.5 字符 ≈ 1 token
  return Math.ceil(text.length / 3.5)
}

// 精确计数（需要 API 调用，较慢）
async function exactTokenCount(text: string): Promise<number> {
  return await countTokensWithAPI(text)
}
```

### 3. 成本追踪

```typescript
// src/cost-tracker.ts
export function getTotalCost(usage: Usage): number {
  const inputCost = (usage.input_tokens / 1_000_000) * INPUT_PRICE
  const outputCost = (usage.output_tokens / 1_000_000) * OUTPUT_PRICE
  const cacheReadCost = (usage.cache_read_input_tokens / 1_000_000) 
    * CACHE_READ_PRICE
  const cacheCreationCost = (usage.cache_creation_input_tokens / 1_000_000) 
    * CACHE_CREATION_PRICE
  
  return inputCost + outputCost + cacheReadCost + cacheCreationCost
}

// 价格常量（以 Claude Sonnet 为例）
const INPUT_PRICE = 3.0        // $3/M tokens
const OUTPUT_PRICE = 15.0      // $15/M tokens
const CACHE_READ_PRICE = 0.30  // $0.30/M tokens（比输入便宜 90%！）
const CACHE_CREATION_PRICE = 3.75  // $3.75/M tokens
```

### 4. CLAUDE.md 内存文件

```typescript
// CLAUDE.md 作为项目级上下文
// src/utils/claudemd.ts
export async function getClaudeMds(): Promise<string[]> {
  const paths = [
    // 项目根目录
    path.join(projectRoot, 'CLAUDE.md'),
    // 用户主目录
    path.join(homeDir, '.claude', 'CLAUDE.md'),
    // 当前工作目录
    path.join(cwd, 'CLAUDE.md'),
  ]
  
  const contents = await Promise.all(
    paths.map(p => readFile(p, 'utf-8').catch(() => null))
  )
  
  return contents.filter(Boolean) as string[]
}
```

## 💻 代码示例

### 示例 1：简单的上下文管理器

```typescript
class ContextManager {
  private maxTokens: number
  private messages: Message[] = []
  private systemPrompt: string
  
  constructor(maxTokens: number, systemPrompt: string) {
    this.maxTokens = maxTokens
    this.systemPrompt = systemPrompt
  }
  
  addMessage(message: Message): void {
    this.messages.push(message)
    this.ensureWithinLimit()
  }
  
  private estimateTokens(): number {
    const systemTokens = roughTokenCount(this.systemPrompt)
    const messageTokens = this.messages.reduce(
      (sum, msg) => sum + roughTokenCount(JSON.stringify(msg)),
      0
    )
    return systemTokens + messageTokens
  }
  
  private ensureWithinLimit(): void {
    while (this.estimateTokens() > this.maxTokens * 0.8) {
      // 保留系统提示 + 最近 3 条消息
      if (this.messages.length <= 3) break
      
      // 移除最早的消息
      const removed = this.messages.shift()
      console.log(`[压缩] 移除消息: ${removed?.role}`)
    }
  }
  
  getMessages(): Message[] {
    return [
      { role: 'system', content: this.systemPrompt },
      ...this.messages,
    ]
  }
}
```

### 示例 2：带缓存优化的 System Prompt

```typescript
class CachedSystemPrompt {
  private staticPart: string
  private lastDynamicPart: string = ''
  private cacheHits = 0
  private cacheMisses = 0
  
  constructor(staticPart: string) {
    this.staticPart = staticPart
  }
  
  build(dynamicContext: { cwd: string; date: string }): string {
    const dynamicPart = `\nCWD: ${dynamicContext.cwd}\nDate: ${dynamicContext.date}`
    
    if (dynamicPart === this.lastDynamicPart) {
      this.cacheHits++
      // 动态部分没变 → API 层缓存可以命中
    } else {
      this.cacheMisses++
      this.lastDynamicPart = dynamicPart
      // 动态部分变了 → 缓存会失效
    }
    
    return this.staticPart + dynamicPart
  }
  
  getStats(): { hits: number; misses: number; rate: string } {
    const total = this.cacheHits + this.cacheMisses
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      rate: total ? `${((this.cacheHits / total) * 100).toFixed(1)}%` : 'N/A'
    }
  }
}
```

## 🏋️ 练习任务

### 练习 1：计算上下文消耗（15 分钟）

假设一个编码任务需要：
- 读取 5 个文件（每个 ~1000 行）
- 执行 3 次 grep 搜索
- 写入 2 个文件
- Agent 思考 8 轮

估算总 token 消耗，判断是否会超过 200K 限制。

### 练习 2：实现消息压缩器（20 分钟）

编写一个函数，将超过 N 条的消息历史压缩为摘要 + 最近消息：

```typescript
function compactHistory(
  messages: { role: string; content: string }[],
  maxMessages: number
): { role: string; content: string }[] {
  // 你的实现
}
```

### 练习 3：分析 Prompt Cache 效率（15 分钟）

在 Claude Code 源码中找到以下信息：
1. System Prompt 的平均大小是多少 tokens？
2. 哪些操作会导致缓存失效？
3. 缓存命中时可以节省多少成本？

## 📚 扩展阅读

1. **[Anthropic Prompt Caching 文档](https://docs.anthropic.com/claude/docs/prompt-caching)** - 官方缓存机制
2. **[Token 计算指南](https://docs.anthropic.com/claude/docs/glossary#tokens)** - 理解 token 计数
3. **[长上下文使用指南](https://docs.anthropic.com/claude/docs/long-context)** - 200K 上下文最佳实践

## 🤔 反思问题

1. 为什么 FileReadTool 的 `maxResultSizeChars` 设为 `Infinity`？这不会导致上下文溢出吗？
2. 如果用户在一次会话中处理一个 10 万行的代码库，Claude Code 如何确保不超出上下文限制？
3. Prompt Cache 的"缓存失效"对用户体验有什么影响？如何最小化失效？
4. 中文文本和英文文本的 token 效率有什么不同？这对中文用户有什么影响？

---

## 📝 今日总结

✅ 上下文窗口的限制和重要性  
✅ 三级压缩策略（截断、压缩、截断）  
✅ Prompt Cache 的工作原理和优化  
✅ System Prompt 的分层组装  
✅ Token 计数和成本追踪  

**明天预告**：Day 6 我们将深入 **BashTool**，学习命令执行的沙盒机制和 23 种安全规则！

## 🔗 导航

- [← Day 4: Tool System 基础](day-04-tool-system.md)
- [→ Day 6: BashTool 深入](day-06-bash-tool.md)
- [📊 Week 1 Quiz](quiz-01.json)
