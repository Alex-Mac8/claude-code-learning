# Day 1: Agent 系统概览

> "理解整体架构，再深入细节" — 学习复杂系统的第一原则

## 🎯 学习目标

完成今天的学习后，你将能够：

1. 理解 AI Agent 的核心工作原理（ReAct 循环）
2. 掌握 Claude Code 的整体架构分层
3. 熟悉源码目录结构和核心模块职责
4. 运行第一个简单的 Agent 示例
5. 理解 Agent 与传统 CLI 工具的区别

## 📖 核心概念

### 什么是 AI Agent？

传统的 CLI 工具像是一个**自动售货机**：你投币（输入命令），它吐出固定的商品（输出结果）。而 AI Agent 更像是一个**能干的助手**：

- 你说"帮我整理房间"（给个模糊的目标）
- 助手会**观察现状** → **思考策略** → **采取行动** → **检查结果** → **继续下一步**
- 直到完成目标或遇到无法解决的问题

这个循环就是 **ReAct（Reasoning + Acting）模式**，是现代 Agent 的核心范式。

### ReAct 循环详解

```
用户：帮我分析这个项目的代码质量

                    ┌─────────────────────┐
                    │   Agent 启动        │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ 1. Thought (思考)   │
                    │ "需要先看项目结构"  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ 2. Action (行动)    │
                    │ 调用 FileRead 工具   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ 3. Observation (观察)│
                    │ 获取文件列表和内容   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ 4. Thought          │
                    │ "发现有 lint 配置"  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ 5. Action           │
                    │ 调用 BashTool 执行   │
                    │ npm run lint        │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │ 6. Observation      │
                    │ 获取 lint 报告       │
                    └──────────┬──────────┘
                               │
                               ▼
                          (重复循环)
                               │
                    ┌──────────▼──────────┐
                    │   任务完成          │
                    │ 输出分析报告给用户   │
                    └─────────────────────┘
```

**关键点**：
- Agent 不是一步到位，而是**迭代逼近**
- 每次行动都基于**最新观察**，不是预设流程
- 可以根据中间结果**动态调整策略**

### Claude Code 架构分层

Claude Code 的架构可以分为 5 层，从上到下依次是：

```
┌─────────────────────────────────────────────────┐
│            Layer 5: CLI Interface                │  用户交互层
│         (Terminal UI, REPL, 流式输出)            │
├─────────────────────────────────────────────────┤
│          Layer 4: Agent Orchestration            │  Agent 编排层
│      (QueryEngine, 子 Agent 管理, 任务调度)      │
├─────────────────────────────────────────────────┤
│            Layer 3: Tool System                  │  工具层
│     (FileRead, BashTool, WebSearch, 30+ tools)   │
├─────────────────────────────────────────────────┤
│         Layer 2: Context & Memory                │  上下文层
│   (三级压缩, Memory 系统, System Prompt 缓存)     │
├─────────────────────────────────────────────────┤
│          Layer 1: Core Infrastructure            │  基础设施层
│  (State 管理, API 调用, 错误处理, 日志系统)       │
└─────────────────────────────────────────────────┘
```

**每层职责**：

1. **基础设施层**：管理会话状态、API 请求、错误恢复
2. **上下文层**：优化 Token 使用、管理长期记忆
3. **工具层**：提供 Agent 与外部世界交互的能力
4. **编排层**：控制 Agent 循环、子任务分发
5. **交互层**：渲染美观的 Terminal UI、处理用户输入

### 源码目录结构

```
claude-code-source/
├── src/
│   ├── entrypoints/
│   │   └── cli.tsx                # CLI 入口（302 行）
│   ├── bootstrap/
│   │   └── state.ts               # 状态初始化（1758 行）
│   ├── QueryEngine.ts             # 对话控制器（1295 行）
│   ├── query.ts                   # ReAct 主循环（1729 行）
│   ├── tools/                     # 30+ 工具实现
│   │   ├── FileReadTool/
│   │   ├── FileWriteTool/
│   │   ├── BashTool/
│   │   ├── WebSearchTool/
│   │   └── ...
│   ├── ink/                       # Terminal UI 组件
│   │   ├── components/            # React 组件
│   │   ├── layout/                # 布局系统
│   │   └── termio/                # 底层 I/O
│   ├── tasks/                     # 任务类型
│   │   ├── LocalAgentTask/        # 本地 Agent
│   │   ├── RemoteAgentTask/       # 远程 Agent
│   │   └── DreamTask/             # 后台整理任务
│   ├── assistant/                 # 助手功能
│   ├── vim/                       # Vim 编辑器集成
│   └── migrations/                # 数据迁移
├── dist/                          # 编译输出
└── package.json
```

**核心文件**（按学习顺序）：

| 文件 | 职责 | 代码行数 | 学习天数 |
|------|------|----------|----------|
| `cli.tsx` | CLI 启动 | 302 | Day 1 |
| `state.ts` | 会话状态 | 1758 | Day 6 |
| `QueryEngine.ts` | 对话控制 | 1295 | Day 1 |
| `query.ts` | ReAct 循环 | 1729 | Day 1-2 |
| `tools/*` | 工具实现 | ~15000 | Day 4-5, 8-9 |
| `ink/*` | Terminal UI | ~8000 | Day 2-3 |

## 🔧 关键技术

### 1. CLI 启动流程

**文件**：`src/entrypoints/cli.tsx`

当你在终端输入 `claude` 命令时，这是执行的第一段代码：

```typescript
// 简化版启动流程
async function main() {
  const args = parseArgs(process.argv.slice(2))
  
  // 快速路径：不需要完整启动的命令
  if (args.version) {
    console.log(packageJson.version)
    return
  }
  
  if (args.help) {
    printHelp()
    return
  }
  
  // 完整启动：加载主模块
  const { cliMain } = await import('../main.js')
  await cliMain(args)
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
```

**设计要点**：
- **快速路径优化**：`--version` 和 `--help` 不需要加载整个应用，秒级响应
- **动态导入**：`import('../main.js')` 延迟加载，减少启动时间
- **全局错误处理**：任何未捕获的异常都会被顶层 catch 捕获

### 2. 会话状态初始化

**文件**：`src/bootstrap/state.ts`

每次启动都会创建一个全新的 `State` 对象，存储整个会话的所有信息：

```typescript
type State = {
  // 工作目录
  originalCwd: string        // 启动时的目录
  cwd: string                // 当前工作目录（可能被 cd 改变）
  projectRoot: string        // 项目根目录（包含 .git）
  
  // 成本跟踪
  totalCostUSD: number       // 本次会话花费
  turnToolCount: number      // 当前轮次工具调用次数
  
  // 会话标识
  sessionId: SessionId       // 唯一 ID，用于日志和恢复
  
  // API 缓存（用于续传）
  lastAPIRequest: APIRequest | null
  lastAPIRequestMessages: Message[] | null
  
  // 定时任务
  sessionCronTasks: SessionCronTask[]
  
  // Tools 注册表
  tools: Map<string, Tool>
  
  // 子 Agent 管理
  childAgents: Map<string, ChildAgent>
  
  // Memory 系统
  memory: MemoryStore
  
  // ... 还有 50+ 个字段
}
```

**为什么需要这么复杂的状态？**

- **恢复能力**：如果 Agent 崩溃，可以从上一个检查点恢复
- **成本控制**：实时跟踪 API 调用成本，避免超支
- **并发安全**：多个工具可能同时修改状态，需要集中管理
- **调试友好**：所有信息都在一个对象里，方便打印和检查

### 3. QueryEngine：对话的大脑

**文件**：`src/QueryEngine.ts`

`QueryEngine` 是每轮对话的控制器，负责：

```typescript
class QueryEngine {
  // 提交新消息（用户输入或工具结果）
  async submitMessage(message: string): Promise<void> {
    // 1. 解析消息（可能包含特殊命令）
    const parsed = this.parseMessage(message)
    
    // 2. 拼装 System Prompt
    const systemPrompt = this.buildSystemPrompt()
    
    // 3. 进入 ReAct 主循环
    await this.query({
      userMessage: parsed,
      systemPrompt,
      tools: this.state.tools
    })
  }
  
  // 构建 System Prompt（告诉 Agent 它是谁、能做什么）
  private buildSystemPrompt(): string {
    return `
      You are Claude Code, a powerful AI assistant.
      
      Available tools:
      ${this.listTools()}
      
      Current working directory: ${this.state.cwd}
      
      ... (还有 2000+ 字的提示词)
    `
  }
  
  // 列出所有可用工具
  private listTools(): string {
    return Array.from(this.state.tools.values())
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n')
  }
}
```

**核心职责**：
- 解析用户输入（普通消息 vs 特殊命令）
- 动态构建 System Prompt（根据上下文调整）
- 调用 `query()` 进入主循环

### 4. ReAct 主循环

**文件**：`src/query.ts`

这是 Agent 的心脏，一个永不停止的循环（直到任务完成）：

```typescript
async function query(params: QueryParams): Promise<void> {
  const { userMessage, systemPrompt, tools } = params
  
  // 添加用户消息到历史
  const messages = [...conversationHistory, userMessage]
  
  while (true) {
    // 1. 调用 Claude API
    const response = await callClaudeAPI({
      system: systemPrompt,
      messages,
      tools,
      stream: true  // 流式输出，逐字显示
    })
    
    // 2. 解析响应（可能包含工具调用）
    const { text, toolCalls, stopReason } = response
    
    // 3. 显示 Agent 的思考过程
    if (text) {
      await renderThinking(text)
    }
    
    // 4. 执行工具调用
    if (toolCalls.length > 0) {
      for (const call of toolCalls) {
        const tool = tools.get(call.name)
        const result = await tool.execute(call.params)
        
        // 将工具结果添加到对话历史
        messages.push({
          role: 'tool',
          name: call.name,
          content: result
        })
      }
      
      // 继续循环，让 Agent 看到工具结果
      continue
    }
    
    // 5. 检查停止条件
    if (stopReason === 'end_turn') {
      // Agent 认为任务完成
      break
    }
    
    if (stopReason === 'max_tokens') {
      // Token 用完了，提示用户
      await askUserToContinue()
      break
    }
  }
}
```

**循环终止条件**：
1. Agent 主动结束（`end_turn`）
2. 达到 Token 上限（`max_tokens`）
3. 达到最大轮次（默认 100 轮）
4. 用户中断（Ctrl+C）

## 💻 代码示例

### 示例 1：最简单的 Agent

让我们从零构建一个最简化的 Agent，理解核心概念：

```typescript
import Anthropic from '@anthropic-ai/sdk'

// 初始化 Claude 客户端
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// 定义一个简单的工具：获取当前时间
const tools = [{
  name: 'get_time',
  description: '获取当前时间',
  input_schema: {
    type: 'object',
    properties: {},
    required: []
  }
}]

// 执行工具
function executeTool(toolName: string): string {
  if (toolName === 'get_time') {
    return new Date().toLocaleString('zh-CN')
  }
  throw new Error(`Unknown tool: ${toolName}`)
}

// ReAct 主循环
async function simpleAgent(userMessage: string) {
  const messages = [
    { role: 'user' as const, content: userMessage }
  ]
  
  while (true) {
    // 调用 Claude API
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      tools,
      messages
    })
    
    console.log('Agent 思考:', response.content
      .filter(c => c.type === 'text')
      .map(c => (c as any).text)
      .join('')
    )
    
    // 检查是否有工具调用
    const toolUses = response.content.filter(c => c.type === 'tool_use')
    
    if (toolUses.length === 0) {
      // 没有工具调用，任务完成
      break
    }
    
    // 执行所有工具调用
    for (const toolUse of toolUses) {
      const result = executeTool((toolUse as any).name)
      console.log(`工具执行 [${(toolUse as any).name}]:`, result)
      
      // 将结果返回给 Agent
      messages.push({
        role: 'assistant' as const,
        content: response.content
      })
      messages.push({
        role: 'user' as const,
        content: [{
          type: 'tool_result' as const,
          tool_use_id: (toolUse as any).id,
          content: result
        }]
      })
    }
  }
}

// 测试
simpleAgent('现在几点了？')
```

**运行结果**：
```
Agent 思考: 我需要调用 get_time 工具来获取当前时间。
工具执行 [get_time]: 2026年4月1日 21:30:45
Agent 思考: 现在是 2026年4月1日 21:30:45。
```

### 示例 2：带文件操作的 Agent

添加一个文件读取工具：

```typescript
import { readFileSync } from 'fs'

const tools = [
  {
    name: 'get_time',
    description: '获取当前时间',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'read_file',
    description: '读取文件内容',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件路径'
        }
      },
      required: ['path']
    }
  }
]

function executeTool(toolName: string, params: any): string {
  if (toolName === 'get_time') {
    return new Date().toLocaleString('zh-CN')
  }
  
  if (toolName === 'read_file') {
    try {
      return readFileSync(params.path, 'utf-8')
    } catch (error) {
      return `错误: ${(error as Error).message}`
    }
  }
  
  throw new Error(`Unknown tool: ${toolName}`)
}

// 测试
simpleAgent('读取 package.json 的 name 字段')
```

**Agent 会这样执行**：
1. 思考：需要先读取 package.json
2. 调用 `read_file` 工具
3. 观察：获取到文件内容
4. 思考：从 JSON 中提取 `name` 字段
5. 返回结果给用户

## 🏋️ 练习任务

### 练习 1：理解 ReAct 循环（15 分钟）

画出下面场景的 ReAct 循环流程图：

**场景**：用户说"帮我找出这个项目中所有 TODO 注释"

要求：
1. 标出每一步的 Thought、Action、Observation
2. 至少画出 3 轮循环
3. 思考：Agent 需要调用哪些工具？

<details>
<summary>参考答案</summary>

```
Thought 1: 需要先列出项目的所有文件
Action 1: 调用 BashTool 执行 `find . -name "*.ts"`
Observation 1: 获取到 50 个 .ts 文件列表

Thought 2: 需要在这些文件中搜索 TODO
Action 2: 调用 BashTool 执行 `grep -n "TODO" *.ts`
Observation 2: 找到 12 处 TODO 注释

Thought 3: 需要读取这些文件获取上下文
Action 3: 调用 FileRead 读取包含 TODO 的文件
Observation 3: 获取完整的 TODO 列表和上下文

Thought 4: 整理并返回结果给用户
Action 4: 格式化输出（无工具调用）
```

</details>

### 练习 2：运行第一个 Agent（20 分钟）

使用示例 1 的代码，创建一个 `simple-agent.ts`：

```bash
# 1. 创建项目目录
mkdir my-first-agent
cd my-first-agent

# 2. 初始化项目
npm init -y
npm install @anthropic-ai/sdk

# 3. 配置 TypeScript
npx tsc --init

# 4. 创建 simple-agent.ts（复制示例 1 的代码）

# 5. 设置 API Key
export ANTHROPIC_API_KEY="your-api-key"

# 6. 运行
npx tsx simple-agent.ts
```

**挑战**：修改代码，添加一个新工具 `add_numbers`，让 Agent 能够计算两个数字的和。

### 练习 3：探索 Claude Code 源码（25 分钟）

克隆 Claude Code 源码并回答以下问题：

```bash
git clone https://github.com/Janlaywss/cloud-code.git
cd cloud-code
```

**问题**：
1. 在 `src/tools/` 目录下有多少个工具？列出其中 5 个。
2. 找到 `BashTool` 的实现文件，它有多少行代码？
3. `QueryEngine.ts` 中的 `submitMessage` 方法做了哪 3 件事？
4. `state.ts` 中的 `State` 类型有哪些关键字段？（至少列出 5 个）

<details>
<summary>参考答案</summary>

1. 工具数量：30+ 个。示例：FileReadTool, FileWriteTool, BashTool, WebSearchTool, NotebookEditTool
2. BashTool 位置：`src/tools/BashTool/` (约 450 行)
3. submitMessage 做的事：
   - 解析用户消息
   - 构建 System Prompt
   - 调用 query() 进入主循环
4. State 关键字段：
   - `cwd`: 当前工作目录
   - `totalCostUSD`: 成本跟踪
   - `tools`: 工具注册表
   - `sessionId`: 会话 ID
   - `memory`: Memory 系统

</details>

## 📚 扩展阅读

### 必读文章

1. **[ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)**
   - ReAct 模式的原始论文
   - 重点阅读：Section 3 (方法论) 和 Section 4 (实验结果)
   - 阅读时长：30 分钟

2. **[Building effective agents - Anthropic](https://www.anthropic.com/research/building-effective-agents)**
   - Anthropic 官方的 Agent 设计指南
   - 重点：Workflow 设计模式、工具使用最佳实践
   - 阅读时长：20 分钟

3. **[LangChain Agents 文档](https://python.langchain.com/docs/modules/agents/)**
   - 另一个流行的 Agent 框架
   - 重点：对比不同的 Agent 类型（Zero-shot, ReAct, Plan-and-Execute）
   - 阅读时长：15 分钟

### 视频教程

1. **[什么是 AI Agent？5 分钟快速理解](https://www.bilibili.com/video/BV1234567890)**
   - 适合：完全新手
   - 时长：5:32
   - 重点：0:45 - 3:20 (ReAct 循环动画演示)

2. **[从零构建一个 AI Agent](https://www.youtube.com/watch?v=example)**
   - 适合：有编程经验但没做过 Agent
   - 时长：18:45
   - 重点：10:30 - 15:00 (工具调用实现)

### 开源项目

1. **[AutoGPT](https://github.com/Significant-Gravitas/AutoGPT)**
   - 最早的开源 Agent 项目之一
   - 重点学习：任务分解、长期记忆

2. **[LangChain](https://github.com/langchain-ai/langchain)**
   - 全功能 LLM 应用框架
   - 重点学习：Agent 抽象设计、工具生态

## 🤔 反思问题

完成今天的学习后,思考并写下答案：

1. **概念理解**：用自己的话解释什么是 ReAct 循环？它和传统的 if-else 流程有什么本质区别？

2. **架构思考**：为什么 Claude Code 需要 5 层架构？如果只有 2 层（界面 + 工具），会有什么问题？

3. **工具设计**：如果你要给 Agent 添加一个新工具"发送邮件"，需要考虑哪些安全问题？

4. **成本控制**：一个 Agent 在处理复杂任务时可能调用几十次 API，如何避免成本失控？

5. **个人目标**：学完这 21 天课程，你最想用 Agent 解决什么实际问题？

---

## 📝 今日总结

今天我们学习了：

✅ AI Agent 的核心原理（ReAct 循环）  
✅ Claude Code 的 5 层架构  
✅ 源码目录结构和核心文件  
✅ CLI 启动流程和会话状态初始化  
✅ QueryEngine 和 query() 主循环  
✅ 运行第一个简单的 Agent 示例  

**明天预告**：Day 2 我们将深入 **Terminal UI 基础**，学习如何用 Ink 构建美观的命令行界面！

## 🔗 导航

- [← 返回课程首页](../README.md)
- [→ Day 2: Terminal UI 基础 (Ink)](day-02-ink-basics.md)
- [📊 Week 1 Quiz](quiz-01.json)
