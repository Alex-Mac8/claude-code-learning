# Day 7: Week 1 项目 - 构建简单的 CLI Agent

> "最好的学习方式就是动手做一个"

## 🎯 学习目标

完成今天的项目后，你将能够：

1. 综合运用本周所学，构建一个可工作的 CLI Agent
2. 实现 ReAct 循环、工具注册、参数验证
3. 添加基本的安全检查和上下文管理
4. 使用 Ink 构建交互式 Terminal UI
5. 理解从零到一构建 Agent 的完整流程

## 📖 项目概览

### 目标

构建一个名为 **MiniAgent** 的 CLI 工具，具备以下功能：

- ✅ ReAct 循环（思考 → 行动 → 观察）
- ✅ 3 个内置工具（读文件、执行命令、搜索文件）
- ✅ 基本的安全检查
- ✅ Token 使用跟踪
- ✅ 交互式终端界面

### 架构设计

```
MiniAgent/
├── src/
│   ├── index.ts          # 入口
│   ├── agent.ts          # ReAct 主循环
│   ├── tools/
│   │   ├── registry.ts   # 工具注册中心
│   │   ├── readFile.ts   # 读文件工具
│   │   ├── runCommand.ts # 执行命令工具
│   │   └── searchFiles.ts # 搜索文件工具
│   ├── context/
│   │   └── manager.ts    # 上下文管理
│   ├── security/
│   │   └── checker.ts    # 安全检查
│   └── ui/
│       └── app.tsx       # Ink UI 组件
├── package.json
└── tsconfig.json
```

## 💻 代码实现

### Step 1：项目初始化

```bash
mkdir mini-agent && cd mini-agent
npm init -y
npm install @anthropic-ai/sdk ink react zod
npm install -D typescript @types/react tsx
npx tsc --init
```

### Step 2：工具注册中心

```typescript
// src/tools/registry.ts
import { z } from 'zod/v4'

export type ToolDefinition = {
  name: string
  description: string
  inputSchema: z.ZodObject<any>
  isReadOnly: boolean
  execute: (input: any) => Promise<string>
}

class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map()
  
  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool)
    console.log(`[Registry] 注册工具: ${tool.name}`)
  }
  
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name)
  }
  
  list(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }
  
  // 转换为 Anthropic API 工具格式
  toAPIFormat(): any[] {
    return this.list().map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: this.zodToJsonSchema(tool.inputSchema),
    }))
  }
  
  private zodToJsonSchema(schema: z.ZodObject<any>): object {
    // 简化版转换
    return {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(schema.shape).map(([key, value]) => [
          key,
          { type: 'string', description: (value as any).description || key }
        ])
      ),
      required: Object.keys(schema.shape),
    }
  }
}

export const registry = new ToolRegistry()
```

### Step 3：实现三个工具

```typescript
// src/tools/readFile.ts
import { readFileSync } from 'fs'
import { z } from 'zod/v4'
import { registry } from './registry.js'

const inputSchema = z.object({
  file_path: z.string().describe('要读取的文件路径'),
  max_lines: z.string().optional().describe('最大读取行数'),
})

registry.register({
  name: 'read_file',
  description: '读取文件内容。返回文件的文本内容。',
  inputSchema,
  isReadOnly: true,
  
  async execute(input) {
    try {
      const content = readFileSync(input.file_path, 'utf-8')
      const maxLines = input.max_lines ? parseInt(input.max_lines) : 100
      
      const lines = content.split('\n')
      if (lines.length > maxLines) {
        return lines.slice(0, maxLines).join('\n') +
          `\n\n... (truncated, ${lines.length - maxLines} more lines)`
      }
      
      return content
    } catch (error) {
      return `Error: ${(error as Error).message}`
    }
  },
})
```

```typescript
// src/tools/runCommand.ts
import { execSync } from 'child_process'
import { z } from 'zod/v4'
import { registry } from './registry.js'
import { SecurityChecker } from '../security/checker.js'

const inputSchema = z.object({
  command: z.string().describe('要执行的 Shell 命令'),
})

registry.register({
  name: 'run_command',
  description: '执行 Shell 命令并返回输出',
  inputSchema,
  isReadOnly: false,
  
  async execute(input) {
    // 安全检查
    const checker = new SecurityChecker()
    const checkResult = checker.check(input.command)
    
    if (checkResult.blocked) {
      return `🚫 命令被安全检查拦截: ${checkResult.reason}`
    }
    
    try {
      const output = execSync(input.command, {
        encoding: 'utf-8',
        timeout: 30_000,
        maxBuffer: 5 * 1024 * 1024,
        cwd: process.cwd(),
      })
      
      return output || '(命令执行成功，无输出)'
    } catch (error: any) {
      return `Exit code: ${error.status}\n${error.stderr || error.message}`
    }
  },
})
```

```typescript
// src/tools/searchFiles.ts
import { execSync } from 'child_process'
import { z } from 'zod/v4'
import { registry } from './registry.js'

const inputSchema = z.object({
  pattern: z.string().describe('搜索模式（glob 或正则）'),
  search_type: z.string().optional().describe('"glob" 或 "grep"，默认 glob'),
})

registry.register({
  name: 'search_files',
  description: '搜索文件名或文件内容',
  inputSchema,
  isReadOnly: true,
  
  async execute(input) {
    const type = input.search_type || 'glob'
    
    try {
      if (type === 'grep') {
        const output = execSync(
          `grep -rn "${input.pattern}" . --include="*.ts" --include="*.js" -l`,
          { encoding: 'utf-8', timeout: 10_000 }
        )
        return output || '未找到匹配'
      }
      
      // glob 搜索
      const output = execSync(
        `find . -name "${input.pattern}" -not -path "*/node_modules/*"`,
        { encoding: 'utf-8', timeout: 10_000 }
      )
      return output || '未找到匹配文件'
    } catch (error) {
      return `搜索失败: ${(error as Error).message}`
    }
  },
})
```

### Step 4：安全检查器

```typescript
// src/security/checker.ts
export class SecurityChecker {
  private blockedPatterns = [
    { pattern: /rm\s+-rf\s+\//, reason: '禁止删除根目录' },
    { pattern: />\s*\/dev\/sd/, reason: '禁止覆写磁盘设备' },
    { pattern: /curl.*\|\s*sh/, reason: '禁止下载并执行脚本' },
    { pattern: /wget.*\|\s*bash/, reason: '禁止下载并执行脚本' },
    { pattern: /chmod\s+777\s+\//, reason: '禁止开放根目录权限' },
    { pattern: /:.*\(\).*\{.*\|.*&.*\}/, reason: '检测到 fork 炸弹' },
    { pattern: /mkfs/, reason: '禁止格式化磁盘' },
    { pattern: /dd\s+if=\/dev\/zero/, reason: '禁止覆写设备' },
  ]
  
  check(command: string): { blocked: boolean; reason?: string } {
    for (const rule of this.blockedPatterns) {
      if (rule.pattern.test(command)) {
        return { blocked: true, reason: rule.reason }
      }
    }
    return { blocked: false }
  }
}
```

### Step 5：上下文管理器

```typescript
// src/context/manager.ts
type Message = { role: string; content: any }

export class ContextManager {
  private messages: Message[] = []
  private tokenEstimate = 0
  private readonly maxTokens: number
  private turnCount = 0
  
  constructor(maxTokens = 100_000) {
    this.maxTokens = maxTokens
  }
  
  addMessage(msg: Message): void {
    this.messages.push(msg)
    this.tokenEstimate += this.estimateTokens(msg)
    
    // 检查是否需要压缩
    if (this.tokenEstimate > this.maxTokens * 0.75) {
      this.compact()
    }
  }
  
  getMessages(): Message[] {
    return [...this.messages]
  }
  
  incrementTurn(): void {
    this.turnCount++
  }
  
  getStats(): { tokens: number; messages: number; turns: number } {
    return {
      tokens: this.tokenEstimate,
      messages: this.messages.length,
      turns: this.turnCount,
    }
  }
  
  private compact(): void {
    if (this.messages.length <= 4) return
    
    // 保留最近 4 条消息
    const kept = this.messages.slice(-4)
    const removed = this.messages.slice(0, -4)
    
    // 创建摘要
    const summary = `[Context Summary: ${removed.length} messages compacted. ` +
      `Key actions: ${removed.filter(m => m.role === 'assistant').length} agent responses, ` +
      `${removed.filter(m => m.role === 'tool').length} tool calls]`
    
    this.messages = [
      { role: 'user', content: summary },
      ...kept,
    ]
    
    this.tokenEstimate = this.messages.reduce(
      (sum, msg) => sum + this.estimateTokens(msg), 0
    )
    
    console.log(`[Context] 压缩完成: ${removed.length} 条消息 → 摘要`)
  }
  
  private estimateTokens(msg: Message): number {
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content)
    return Math.ceil(content.length / 3.5)
  }
}
```

### Step 6：ReAct Agent 主循环

```typescript
// src/agent.ts
import Anthropic from '@anthropic-ai/sdk'
import { registry } from './tools/registry.js'
import { ContextManager } from './context/manager.js'

// 导入工具（触发注册）
import './tools/readFile.js'
import './tools/runCommand.js'
import './tools/searchFiles.js'

const client = new Anthropic()
const contextManager = new ContextManager()

const SYSTEM_PROMPT = `你是 MiniAgent，一个有用的 CLI 助手。

你可以使用以下工具来完成任务：
- read_file: 读取文件内容
- run_command: 执行 Shell 命令
- search_files: 搜索文件

工作原则：
1. 先理解用户需求，制定计划
2. 使用工具获取信息
3. 根据结果调整策略
4. 完成任务后给出清晰的总结

当前工作目录: ${process.cwd()}
`

export async function runAgent(userMessage: string): Promise<void> {
  contextManager.addMessage({ role: 'user', content: userMessage })
  
  const tools = registry.toAPIFormat()
  let turnCount = 0
  const maxTurns = 20
  
  while (turnCount < maxTurns) {
    turnCount++
    contextManager.incrementTurn()
    
    console.log(`\n--- Turn ${turnCount} ---`)
    
    // 调用 Claude API
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages: contextManager.getMessages(),
    })
    
    // 显示文本回复
    for (const block of response.content) {
      if (block.type === 'text') {
        console.log(`\n🤖 Agent: ${block.text}`)
      }
    }
    
    // 检查是否有工具调用
    const toolUses = response.content.filter(b => b.type === 'tool_use')
    
    if (toolUses.length === 0) {
      // 没有工具调用 → 任务完成
      console.log('\n✅ 任务完成')
      break
    }
    
    // 记录 assistant 消息
    contextManager.addMessage({
      role: 'assistant',
      content: response.content,
    })
    
    // 执行工具调用
    const toolResults = []
    for (const toolUse of toolUses) {
      if (toolUse.type !== 'tool_use') continue
      
      console.log(`\n🔧 调用工具: ${toolUse.name}`)
      console.log(`   参数: ${JSON.stringify(toolUse.input)}`)
      
      const tool = registry.get(toolUse.name)
      let result: string
      
      if (!tool) {
        result = `Error: Unknown tool "${toolUse.name}"`
      } else {
        result = await tool.execute(toolUse.input)
      }
      
      console.log(`   结果: ${result.substring(0, 200)}...`)
      
      toolResults.push({
        type: 'tool_result' as const,
        tool_use_id: toolUse.id,
        content: result,
      })
    }
    
    // 添加工具结果
    contextManager.addMessage({
      role: 'user',
      content: toolResults,
    })
  }
  
  // 打印统计
  const stats = contextManager.getStats()
  console.log(`\n📊 统计: ${stats.turns} 轮, ~${stats.tokens} tokens, ${stats.messages} 条消息`)
}
```

### Step 7：入口文件

```typescript
// src/index.ts
import { runAgent } from './agent.js'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

console.log('🤖 MiniAgent v1.0')
console.log('输入你的任务（输入 exit 退出）\n')

function prompt() {
  rl.question('> ', async (input) => {
    const trimmed = input.trim()
    
    if (trimmed === 'exit' || trimmed === 'quit') {
      console.log('再见！')
      rl.close()
      return
    }
    
    if (!trimmed) {
      prompt()
      return
    }
    
    try {
      await runAgent(trimmed)
    } catch (error) {
      console.error('Error:', (error as Error).message)
    }
    
    prompt()
  })
}

prompt()
```

## 🏋️ 扩展挑战

### 挑战 1：添加更多工具（30 分钟）

为 MiniAgent 添加以下工具：
- `write_file`: 写入文件（需要用户确认）
- `web_search`: 模拟网络搜索
- `get_time`: 获取当前时间

### 挑战 2：添加 Ink UI（45 分钟）

用 Ink 替换 console.log，实现：
- 工具调用时显示 Spinner
- 彩色输出（Agent 回复、工具结果、错误分别不同颜色）
- 底部显示实时统计信息

### 挑战 3：添加会话持久化（30 分钟）

将会话历史保存到文件，支持：
- 退出后恢复上次会话
- 导出会话记录为 Markdown

## 🤔 反思问题

1. 这个 MiniAgent 和真正的 Claude Code 相比，缺少了哪些关键功能？
2. 安全检查器目前使用正则表达式，有什么局限性？如何改进？
3. 上下文压缩的"摘要"目前很粗糙，如何让它更智能？
4. 如果你要将这个项目发展为产品，下一步应该做什么？

---

## 📝 Week 1 总结

恭喜完成第一周！回顾我们学到了什么：

| 天数 | 主题 | 关键收获 |
|------|------|---------|
| Day 1 | Agent 概览 | ReAct 循环、5 层架构 |
| Day 2 | Ink 基础 | React for CLI、组件系统 |
| Day 3 | Ink 高级 | 性能优化、流式输出 |
| Day 4 | Tool 系统 | buildTool、Zod 验证 |
| Day 5 | Context | 三级压缩、Prompt Cache |
| Day 6 | BashTool | 安全检查、沙盒、命令分析 |
| Day 7 | 项目 | 综合实践，构建 MiniAgent |

**下周预告**：Week 2 我们将进入核心能力构建阶段，学习文件操作、搜索系统、Agent 任务编排！

## 🔗 导航

- [← Day 6: BashTool 深入](day-06-bash-tool.md)
- [→ Day 8: File Operations](../week-02/day-08-file-operations.md)
- [📊 Week 1 Quiz](quiz-01.json)
