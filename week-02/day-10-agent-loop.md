# Day 10: Agent 循环 — QueryEngine 与 query()

[← 上一天: 文件工具](./day-09-file-tools.md) | [课程首页](../README.md) | [下一天: 上下文管理 →](./day-11-context-management.md)

---

## 🎯 学习目标

1. 深入理解 **QueryEngine** 的对话管理
2. 掌握 **query()** 核心循环的执行流程
3. 了解**流式响应**处理和工具执行
4. 学习**中断与恢复**机制

**难度:** 🔴 高级 | **预计时间:** 1 小时

---

## 📚 核心概念

### QueryEngine — 对话控制器

`QueryEngine.ts`（约 1300 行）是每轮对话的控制器。当用户按下 Enter 提交消息时，QueryEngine 负责：

1. 组装完整的消息列表（包括 System Prompt、历史对话、工具定义）
2. 调用 Claude API
3. 处理流式响应
4. 协调工具执行
5. 管理上下文窗口

```typescript
// src/QueryEngine.ts — submitMessage 方法（简化）
class QueryEngine {
  async submitMessage(userText: string, options: QueryOptions) {
    // 1. 创建用户消息
    const userMessage = createUserMessage(userText)
    this.messages.push(userMessage)
    
    // 2. 组装 System Prompt
    const systemPrompt = await buildEffectiveSystemPrompt({
      tools: this.tools,
      context: await getSystemContext(),
      claudeMd: await getClaudeMds(),
    })
    
    // 3. 进入核心循环
    await this.query({
      systemPrompt,
      messages: this.messages,
      tools: this.tools,
    })
  }
}
```

### query() — 无限循环的心脏

`query.ts`（约 1700 行）是整个 Agent 的心脏。这是一个**条件终止的无限循环**：

```typescript
// src/query.ts — 核心循环（简化）
export async function query(params: QueryParams) {
  while (true) {  // 无限循环
    // 1. 调用 Claude API（流式）
    const stream = await callClaudeAPI({
      model: params.model,
      system: params.systemPrompt,
      messages: normalizeMessages(params.messages),
      tools: formatToolsForAPI(params.tools),
    })
    
    // 2. 处理流式响应
    const assistantMessage = await processStream(stream)
    params.messages.push(assistantMessage)
    
    // 3. 提取工具调用
    const toolUses = assistantMessage.content
      .filter(block => block.type === 'tool_use')
    
    // 4. 没有工具调用 → 结束循环
    if (toolUses.length === 0) {
      break  // Agent 决定任务完成了
    }
    
    // 5. 执行所有工具调用
    const toolResults = await executeTools(toolUses, params.tools)
    
    // 6. 将结果添加到消息列表
    params.messages.push({
      role: 'user',
      content: toolResults
    })
    
    // 7. 检查是否需要上下文压缩
    if (shouldCompact(params.messages)) {
      await compactMessages(params.messages)
    }
    
    // 8. 回到循环顶部 → 再次调用 Claude
  }
}
```

### 流式响应处理

Claude API 返回的是**流式数据**——一个字符一个字符地到达。Claude Code 实时处理这些数据：

```typescript
// 流式处理：一边接收一边渲染
async function processStream(stream) {
  const message: AssistantMessage = { role: 'assistant', content: [] }
  
  for await (const event of stream) {
    switch (event.type) {
      case 'content_block_start':
        // 新的内容块开始（文字或工具调用）
        message.content.push(createBlock(event))
        break
        
      case 'content_block_delta':
        // 增量文本更新 → 实时渲染到终端
        appendDelta(message, event)
        renderPartialResponse(message)  // 实时显示
        break
        
      case 'content_block_stop':
        // 内容块结束
        break
        
      case 'message_stop':
        // 整个消息结束
        return message
    }
  }
}
```

### 循环终止条件

Agent 循环不是无限执行的。终止条件：

```
1. Claude 不调用任何工具 → 任务完成
2. 达到最大循环次数 → 防止无限循环
3. 用户按 Ctrl+C → 中断
4. Token 预算耗尽 → 强制停止
5. API 错误 → 异常退出
```

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **QueryEngine** | 对话级控制器 | 管理一轮完整对话 |
| **query()** | 核心循环函数 | while(true) 循环直到完成 |
| **Stream** | 流式 API 响应 | 一个字符一个字符接收 |
| **Delta** | 流式增量更新 | 新到达的文字片段 |
| **Turn** | 一次交互回合 | 用户消息 → Agent 响应（可能多轮工具调用） |
| **Compact** | 上下文压缩 | 对话太长时自动摘要 |

---

## 💻 代码示例

### 示例 1: 你自己的 Agent 循环

```typescript
// 完整的 Agent 循环实现
async function agentLoop(
  prompt: string,
  tools: ToolDef[],
  apiKey: string
) {
  const messages: Message[] = [
    { role: 'user', content: prompt }
  ]
  
  const MAX_TURNS = 20
  
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    // 调用 API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        tools: tools.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.inputSchema
        })),
        messages
      })
    })
    
    const result = await response.json()
    messages.push({ role: 'assistant', content: result.content })
    
    // 检查是否有工具调用
    const toolUses = result.content.filter(b => b.type === 'tool_use')
    if (toolUses.length === 0) {
      // 没有工具调用 → 结束
      return result.content.find(b => b.type === 'text')?.text
    }
    
    // 执行工具
    const toolResults = []
    for (const tu of toolUses) {
      const tool = tools.find(t => t.name === tu.name)
      const output = tool ? await tool.execute(tu.input) : '工具未找到'
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: output
      })
    }
    
    messages.push({ role: 'user', content: toolResults })
  }
  
  return '达到最大循环次数'
}
```

---

## ✏️ 动手练习

### 练习 1: 实现流式渲染 (⏱️ ~25 分钟)

修改上面的 Agent 循环，使用流式 API（`stream: true`），在终端实时显示 Claude 的回复。

### 练习 2: 添加中断支持 (⏱️ ~15 分钟)

使用 `AbortController` 让用户可以按 Ctrl+C 中断 Agent 循环。

### 练习 3: 阅读 query.ts (⏱️ ~15 分钟)

打开 `src/query.ts`，找到主循环的 `while` 语句，标记它的 5 个终止条件。

---

## 📖 扩展阅读

1. **Anthropic Streaming API**
   - 🔗 https://docs.anthropic.com/en/api/messages-streaming
   - 推荐：理解流式响应格式

2. **Agent Loop 中文解析**
   - 🔗 `~/Repos/cloud-code-study/docs/guide/01-agent-loop.md`
   - 推荐：详细的中文分析

---

## 🤔 思考题

1. **理解：** 为什么 Agent 循环是 while(true) 而不是 for 循环？这体现了什么设计理念？
2. **应用：** 如果一次循环中有 3 个工具调用，它们应该并行还是串行执行？为什么？
3. **思辨：** Agent 循环的最大次数应该设为多少？太小会限制能力，太大会浪费资源。

---

## ➡️ 下一步

**明天：** [Day 11 — 上下文管理](./day-11-context-management.md) — System Prompt 组装和 CLAUDE.md 配置。

[← 上一天: 文件工具](./day-09-file-tools.md) | [课程首页](../README.md) | [下一天: 上下文管理 →](./day-11-context-management.md)
