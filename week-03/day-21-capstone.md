# Day 21: 终极项目 — 构建你的 AI Agent CLI 工具

[← 上一天: 多 Agent 系统](./day-20-multi-agent.md) | [课程首页](../README.md)

---

## 🎯 学习目标

1. 将 21 天所学**整合**为一个完整项目
2. 构建一个**可工作的 AI Agent CLI**原型
3. 回顾和巩固**核心架构**知识
4. 规划**下一步学习**方向

**难度:** 🔴 高级 | **预计时间:** 1 小时（计划 15 分钟 + 编码 45 分钟）

---

## 📚 21 天知识总结

```
第一周 🟢 基础
  架构三层 → 启动优化 → Ink UI → REPL → Tool 系统 → 消息类型

第二周 🟡 实战
  BashTool 安全 → 文件操作 → Agent 循环 → 上下文管理 → 压缩 → 子 Agent

第三周 🔴 进阶
  权限系统 → MCP → 任务系统 → 状态管理 → 成本优化 → 多 Agent
```

---

## 🏗️ 终极项目：My Agent CLI

### 目标

构建一个具备以下核心能力的 Agent CLI：

1. ✅ CLI 入口（Commander.js）
2. ✅ 终端 UI（Ink）
3. ✅ Agent 循环（Claude API + Tool 执行）
4. ✅ 至少 3 个工具（Bash、FileRead、FileEdit）
5. ✅ 权限控制（危险命令需确认）
6. ✅ 流式输出
7. ✅ 成本追踪
8. 🎁 加分项：上下文压缩、会话恢复

### 项目结构

```
my-agent-cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx          # CLI 入口
│   ├── App.tsx            # Ink 顶层组件
│   ├── REPL.tsx           # REPL 交互组件
│   ├── agent/
│   │   ├── loop.ts        # Agent 循环
│   │   ├── stream.ts      # 流式处理
│   │   └── context.ts     # 上下文管理
│   ├── tools/
│   │   ├── index.ts       # 工具注册
│   │   ├── bash.ts        # BashTool
│   │   ├── fileRead.ts    # FileReadTool
│   │   └── fileEdit.ts    # FileEditTool
│   ├── permissions/
│   │   └── check.ts       # 权限检查
│   ├── state/
│   │   └── AppState.ts    # 状态管理
│   └── utils/
│       ├── cost.ts        # 成本追踪
│       ├── messages.ts    # 消息工具
│       └── tokens.ts      # Token 估算
└── README.md
```

### 核心代码

#### 1. 入口 (index.tsx)

```tsx
#!/usr/bin/env node
import { Command } from 'commander'
import { render } from 'ink'
import React from 'react'
import { App } from './App.js'

const program = new Command()
  .name('my-agent')
  .version('1.0.0')
  .argument('[prompt...]')
  .option('-m, --model <model>', '模型', 'claude-sonnet-4-20250514')
  .option('-p, --print', '非交互模式')
  .parse()

const opts = program.opts()
const prompt = program.args.join(' ')

render(<App model={opts.model} initialPrompt={prompt} printMode={opts.print} />)
```

#### 2. Agent 循环 (agent/loop.ts)

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { tools } from '../tools/index.js'

const client = new Anthropic()

export async function* agentLoop(prompt: string, model: string) {
  const messages = [{ role: 'user' as const, content: prompt }]
  
  for (let turn = 0; turn < 20; turn++) {
    // 流式调用 API
    const stream = client.messages.stream({
      model,
      max_tokens: 4096,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema
      })),
      messages
    })
    
    // 收集完整响应，同时 yield 增量文本
    const blocks = []
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && 
          event.delta.type === 'text_delta') {
        yield { type: 'text', text: event.delta.text }
      }
    }
    
    const response = await stream.finalMessage()
    messages.push({ role: 'assistant', content: response.content })
    
    // 检查工具调用
    const toolUses = response.content.filter(b => b.type === 'tool_use')
    if (toolUses.length === 0) {
      yield { type: 'done' }
      return
    }
    
    // 执行工具
    const toolResults = []
    for (const tu of toolUses) {
      yield { type: 'tool_start', name: tu.name, input: tu.input }
      const tool = tools.find(t => t.name === tu.name)
      const result = tool ? await tool.execute(tu.input) : '工具未找到'
      toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: result })
      yield { type: 'tool_result', name: tu.name, result }
    }
    
    messages.push({ role: 'user', content: toolResults })
  }
}
```

#### 3. REPL 组件 (REPL.tsx)

```tsx
import React, { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { agentLoop } from './agent/loop.js'

export function REPL({ model }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [cost, setCost] = useState(0)
  
  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isRunning) return
    
    setMessages(prev => [...prev, { role: 'user', text: input }])
    setIsRunning(true)
    
    let responseText = ''
    for await (const event of agentLoop(input, model)) {
      if (event.type === 'text') {
        responseText += event.text
        // 实时更新显示
      } else if (event.type === 'tool_start') {
        setMessages(prev => [...prev, 
          { role: 'tool', text: `🔧 ${event.name}: ${JSON.stringify(event.input)}` }
        ])
      }
    }
    
    setMessages(prev => [...prev, { role: 'assistant', text: responseText }])
    setInput('')
    setIsRunning(false)
  }, [input, model])
  
  return (
    <Box flexDirection="column">
      {messages.map((m, i) => (
        <Box key={i}>
          <Text color={m.role === 'user' ? 'green' : m.role === 'tool' ? 'yellow' : 'blue'}>
            {m.text}
          </Text>
        </Box>
      ))}
      <Box>
        <Text color="cyan">❯ </Text>
        <Text>{input}</Text>
      </Box>
      <Box borderStyle="single" paddingX={1}>
        <Text dimColor>Model: {model} | Cost: ${cost.toFixed(4)}</Text>
      </Box>
    </Box>
  )
}
```

---

## ✅ 课程完成清单

### 核心概念 ✓

- [ ] 三层架构（表现层 / 核心层 / 服务层）
- [ ] Agent 循环（感知 → 思考 → 行动）
- [ ] Tool 系统（统一接口 + 动态注册）
- [ ] 消息类型（tool_use / tool_result 配对）
- [ ] 权限模型（多层安全防御）
- [ ] 上下文管理（System Prompt + 压缩）
- [ ] 多 Agent 协作（子 Agent + Team + Swarm）

### 实践技能 ✓

- [ ] Commander.js CLI 解析
- [ ] Ink 终端 UI
- [ ] Anthropic API 调用（含流式）
- [ ] Tool 实现（Bash / FileRead / FileEdit）
- [ ] 权限控制实现
- [ ] 成本追踪
- [ ] 会话状态管理

---

## 🚀 下一步学习方向

### 1. 深入源码

继续阅读 Claude Code 的源码：
- `src/services/mcp/` — MCP 完整实现
- `src/coordinator/` — Coordinator 模式
- `src/utils/bash/ast.ts` — 命令 AST 解析
- `src/services/compact/` — 高级压缩策略

### 2. 构建真实项目

- 给你的 Agent 添加 MCP 支持
- 实现完整的会话恢复系统
- 添加更多工具（Web 搜索、数据库查询）
- 构建自定义 Agent 定义系统

### 3. 社区参与

- 关注 Claude Code 的更新
- 学习 MCP 生态中的新工具
- 在 GitHub 上分享你的 Agent 项目
- 参与 AI Agent 相关社区讨论

---

## 🎓 结语

21 天前，Claude Code 的 516K 行代码对你来说是一个黑盒。现在，你理解了它的架构、工具系统、Agent 循环、安全模型、上下文管理——以及如何构建类似的工具。

**最重要的不是你记住了多少代码，而是你掌握了 AI Agent CLI 工具的设计思维。**

这些模式——统一的 Tool 接口、感知-思考-行动循环、多层安全防御、动态上下文组装——不仅适用于 Claude Code，它们是所有 AI Agent 系统的通用设计语言。

去构建你自己的 Agent 吧。🚀

---

[← 上一天: 多 Agent 系统](./day-20-multi-agent.md) | [课程首页](../README.md)
