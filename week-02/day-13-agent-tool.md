# Day 13: 子 Agent 工具 — 多 Agent 协作

[← 上一天: 上下文压缩](./day-12-context-compression.md) | [课程首页](../README.md) | [下一天: 第二周回顾 →](./day-14-week2-review.md)

---

## 🎯 学习目标

1. 理解 **AgentTool** 的设计——Agent 调用 Agent
2. 掌握**子 Agent 生命周期**管理
3. 了解**前台/后台 Agent** 的区别
4. 学习 Agent 间的**消息传递**和**结果汇总**

**难度:** 🔴 高级 | **预计时间:** 1 小时

---

## 📚 核心概念

### Agent 调用 Agent

AgentTool 是 Claude Code 最强大的工具之一——它让主 Agent 可以**派生子 Agent** 来并行处理任务：

```
主 Agent 接收: "重构整个项目的错误处理"
     │
     ├─ 子 Agent 1: "分析 src/tools/ 中的错误处理模式"
     ├─ 子 Agent 2: "分析 src/services/ 中的错误处理模式"
     └─ 子 Agent 3: "建议统一的错误处理方案"
     │
     ▼
主 Agent: 汇总结果，制定计划
```

### AgentTool 的定义

```typescript
// src/tools/AgentTool/AgentTool.tsx — 核心结构（简化）
const AgentTool = buildTool({
  name: 'Agent',
  description: `启动一个子 Agent 来处理特定任务。
子 Agent 有自己的上下文和工具访问权限。
适用于：并行处理、隔离任务、长时间运行的操作。`,
  
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '给子 Agent 的指令' },
      agent_type: { type: 'string', description: '使用哪个 Agent 定义' },
    },
    required: ['prompt']
  }
})
```

### 子 Agent 执行

子 Agent 本质上是一个**独立的 Agent 循环**：

```typescript
// src/tools/AgentTool/runAgent.ts — 子 Agent 执行（简化）
export async function runAgent(params: {
  prompt: string
  tools: Tool[]
  parentContext: Context
}) {
  // 1. 创建独立的消息列表
  const messages: Message[] = [
    createUserMessage(params.prompt)
  ]
  
  // 2. 构建子 Agent 的 System Prompt
  const systemPrompt = buildAgentSystemPrompt({
    role: params.agentDefinition?.role,
    parentContext: params.parentContext,
  })
  
  // 3. 运行独立的 Agent 循环
  const result = await query({
    systemPrompt,
    messages,
    tools: params.tools,
    // 子 Agent 有自己的 token 预算
    maxTokens: AGENT_TOKEN_BUDGET,
  })
  
  // 4. 返回结果给父 Agent
  return summarizeAgentResult(result)
}
```

### 前台 vs 后台 Agent

```typescript
// 前台 Agent: 用户能看到执行过程
registerForeground(agentId)  
// → UI 显示实时进度

// 后台 Agent: 静默执行
// → 长时间运行（>2分钟）自动转为后台
const AUTO_BACKGROUND_MS = 120_000

// 后台 Agent 完成后通知
enqueueAgentNotification(agentId, result)
```

### 内置 Agent 类型

Claude Code 有预定义的 Agent 类型：

```typescript
// src/tools/AgentTool/built-in/generalPurposeAgent.ts
export const GENERAL_PURPOSE_AGENT: AgentDefinition = {
  name: 'general',
  role: '通用编程助手',
  tools: ['Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep'],
}

// 用户也可以自定义 Agent（通过 .claude/agents/ 目录）
```

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **AgentTool** | 子 Agent 工具 | 主 Agent 调用子 Agent |
| **子 Agent** | 派生的独立 Agent | 有自己的消息列表和上下文 |
| **AgentDefinition** | Agent 定义 | 名称、角色、可用工具 |
| **前台/后台** | 执行模式 | 前台实时显示，后台静默执行 |
| **Fork** | 子 Agent 分叉 | 从父 Agent 复制上下文 |
| **Summarize** | 结果汇总 | 子 Agent 完成后摘要返回 |

---

## 💻 代码示例

### 示例 1: 你自己的子 Agent 系统

```typescript
// 简化的子 Agent 实现
class AgentManager {
  private agents = new Map<string, AgentState>()
  
  async spawnAgent(prompt: string, tools: ToolDef[]): Promise<string> {
    const agentId = crypto.randomUUID()
    
    // 在独立上下文中运行 Agent 循环
    const resultPromise = agentLoop(prompt, tools)
    
    this.agents.set(agentId, {
      id: agentId,
      status: 'running',
      prompt,
      resultPromise
    })
    
    // 等待完成
    const result = await resultPromise
    this.agents.get(agentId)!.status = 'completed'
    
    return result
  }
  
  async spawnParallel(tasks: Array<{ prompt: string; tools: ToolDef[] }>) {
    // 并行执行多个子 Agent
    return Promise.all(tasks.map(t => this.spawnAgent(t.prompt, t.tools)))
  }
}
```

---

## ✏️ 动手练习

### 练习 1: 设计 Agent 协作 (⏱️ ~15 分钟)

设计一个 "代码审查" 场景，主 Agent 派生 3 个子 Agent：安全审查、性能审查、风格审查。画出交互图。

### 练习 2: 实现简单的子 Agent (⏱️ ~25 分钟)

基于 Day 07 的迷你项目，添加子 Agent 支持。

### 练习 3: 阅读 AgentTool 源码 (⏱️ ~15 分钟)

阅读 `src/tools/AgentTool/` 目录，理解 `runAgent.ts` 和 `agentToolUtils.ts` 的关系。

---

## 📖 扩展阅读

1. **子 Agent 中文解析**
   - 🔗 `~/Repos/cloud-code-study/docs/guide/03-sub-agent.md`

2. **多 Agent 系统设计**
   - 🔗 https://docs.anthropic.com/en/docs/build-with-claude/agentic-tool-use

---

## 🤔 思考题

1. 子 Agent 的上下文应该从父 Agent 继承多少？全部继承 vs 最小上下文？
2. 并行子 Agent 之间如果修改了同一个文件，如何处理冲突？
3. 子 Agent 的 token 预算应该如何分配？

---

## ➡️ 下一步

**明天：** [Day 14 — 第二周回顾](./day-14-week2-review.md)

[← 上一天: 上下文压缩](./day-12-context-compression.md) | [课程首页](../README.md) | [下一天: 第二周回顾 →](./day-14-week2-review.md)
