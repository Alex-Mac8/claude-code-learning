# Day 12: 上下文压缩与紧凑化

[← 上一天: 上下文管理](./day-11-context-management.md) | [课程首页](../README.md) | [下一天: 子 Agent →](./day-13-agent-tool.md)

---

## 🎯 学习目标

1. 理解**上下文窗口溢出**的问题
2. 掌握 Claude Code 的**压缩策略**：Compact、MicroCompact、Snip
3. 了解**压缩边界**和消息保留机制
4. 学习如何设计自己的上下文压缩系统

**难度:** 🔴 高级 | **预计时间:** 1 小时

---

## 📚 核心概念

### 为什么需要压缩？

Claude 的上下文窗口有限（200K tokens）。在长时间的编程会话中，对话可能包含大量代码输出、文件内容、工具结果。不压缩的话，很快就会超出限制。

```
一次典型会话的 token 增长：
  System Prompt: ~5K tokens
  + 10 轮对话: ~30K tokens
  + 工具结果（代码、文件内容）: ~100K tokens
  ───────────────
  总计: ~135K tokens → 接近限制！
```

### 压缩服务架构

```
src/services/compact/
├── compact.ts             # 主压缩逻辑
├── autoCompact.ts         # 自动触发压缩
├── microCompact.ts        # 微压缩（单条消息级）
├── snipCompact.ts         # 截断压缩（工具输出）
├── cachedMicrocompact.ts  # 缓存的微压缩
├── grouping.ts            # 消息分组
├── prompt.ts              # 压缩用的 prompt
├── postCompactCleanup.ts  # 压缩后清理
└── sessionMemoryCompact.ts # 会话记忆压缩
```

### 三种压缩策略

**1. Snip Compact（截断压缩）** — 最简单

工具输出太长时直接截断：

```typescript
// snipCompact.ts — 截断大型工具输出
function snipLargeToolResults(messages: Message[]) {
  for (const msg of messages) {
    for (const block of msg.content) {
      if (block.type === 'tool_result' && block.content.length > MAX_SIZE) {
        block.content = block.content.slice(0, PREVIEW_SIZE) +
          `\n[... 截断 ${block.content.length - PREVIEW_SIZE} 字符 ...]`
      }
    }
  }
}
```

**2. MicroCompact（微压缩）** — 单条消息级

用 Claude 自己来摘要单条消息：

```typescript
// microCompact.ts — 压缩单条消息
async function microCompact(message: Message) {
  const summary = await callClaude({
    system: '用 2-3 句话摘要以下内容，保留关键信息',
    messages: [{ role: 'user', content: message.content }]
  })
  return { ...message, content: summary }
}
```

**3. Full Compact（完整压缩）** — 对话级

压缩整段对话历史，插入 CompactBoundary：

```typescript
// compact.ts — 主压缩流程（简化）
async function compactMessages(messages: Message[]) {
  // 1. 保留最近的消息（不压缩）
  const recentMessages = messages.slice(-KEEP_RECENT)
  const oldMessages = messages.slice(0, -KEEP_RECENT)
  
  // 2. 用 Claude 摘要旧消息
  const summary = await callClaude({
    system: COMPACT_PROMPT,  // 专门的压缩 prompt
    messages: [{ 
      role: 'user', 
      content: `摘要以下对话历史:\n${formatMessages(oldMessages)}` 
    }]
  })
  
  // 3. 替换消息列表
  return [
    createCompactBoundaryMessage(),  // 标记压缩边界
    { role: 'user', content: summary },
    ...recentMessages
  ]
}
```

### 自动触发

```typescript
// autoCompact.ts — 自动检测并触发压缩
function shouldCompact(messages: Message[]): boolean {
  const totalTokens = estimateTokenCount(messages)
  const threshold = MAX_CONTEXT_TOKENS * 0.8  // 80% 阈值
  return totalTokens > threshold
}
```

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **Context Window** | 模型能处理的最大 token 数 | 200K tokens |
| **Compact** | 对话历史压缩 | 将旧对话摘要为几句话 |
| **MicroCompact** | 单条消息压缩 | 压缩单个工具输出 |
| **Snip** | 截断大型输出 | 保留头尾，中间省略 |
| **CompactBoundary** | 压缩边界标记 | 标记哪些消息已被压缩 |
| **Token Budget** | Token 预算 | 控制上下文使用量 |

---

## 💻 代码示例

### 示例 1: 实现简单的上下文压缩

```typescript
// 你自己的压缩系统
class ContextManager {
  private messages: Message[] = []
  private maxTokens = 100000
  
  addMessage(msg: Message) {
    this.messages.push(msg)
    if (this.shouldCompress()) {
      this.compress()
    }
  }
  
  private shouldCompress(): boolean {
    return this.estimateTokens() > this.maxTokens * 0.8
  }
  
  private async compress() {
    const keepRecent = 6  // 保留最近 6 条消息
    const old = this.messages.slice(0, -keepRecent)
    const recent = this.messages.slice(-keepRecent)
    
    // 生成摘要
    const summary = await this.summarize(old)
    
    // 替换消息列表
    this.messages = [
      { role: 'system', content: `[对话摘要]\n${summary}` },
      ...recent
    ]
  }
  
  private estimateTokens(): number {
    // 粗略估算：1 token ≈ 4 字符（英文）或 2 字符（中文）
    return this.messages.reduce((sum, m) => 
      sum + JSON.stringify(m.content).length / 3, 0
    )
  }
}
```

---

## ✏️ 动手练习

### 练习 1: Token 估算器 (⏱️ ~15 分钟)

实现一个 token 估算函数，支持中英文混合内容。

### 练习 2: 截断策略 (⏱️ ~20 分钟)

实现 "智能截断"：保留前 N 行和后 M 行，中间显示 `[已省略 X 行]`。

### 练习 3: 分析 compact.ts (⏱️ ~15 分钟)

阅读 `src/services/compact/compact.ts`，找出压缩时哪些信息会被保留、哪些会被丢弃。

---

## 📖 扩展阅读

1. **上下文压缩中文解析**
   - 🔗 `~/Repos/cloud-code-study/docs/guide/06-context-compression.md`

2. **Token 计数**
   - 🔗 https://docs.anthropic.com/en/docs/build-with-claude/token-counting

---

## 🤔 思考题

1. 压缩会丢失信息。如何决定哪些信息更重要，值得保留？
2. 如果压缩后 Agent 忘了之前讨论过的内容，怎么办？
3. 压缩本身需要调用 Claude API——这个额外成本值得吗？

---

## ➡️ 下一步

**明天：** [Day 13 — 子 Agent 工具](./day-13-agent-tool.md)

[← 上一天: 上下文管理](./day-11-context-management.md) | [课程首页](../README.md) | [下一天: 子 Agent →](./day-13-agent-tool.md)
