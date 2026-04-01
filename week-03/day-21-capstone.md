# Day 21: Capstone Project - 构建完整的 AI Agent CLI

> "21 天的知识，凝聚成一个作品"

## 🎯 学习目标

1. 综合运用全部 21 天所学，构建完整的 AI Agent CLI
2. 实现工业级的错误处理、安全检查、上下文管理
3. 集成 MCP 支持和子 Agent 协调
4. 交付一个可以实际使用的项目

## 📖 项目：MyAgent CLI

### 功能规格

```
MyAgent CLI v1.0
├── 核心引擎
│   ├── ReAct 循环（Day 1）
│   ├── 流式 API 调用（Day 11）
│   ├── 上下文管理 + 压缩（Day 5）
│   └── 成本跟踪（Day 11）
├── Terminal UI
│   ├── Ink 组件（Day 2-3）
│   ├── Diff 显示（Day 12）
│   ├── Spinner 动画（Day 12）
│   └── 输入历史（Day 12）
├── 工具系统
│   ├── 工具注册中心（Day 4）
│   ├── 文件操作（Day 8）
│   ├── 搜索（Day 9）
│   ├── Shell 执行（Day 6）
│   └── MCP 扩展（Day 19）
├── 安全层
│   ├── 命令安全检查（Day 6）
│   ├── 权限管理（Day 15）
│   └── 路径验证（Day 15）
├── 任务管理
│   ├── 子任务创建（Day 10）
│   ├── 并行执行（Day 13）
│   └── 结果汇总（Day 13）
└── 生产级特性
    ├── 错误处理 + 重试（Day 20）
    ├── 日志系统（Day 20）
    ├── Feature Flags（Day 20）
    └── 会话恢复（Day 20）
```

### 项目结构

```
my-agent/
├── src/
│   ├── index.ts              # 入口
│   ├── engine/
│   │   ├── agent.ts          # ReAct 主循环
│   │   ├── queryEngine.ts    # 对话控制器
│   │   └── stream.ts         # 流式处理
│   ├── tools/
│   │   ├── registry.ts       # 工具注册
│   │   ├── file/
│   │   │   ├── read.ts
│   │   │   ├── write.ts
│   │   │   └── edit.ts
│   │   ├── search/
│   │   │   ├── glob.ts
│   │   │   └── grep.ts
│   │   ├── shell/
│   │   │   └── bash.ts
│   │   └── mcp/
│   │       └── client.ts
│   ├── context/
│   │   ├── manager.ts        # 上下文管理
│   │   ├── cache.ts          # Prompt Cache
│   │   └── compactor.ts      # 消息压缩
│   ├── security/
│   │   ├── checker.ts        # 安全检查
│   │   ├── permissions.ts    # 权限管理
│   │   └── audit.ts          # 审计日志
│   ├── tasks/
│   │   ├── manager.ts        # 任务管理
│   │   ├── worker.ts         # Worker 执行
│   │   └── coordinator.ts    # 协调器
│   ├── ui/
│   │   ├── app.tsx           # 主界面
│   │   ├── chat.tsx          # 聊天组件
│   │   ├── spinner.tsx       # 加载动画
│   │   └── diff.tsx          # Diff 显示
│   └── utils/
│       ├── logger.ts         # 日志
│       ├── cost.ts           # 成本计算
│       ├── recovery.ts       # 会话恢复
│       └── config.ts         # 配置管理
├── config/
│   ├── tools.json            # 工具配置
│   ├── permissions.json      # 权限规则
│   └── mcp.json              # MCP 服务器
├── package.json
├── tsconfig.json
└── README.md
```

## 💻 核心代码

### 1. 主入口

```typescript
// src/index.ts
import { render } from 'ink'
import React from 'react'
import { App } from './ui/app.js'
import { loadConfig } from './utils/config.js'
import { SessionRecovery } from './utils/recovery.js'

async function main() {
  // 加载配置
  const config = await loadConfig()
  
  // 检查是否需要恢复会话
  const recovery = new SessionRecovery()
  const previousSession = await recovery.recover()
  
  if (previousSession) {
    console.log('🔄 检测到上次未完成的会话，是否恢复？(y/n)')
    // 恢复逻辑...
  }
  
  // 启动 Ink UI
  render(<App config={config} />)
}

main().catch(error => {
  console.error('Fatal error:', error.message)
  process.exit(1)
})
```

### 2. 核心 Agent 引擎

```typescript
// src/engine/agent.ts
import Anthropic from '@anthropic-ai/sdk'
import { ToolRegistry } from '../tools/registry.js'
import { ContextManager } from '../context/manager.js'
import { SecurityChecker } from '../security/checker.js'
import { CostTracker } from '../utils/cost.js'
import { Logger } from '../utils/logger.js'

export class Agent {
  private client: Anthropic
  private tools: ToolRegistry
  private context: ContextManager
  private security: SecurityChecker
  private cost: CostTracker
  private logger: Logger
  
  constructor(config: AgentConfig) {
    this.client = new Anthropic()
    this.tools = new ToolRegistry()
    this.context = new ContextManager(config.maxTokens)
    this.security = new SecurityChecker(config.permissions)
    this.cost = new CostTracker()
    this.logger = new Logger(config.logLevel)
    
    // 注册所有工具
    this.registerDefaultTools()
  }
  
  async chat(
    message: string,
    callbacks: {
      onThinking: (text: string) => void
      onToolCall: (name: string, input: any) => void
      onToolResult: (name: string, result: string) => void
      onComplete: (response: string) => void
      onError: (error: Error) => void
    }
  ): Promise<void> {
    this.context.addUserMessage(message)
    let turns = 0
    
    while (turns < 50) {
      turns++
      
      try {
        const response = await this.client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: this.context.getSystemPrompt(),
          tools: this.tools.toAPIFormat(),
          messages: this.context.getMessages(),
        })
        
        // 追踪成本
        this.cost.addUsage(response.usage)
        
        // 处理回复
        let hasToolCalls = false
        
        for (const block of response.content) {
          if (block.type === 'text') {
            callbacks.onThinking(block.text)
          }
          if (block.type === 'tool_use') {
            hasToolCalls = true
          }
        }
        
        if (!hasToolCalls) {
          const text = response.content
            .filter(b => b.type === 'text')
            .map(b => (b as any).text)
            .join('')
          callbacks.onComplete(text)
          break
        }
        
        // 执行工具
        this.context.addAssistantMessage(response.content)
        const toolResults = []
        
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue
          
          callbacks.onToolCall(block.name, block.input)
          
          // 安全检查
          const secCheck = this.security.check(block.name, block.input)
          if (secCheck.blocked) {
            toolResults.push({
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: `🚫 Blocked: ${secCheck.reason}`,
            })
            continue
          }
          
          // 执行工具
          const result = await this.tools.execute(block.name, block.input)
          callbacks.onToolResult(block.name, result)
          
          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: result,
          })
        }
        
        this.context.addToolResults(toolResults)
        
      } catch (error) {
        this.logger.error('Agent error', error as Error)
        callbacks.onError(error as Error)
        break
      }
    }
    
    this.logger.info(`Chat completed: ${turns} turns, $${this.cost.getTotal().toFixed(4)}`)
  }
  
  getStats() {
    return {
      cost: this.cost.getTotal(),
      ...this.context.getStats(),
    }
  }
}
```

### 3. 交互式 UI

```typescript
// src/ui/app.tsx
import React, { useState, useCallback } from 'react'
import { Box, Text, Static } from 'ink'
import TextInput from 'ink-text-input'
import { Agent } from '../engine/agent.js'
import { Spinner } from './spinner.js'

type Message = {
  type: 'user' | 'agent' | 'tool' | 'error'
  content: string
}

export function App({ config }: { config: any }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [agent] = useState(() => new Agent(config))
  
  const handleSubmit = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    
    setInput('')
    setMessages(prev => [...prev, { type: 'user', content: text }])
    setLoading(true)
    
    await agent.chat(text, {
      onThinking: (t) => {},
      onToolCall: (name, input) => {
        setMessages(prev => [...prev, {
          type: 'tool',
          content: `🔧 ${name}: ${JSON.stringify(input).slice(0, 100)}`,
        }])
      },
      onToolResult: (name, result) => {
        setMessages(prev => [...prev, {
          type: 'tool',
          content: `📋 ${name} → ${result.slice(0, 200)}`,
        }])
      },
      onComplete: (response) => {
        setMessages(prev => [...prev, { type: 'agent', content: response }])
        setLoading(false)
      },
      onError: (error) => {
        setMessages(prev => [...prev, {
          type: 'error',
          content: `❌ ${error.message}`,
        }])
        setLoading(false)
      },
    })
  }, [agent, loading])
  
  const stats = agent.getStats()
  
  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="single" paddingX={1}>
        <Text bold color="cyan">MyAgent CLI v1.0</Text>
        <Text dimColor> | 💰 ${stats.cost.toFixed(4)} | 📝 {stats.messages}条</Text>
      </Box>
      
      <Static items={messages}>
        {(msg, i) => (
          <Box key={i} marginY={0}>
            <Text color={
              msg.type === 'user' ? 'cyan' :
              msg.type === 'agent' ? 'green' :
              msg.type === 'tool' ? 'yellow' : 'red'
            }>
              {msg.type === 'user' ? '👤 ' :
               msg.type === 'agent' ? '🤖 ' :
               msg.type === 'tool' ? '   ' : '❌ '}
              {msg.content}
            </Text>
          </Box>
        )}
      </Static>
      
      {loading && <Spinner text="思考中..." />}
      
      <Box marginTop={1}>
        <Text color="cyan">❯ </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={loading ? '等待中...' : '输入你的问题...'}
        />
      </Box>
    </Box>
  )
}
```

## 🏋️ 扩展挑战

### 挑战 1：添加对话导出（15 分钟）
输入 `/export` 命令，将当前对话导出为 Markdown 文件。

### 挑战 2：添加多模型支持（30 分钟）
支持在 Claude Sonnet、Haiku 之间切换，并比较成本差异。

### 挑战 3：发布为 npm 包（20 分钟）
配置 `package.json`，让你的 Agent 可以通过 `npx my-agent` 运行。

### 挑战 4：添加插件系统（45 分钟）
实现一个简单的插件接口，允许用户通过 JS 文件添加自定义工具。

## 🤔 最终反思

### 回顾 21 天

```
Week 1: Foundations（基础）
  Day 1:  理解了 Agent 的灵魂 — ReAct 循环
  Day 2-3: 掌握了 Terminal UI 的表达力
  Day 4:  学会了工具系统的设计艺术
  Day 5:  理解了上下文管理的重要性
  Day 6:  认识了安全的复杂性
  Day 7:  第一次从零构建 Agent

Week 2: Building（构建）
  Day 8-9:  文件操作和搜索 — Agent 的手和眼
  Day 10: 任务系统 — 分而治之
  Day 11: QueryEngine — Agent 的大脑
  Day 12: UI 组件 — 好的体验等于好的产品
  Day 13: 协调模式 — 一个人变一支团队
  Day 14: 文件处理 Agent — 能力升级

Week 3: Advanced（进阶）
  Day 15: 安全架构 — 信任需要机制保证
  Day 16: Anti-Distillation — 保护知识产权
  Day 17: Prompt Cache — 省钱也是技术活
  Day 18: 性能优化 — 快才是王道
  Day 19: MCP — 让 Agent 连接世界
  Day 20: 生产模式 — 从 demo 到产品
  Day 21: Capstone — 集大成之作
```

### 你学到了什么？

1. **Agent 不是一个功能，是一种架构** — 从 ReAct 循环到 Coordinator Mode
2. **安全不是可选项** — 每一层都需要防护
3. **性能是用户体验** — 缓存、压缩、异步处理
4. **好的抽象降低复杂度** — Tool 接口、消息类型、权限模型
5. **工程化思维** — 错误处理、日志、监控、恢复

### 下一步

- 🔧 继续完善你的 MyAgent CLI
- 📚 深入某个特定领域（MCP 开发、安全审计、性能优化）
- 🌟 将课程中的项目开源到 GitHub
- 💼 在实际工作中应用 Agent 思维

---

## 📝 课程完结

🎉 **恭喜你完成了 21 天的 Claude Code 源码学习之旅！**

从 Day 1 的 "什么是 ReAct" 到 Day 21 的完整 Agent CLI，你已经：

- ✅ 阅读了 50+ 个核心源文件
- ✅ 理解了 516K 行代码的架构设计
- ✅ 构建了 3 个实战项目
- ✅ 掌握了 Agent 系统的全栈技能

**记住**：最好的学习方式是持续构建。用你学到的知识，去解决真实的问题吧！🚀

## 🔗 导航

- [← Day 20: Production Patterns](day-20-production.md)
- [↑ 返回课程首页](../README.md)
- [📊 Week 3 Quiz](quiz-03.json)
