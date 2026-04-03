# Day 07: 第一周回顾 + 迷你项目

[← 上一天: 消息类型](./day-06-message-types.md) | [课程首页](../README.md) | [下一天: BashTool 深度解析 →](../week-02/day-08-bash-tool.md)

---

## 🎯 学习目标

1. 巩固第一周的**核心概念**
2. 完成**迷你项目**：一个简单的 CLI Agent 框架
3. 识别**知识薄弱点**并补充

**难度:** 🟡 中级 | **预计时间:** 1 小时（15 分钟复习 + 45 分钟项目）

---

## 📚 第一周知识图谱

```
Day 01: 架构总览
  └─ 三层架构：表现层 / 核心层 / 服务层
  └─ 30+ 工具统一接口
  
Day 02: 入口与启动
  └─ 并行预加载优化
  └─ Commander.js CLI 解析
  └─ Bootstrap State 设计
  
Day 03: 终端 UI (Ink)
  └─ React for CLI
  └─ Provider 嵌套模式
  └─ Box/Text 布局
  
Day 04: REPL 与输入
  └─ 交互循环
  └─ 斜杠命令系统
  └─ Early Input 缓冲
  
Day 05: Tool 系统
  └─ ToolDef 接口
  └─ buildTool() 工厂
  └─ 生命周期：校验→权限→执行→结果
  
Day 06: 消息类型
  └─ 5 种消息类型
  └─ tool_use / tool_result 配对
  └─ 消息规范化
```

---

## 🏗️ 迷你项目：Mini Agent CLI

**目标：** 构建一个能执行简单命令的 CLI Agent 框架。

### 项目结构

```
mini-agent/
├── package.json
├── src/
│   ├── index.ts        # 入口 + CLI 解析
│   ├── tools.ts        # Tool 定义
│   ├── agent.ts        # Agent 循环（模拟）
│   └── types.ts        # 消息类型
└── tsconfig.json
```

### 步骤 1: 定义类型 (types.ts)

```typescript
// src/types.ts
export type Message = {
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

export type ToolCall = {
  id: string
  name: string
  input: Record<string, unknown>
}

export type ToolResult = {
  toolCallId: string
  content: string
}

export type ToolDef = {
  name: string
  description: string
  execute: (input: Record<string, unknown>) => Promise<string>
}
```

### 步骤 2: 实现工具 (tools.ts)

```typescript
// src/tools.ts
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import type { ToolDef } from './types'

export const tools: ToolDef[] = [
  {
    name: 'bash',
    description: '执行 Shell 命令',
    async execute(input) {
      const { command } = input as { command: string }
      try {
        return execSync(command, { encoding: 'utf8', timeout: 5000 })
      } catch (e) {
        return `错误: ${(e as Error).message}`
      }
    }
  },
  {
    name: 'read_file',
    description: '读取文件内容',
    async execute(input) {
      const { path } = input as { path: string }
      try {
        return readFileSync(path, 'utf8')
      } catch (e) {
        return `无法读取文件: ${(e as Error).message}`
      }
    }
  },
  {
    name: 'list_files',
    description: '列出目录中的文件',
    async execute(input) {
      const { directory } = input as { directory: string }
      return execSync(`ls -la ${directory || '.'}`, { encoding: 'utf8' })
    }
  }
]
```

### 步骤 3: Agent 循环 (agent.ts)

```typescript
// src/agent.ts — 简化的 Agent 循环
import type { Message, ToolDef } from './types'

export async function runAgent(
  prompt: string,
  tools: ToolDef[],
  callLLM: (messages: Message[]) => Promise<Message>
) {
  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt(tools) },
    { role: 'user', content: prompt }
  ]
  
  // Agent 循环：最多 10 轮
  for (let turn = 0; turn < 10; turn++) {
    const response = await callLLM(messages)
    messages.push(response)
    
    // 没有工具调用 → 完成
    if (!response.toolCalls?.length) {
      return response.content
    }
    
    // 执行工具调用
    const results = await Promise.all(
      response.toolCalls.map(async (tc) => {
        const tool = tools.find(t => t.name === tc.name)
        if (!tool) return { toolCallId: tc.id, content: '未找到工具' }
        const result = await tool.execute(tc.input)
        return { toolCallId: tc.id, content: result }
      })
    )
    
    messages.push({
      role: 'user',
      content: '',
      toolResults: results
    })
  }
  
  return '达到最大循环次数'
}

function buildSystemPrompt(tools: ToolDef[]): string {
  const toolList = tools.map(t => `- ${t.name}: ${t.description}`).join('\n')
  return `你是一个编程助手。可用工具：\n${toolList}`
}
```

### 步骤 4: 入口 (index.ts)

```typescript
// src/index.ts
import { Command } from 'commander'
import { tools } from './tools'
import { runAgent } from './agent'

const program = new Command()
  .name('mini-agent')
  .argument('[prompt...]', '提示词')
  .parse()

const prompt = program.args.join(' ')
if (!prompt) {
  console.log('用法: mini-agent "你的指令"')
  process.exit(1)
}

// 模拟 LLM 调用（实际应用中替换为真实 API）
async function mockLLM(messages) {
  // 简单模式匹配，模拟 Claude 的工具调用决策
  const lastUser = messages[messages.length - 1]
  // ... 根据输入决定调用哪个工具
}

runAgent(prompt, tools, mockLLM).then(console.log)
```

---

## ✅ 自测清单

完成以下自测，确认你掌握了本周内容：

- [ ] 能说出 Claude Code 的三层架构和每层的职责
- [ ] 能解释 `profileCheckpoint` 和 `Promise.all` 的性能优化作用
- [ ] 能用 Ink 的 `<Box>` 和 `<Text>` 写简单的终端布局
- [ ] 能实现一个 ToolDef 定义
- [ ] 能解释 tool_use 和 tool_result 的配对规则
- [ ] 完成了迷你项目的至少 2 个步骤

---

## 🤔 思考题

1. 你的迷你项目和 Claude Code 最大的差距在哪里？
2. 如果要添加权限控制，你会怎么设计？
3. 回顾这一周，哪个概念最难理解？为什么？

---

## ➡️ 下一步

**下周预告：** 第二周将深入实战——BashTool 的安全设计、Agent 核心循环、上下文压缩、子 Agent 系统。

[← 上一天: 消息类型](./day-06-message-types.md) | [课程首页](../README.md) | [下一天: BashTool 深度解析 →](../week-02/day-08-bash-tool.md)
