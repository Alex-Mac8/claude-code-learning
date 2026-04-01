# Day 11: QueryEngine 详解

> "QueryEngine 是 Agent 的大脑 — 协调每一轮对话的控制中心"

## 🎯 学习目标

1. 理解 QueryEngine 的完整职责和代码结构
2. 掌握 API 调用的流式响应处理
3. 学会错误重试和恢复机制
4. 理解 System Prompt 的动态组装流程

## 📖 核心概念

### QueryEngine 的职责

`QueryEngine.ts`（1295 行）是每轮对话的入口控制器：

```
用户输入 → QueryEngine.submitMessage()
                │
                ├── 1. 处理用户输入（解析命令、附件）
                ├── 2. 组装 System Prompt
                ├── 3. 加载工具列表
                ├── 4. 调用 query() 进入 ReAct 循环
                ├── 5. 追踪成本和用量
                └── 6. 记录会话历史
```

### API 调用与流式响应

Claude Code 使用流式 API 获得更好的用户体验：

```typescript
// 非流式（等待完整响应）
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  messages,
  stream: false,  // 等待全部完成才返回
})
// 用户体验：等 5-10 秒 → 突然出现一大段文字

// 流式（逐步返回）
const stream = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  messages,
  stream: true,   // 逐 token 返回
})
for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    // 实时显示每个 token
    process.stdout.write(event.delta.text)
  }
}
// 用户体验：立刻开始看到文字逐字出现
```

### 错误处理与重试

```typescript
// src/services/api/errors.ts
export function categorizeRetryableAPIError(error: Error): {
  retryable: boolean
  category: string
  waitMs: number
} {
  // 429 Too Many Requests → 可重试
  if (error.status === 429) {
    return { retryable: true, category: 'rate_limit', waitMs: 30_000 }
  }
  
  // 500 Internal Server Error → 可重试
  if (error.status === 500) {
    return { retryable: true, category: 'server_error', waitMs: 5_000 }
  }
  
  // 529 Overloaded → 可重试
  if (error.status === 529) {
    return { retryable: true, category: 'overloaded', waitMs: 60_000 }
  }
  
  // 400, 401, 403 → 不可重试
  return { retryable: false, category: 'client_error', waitMs: 0 }
}
```

### System Prompt 动态组装

```typescript
// QueryEngine 在每轮对话开始时构建 System Prompt
async function buildSystemPrompt(context: ToolUseContext) {
  // 1. 获取各部分（并行加载）
  const parts = await fetchSystemPromptParts(context)
  
  // 2. 组装顺序（为了 Prompt Cache 优化）
  return [
    parts.baseIdentity,       // "You are Claude Code..."（很少变）
    parts.toolDescriptions,   // 工具描述（添加/移除工具时变）
    parts.claudeMdContent,    // CLAUDE.md 内容（项目相关）
    parts.memoryPrompt,       // 记忆提示
    parts.gitContext,         // Git 状态（每次可能不同）
    parts.dynamicContext,     // 当前目录、日期等
  ].join('\n\n')
}
```

**Prompt Cache 策略**：把不常变的放前面，常变的放后面：

```
┌──────────────────────┐ ← 缓存命中区域
│ 基础身份信息          │    很少变化
│ 工具描述              │    偶尔变化
│ CLAUDE.md            │    项目级别
├──────────────────────┤ ← 缓存可能失效
│ Git 状态              │    每次 commit 都变
│ 当前目录、日期         │    每次会话都可能变
└──────────────────────┘
```

## 🔧 关键技术

### 1. 消息规范化

```typescript
// 发送给 API 前，消息需要规范化
function normalizeMessagesForAPI(messages: Message[]): APIMessage[] {
  return messages
    .filter(msg => !msg.isLocalOnly)  // 移除本地消息
    .map(msg => ({
      role: msg.role,
      content: msg.content,
      // 移除内部字段（toolUseResult 等）
    }))
}
```

### 2. 成本跟踪

```typescript
// QueryEngine 实时跟踪每轮调用的成本
const usage = {
  input_tokens: response.usage.input_tokens,
  output_tokens: response.usage.output_tokens,
  cache_read_input_tokens: response.usage.cache_read_input_tokens || 0,
  cache_creation_input_tokens: response.usage.cache_creation_input_tokens || 0,
}

const turnCost = getTotalCost(usage)
totalSessionCost += turnCost

console.log(`Turn cost: $${turnCost.toFixed(4)} | Session total: $${totalSessionCost.toFixed(4)}`)
```

### 3. 会话持久化

```typescript
// src/utils/sessionStorage.ts
export async function recordTranscript(
  sessionId: string,
  messages: Message[],
): Promise<void> {
  const transcriptDir = path.join(getClaudeConfigHomeDir(), 'transcripts')
  const filePath = path.join(transcriptDir, `${sessionId}.jsonl`)
  
  // 使用 JSONL 格式（每行一条消息）
  for (const msg of messages) {
    await appendFile(filePath, JSON.stringify(msg) + '\n')
  }
}
```

## 💻 代码示例

### 实现简化版 QueryEngine

```typescript
import Anthropic from '@anthropic-ai/sdk'

class SimpleQueryEngine {
  private client: Anthropic
  private messages: any[] = []
  private systemPrompt: string
  private tools: any[]
  private totalCost = 0
  
  constructor(systemPrompt: string, tools: any[]) {
    this.client = new Anthropic()
    this.systemPrompt = systemPrompt
    this.tools = tools
  }
  
  async submitMessage(
    userMessage: string,
    onToolCall: (name: string, input: any) => Promise<string>,
    onText: (text: string) => void,
  ): Promise<void> {
    this.messages.push({ role: 'user', content: userMessage })
    
    let retryCount = 0
    const maxRetries = 3
    
    while (true) {
      try {
        // 流式 API 调用
        const stream = this.client.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: this.systemPrompt,
          tools: this.tools,
          messages: this.messages,
        })
        
        const response = await stream.finalMessage()
        retryCount = 0  // 重置重试计数
        
        // 追踪成本
        this.totalCost += this.calculateCost(response.usage)
        
        // 处理文本回复
        const textBlocks = response.content.filter(b => b.type === 'text')
        for (const block of textBlocks) {
          onText(block.text)
        }
        
        // 处理工具调用
        const toolUses = response.content.filter(b => b.type === 'tool_use')
        
        if (toolUses.length === 0) {
          break  // 没有工具调用 → 完成
        }
        
        // 记录 assistant 消息
        this.messages.push({ role: 'assistant', content: response.content })
        
        // 执行工具并收集结果
        const results = []
        for (const tool of toolUses) {
          const result = await onToolCall(tool.name, tool.input)
          results.push({
            type: 'tool_result',
            tool_use_id: tool.id,
            content: result,
          })
        }
        
        this.messages.push({ role: 'user', content: results })
        
      } catch (error: any) {
        if (error.status === 429 && retryCount < maxRetries) {
          retryCount++
          const waitMs = Math.min(1000 * Math.pow(2, retryCount), 30000)
          console.log(`Rate limited. Retry ${retryCount}/${maxRetries} in ${waitMs}ms`)
          await new Promise(r => setTimeout(r, waitMs))
          continue
        }
        throw error
      }
    }
  }
  
  private calculateCost(usage: any): number {
    return (usage.input_tokens / 1e6) * 3.0 +
           (usage.output_tokens / 1e6) * 15.0 +
           ((usage.cache_read_input_tokens || 0) / 1e6) * 0.30
  }
  
  getCost(): number { return this.totalCost }
}
```

## 🏋️ 练习任务

### 练习 1：流式响应处理（20 分钟）
使用 Anthropic SDK 的流式 API，实现一个逐字显示回复的程序。

### 练习 2：重试策略（15 分钟）
实现指数退避重试（exponential backoff），处理 429、500、529 错误码。

### 练习 3：成本计算器（15 分钟）
编写函数，根据 usage 对象计算包含缓存折扣的精确成本。

## 📚 扩展阅读

1. **[Anthropic Streaming API](https://docs.anthropic.com/claude/docs/streaming)** - 流式响应文档
2. **[Exponential Backoff](https://en.wikipedia.org/wiki/Exponential_backoff)** - 重试策略
3. **[Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)** - SSE 协议

## 🤔 反思问题

1. 流式响应对用户体验有多大改善？在什么场景下非流式更合适？
2. System Prompt 的组装顺序为什么对 Prompt Cache 很重要？
3. 如果 API 调用中途网络断开，QueryEngine 应该怎么处理？

---

## 📝 今日总结

✅ QueryEngine 的核心职责和代码结构  
✅ 流式 API 调用和实时输出  
✅ 错误分类和重试策略  
✅ System Prompt 动态组装和缓存优化  
✅ 成本跟踪和会话持久化  

**明天预告**：Day 12 学习 Message & UI Components — 消息渲染和交互组件！

## 🔗 导航

- [← Day 10: Agent Task System](day-10-agent-task.md)
- [→ Day 12: Message & UI](day-12-message-ui.md)
- [📊 Week 2 Quiz](quiz-02.json)
