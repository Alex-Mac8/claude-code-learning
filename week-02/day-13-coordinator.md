# Day 13: Coordinator Mode

> "一个人做不完的事，一个团队可以"

## 🎯 学习目标

1. 理解 Coordinator Mode 的架构设计
2. 掌握多 Agent 协调的工作分配策略
3. 学会子 Agent 通信和结果汇总
4. 理解 AgentTool 的完整实现

## 📖 核心概念

### Coordinator 架构

```
                    ┌──────────────┐
                    │ Coordinator  │  主 Agent
                    │ (协调者)      │  负责任务分解和结果汇总
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼─────┐ ┌───▼─────┐
        │ Worker 1  │ │ Worker 2│ │ Worker 3│
        │ (文件分析) │ │ (测试)   │ │ (文档)   │
        └───────────┘ └─────────┘ └─────────┘
```

### AgentTool：创建子 Agent

```typescript
// src/tools/AgentTool/AgentTool.tsx
// Agent 调用 AgentTool 来创建子 Agent

const AgentTool = buildTool({
  name: 'Agent',
  description: `Launch a new agent to work on a subtask.
    Use this for tasks that can be parallelized or 
    require independent context.`,
  
  inputSchema: () => z.strictObject({
    prompt: z.string().describe('子 Agent 的任务描述'),
    // 可选：指定 Agent 类型
    type: z.string().optional(),
  }),
  
  async call(input, context) {
    // 创建子 Agent 上下文
    const subContext = createSubagentContext(context)
    
    // 运行子 Agent
    const result = await runAgent({
      prompt: input.prompt,
      context: subContext,
      tools: context.options.tools,
    })
    
    return { data: result }
  },
})
```

### Coordinator 用户上下文

```typescript
// src/coordinator/coordinatorMode.ts
export function getCoordinatorUserContext(
  mcpClients: ReadonlyArray<{ name: string }>,
  scratchpadDir?: string,
): { [k: string]: string } {
  return {
    coordination_instructions: `
      You are operating in Coordinator Mode.
      
      Your role:
      1. Break complex tasks into independent subtasks
      2. Assign subtasks to worker agents via AgentTool
      3. Monitor progress and collect results
      4. Synthesize final output
      
      Guidelines:
      - Each worker should have a clear, focused task
      - Workers share the file system but not conversation context
      - Use scratchpad (${scratchpadDir}) for inter-agent communication
      - Prefer parallel execution when tasks are independent
    `,
  }
}
```

### 工作分配策略

```
复杂任务分解示例："重构这个项目的错误处理"

Coordinator 分析后创建 3 个子任务：

Worker 1: 分析现有错误处理模式
  → 搜索所有 try/catch
  → 统计错误处理方式
  → 输出分析报告

Worker 2: 设计统一的错误处理方案
  → 基于 Worker 1 的报告（通过 scratchpad 共享）
  → 设计错误类层次
  → 输出设计文档

Worker 3: 实施重构
  → 基于 Worker 2 的设计
  → 修改所有相关文件
  → 运行测试验证
```

## 🔧 关键技术

### 1. 子 Agent 上下文创建

```typescript
// src/tools/AgentTool/forkSubagent.ts
function createSubagentContext(parentContext: ToolUseContext): ToolUseContext {
  return {
    ...parentContext,
    
    // 新的中断控制器
    abortController: new AbortController(),
    
    // 克隆文件状态缓存（共享读取历史）
    readFileState: cloneFileStateCache(parentContext.readFileState),
    
    // 独立的 Agent ID
    agentId: generateAgentId(),
    
    // 空的消息历史
    messages: [],
    
    // 共享 System Prompt（为了 Prompt Cache）
    renderedSystemPrompt: parentContext.renderedSystemPrompt,
    
    // 权限：子 Agent 自动拒绝权限提示
    toolPermissionContext: {
      ...parentContext.toolPermissionContext,
      shouldAvoidPermissionPrompts: true,
    },
  }
}
```

### 2. Scratchpad 通信

子 Agent 之间通过文件系统中的 scratchpad 目录通信：

```typescript
// 协调者通过 scratchpad 传递信息
async function coordinateWork(task: string) {
  const scratchpad = getScratchpadDir()
  
  // Worker 1 的输出作为 Worker 2 的输入
  await runWorker({
    prompt: `分析代码并将报告保存到 ${scratchpad}/analysis.md`,
  })
  
  // Worker 2 读取 Worker 1 的输出
  await runWorker({
    prompt: `读取 ${scratchpad}/analysis.md，基于此设计方案`,
  })
}
```

### 3. 结果汇总

```typescript
// Coordinator 汇总所有 Worker 的结果
async function summarizeResults(workerResults: string[]): Promise<string> {
  const summary = await callClaude({
    system: 'Synthesize these worker results into a coherent summary',
    messages: [{
      role: 'user',
      content: workerResults.map((r, i) => 
        `Worker ${i + 1} result:\n${r}`
      ).join('\n\n---\n\n')
    }]
  })
  
  return summary
}
```

### 4. Agent 记忆快照

```typescript
// src/tools/AgentTool/agentMemory.ts
// 子 Agent 可以读取父 Agent 的记忆快照
export function agentMemorySnapshot(
  parentMessages: Message[],
  maxTokens: number = 2000,
): string {
  // 提取关键决策和发现
  const keyMessages = parentMessages
    .filter(m => m.role === 'assistant' && m.content.length > 50)
    .slice(-5)  // 最近 5 条
  
  return keyMessages
    .map(m => `[Parent Agent] ${summarize(m.content)}`)
    .join('\n')
}
```

## 💻 代码示例

### 实现简单的 Coordinator

```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

interface WorkerTask {
  id: string
  prompt: string
  status: 'pending' | 'running' | 'done' | 'failed'
  result?: string
}

class SimpleCoordinator {
  private workers: WorkerTask[] = []
  
  addTask(prompt: string): string {
    const id = `worker-${this.workers.length + 1}`
    this.workers.push({ id, prompt, status: 'pending' })
    return id
  }
  
  async runAll(maxConcurrency = 3): Promise<Map<string, string>> {
    const results = new Map<string, string>()
    
    // 并行执行（限制并发数）
    const batches = []
    for (let i = 0; i < this.workers.length; i += maxConcurrency) {
      batches.push(this.workers.slice(i, i + maxConcurrency))
    }
    
    for (const batch of batches) {
      const promises = batch.map(async (worker) => {
        worker.status = 'running'
        console.log(`🚀 启动 ${worker.id}: ${worker.prompt.slice(0, 50)}...`)
        
        try {
          const response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            messages: [{ role: 'user', content: worker.prompt }],
          })
          
          const result = response.content
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('')
          
          worker.status = 'done'
          worker.result = result
          results.set(worker.id, result)
          console.log(`✅ ${worker.id} 完成`)
        } catch (error) {
          worker.status = 'failed'
          console.log(`❌ ${worker.id} 失败: ${(error as Error).message}`)
        }
      })
      
      await Promise.all(promises)
    }
    
    return results
  }
  
  async synthesize(results: Map<string, string>): Promise<string> {
    const combined = Array.from(results.entries())
      .map(([id, result]) => `## ${id}\n${result}`)
      .join('\n\n')
    
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `请汇总以下子任务的结果：\n\n${combined}`
      }],
    })
    
    return response.content.filter(b => b.type === 'text').map(b => b.text).join('')
  }
}

// 使用
const coordinator = new SimpleCoordinator()
coordinator.addTask('分析 src/ 目录的文件结构')
coordinator.addTask('统计代码行数和文件类型分布')
coordinator.addTask('找出所有 TODO 和 FIXME 注释')

const results = await coordinator.runAll(3)
const summary = await coordinator.synthesize(results)
console.log('\n📊 汇总报告：\n', summary)
```

## 🏋️ 练习任务

### 练习 1：设计工作分解（15 分钟）
给定任务"审查一个 Express.js 项目的安全性"，设计 4 个独立的子任务。

### 练习 2：实现并行 Worker（25 分钟）
扩展上面的 SimpleCoordinator，添加：依赖关系（Worker B 等待 Worker A 完成）。

### 练习 3：探索 AgentTool（20 分钟）
在源码中找到 `runAgent` 函数，分析子 Agent 如何获得自己的工具集。

## 📚 扩展阅读

1. **[Multi-Agent Systems](https://arxiv.org/abs/2308.08155)** - 多 Agent 系统综述
2. **[Map-Reduce Pattern](https://en.wikipedia.org/wiki/MapReduce)** - 分布式计算模式
3. **[Fan-out/Fan-in Pattern](https://www.enterpriseintegrationpatterns.com/Aggregator.html)** - 扇出扇入模式

## 🤔 反思问题

1. Coordinator Mode 什么时候比单 Agent 更有效？什么时候反而更慢？
2. 子 Agent 的权限为什么设为"自动拒绝"而不是"继承父 Agent"？
3. 通过 scratchpad 文件通信有什么优缺点？有没有更好的方案？

---

## 📝 今日总结

✅ Coordinator Mode 的架构设计  
✅ AgentTool 和子 Agent 创建  
✅ 工作分配和并行执行  
✅ Scratchpad 通信机制  
✅ 结果汇总和合成  

**明天预告**：Day 14 是 Week 2 项目 — 构建文件处理 Agent！

## 🔗 导航

- [← Day 12: Message & UI](day-12-message-ui.md)
- [→ Day 14: Week 2 项目](day-14-week2-project.md)
- [📊 Week 2 Quiz](quiz-02.json)
