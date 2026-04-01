# Day 10: Agent Task System

> "复杂任务的秘诀：分而治之"

## 🎯 学习目标

1. 理解 Task 类型系统（7 种任务类型）
2. 掌握 TaskCreate、TaskGet、TaskList 等任务管理工具
3. 学会 LocalAgentTask 的工作原理
4. 理解任务状态机和生命周期

## 📖 核心概念

### 任务类型

```typescript
// src/Task.ts
export type TaskType =
  | 'local_bash'           // 本地 Shell 任务
  | 'local_agent'          // 本地 Agent 子任务
  | 'remote_agent'         // 远程 Agent 任务
  | 'in_process_teammate'  // 进程内协作者
  | 'local_workflow'       // 本地工作流
  | 'monitor_mcp'          // MCP 监控任务
  | 'dream'                // 后台整理任务（Dream Agent）
```

### 任务状态机

```
pending → running → completed
                  → failed
                  → killed

每个任务都有唯一的 ID 前缀：
  b-xxxxx  → local_bash
  a-xxxxx  → local_agent
  r-xxxxx  → remote_agent
  t-xxxxx  → in_process_teammate
  w-xxxxx  → local_workflow
  m-xxxxx  → monitor_mcp
  d-xxxxx  → dream
```

```typescript
// 任务 ID 生成
export function generateTaskId(type: TaskType): string {
  const prefix = TASK_ID_PREFIXES[type] ?? 'x'
  const bytes = randomBytes(8)
  // 使用 36 字符字母表（0-9 + a-z）
  let id = prefix + '-'
  for (const byte of bytes) {
    id += TASK_ID_ALPHABET[byte % 36]
  }
  return id
}
```

### 任务状态基础

```typescript
// src/Task.ts
export type TaskStateBase = {
  id: string              // 唯一任务 ID
  type: TaskType          // 任务类型
  status: TaskStatus      // pending | running | completed | failed | killed
  description: string     // 人类可读的描述
  toolUseId?: string      // 关联的工具调用 ID
  startTime: number       // 开始时间
  endTime?: number        // 结束时间
  totalPausedMs?: number  // 暂停总时长
  outputFile: string      // 输出文件路径
  outputOffset: number    // 输出偏移量
  notified: boolean       // 是否已通知用户
}
```

### TaskCreate 工具

Agent 通过 TaskCreate 工具创建子任务：

```typescript
// src/tools/TaskCreateTool/
// Agent 调用示例：
{
  name: "TaskCreate",
  input: {
    type: "local_agent",
    description: "分析 src/tools/ 目录下所有工具的代码质量",
    prompt: "请分析以下目录中每个工具的代码质量..."
  }
}
```

### 子 Agent 执行流程

```
主 Agent
  │
  ├── TaskCreate("分析代码质量")
  │     │
  │     ▼
  │   子 Agent 启动
  │     ├── 读文件
  │     ├── 执行 lint
  │     ├── 生成报告
  │     └── 完成 → 输出保存到 outputFile
  │
  ├── TaskGet(taskId)  ← 检查进度
  │     └── status: "running"
  │
  ├── TaskOutput(taskId) ← 获取输出
  │     └── "已分析 15/30 个文件..."
  │
  └── TaskGet(taskId) ← 最终检查
        └── status: "completed"
```

## 🔧 关键技术

### 1. 任务上下文隔离

每个子 Agent 有独立的上下文：

```typescript
// 创建子 Agent 上下文
function createSubagentContext(
  parentContext: ToolUseContext,
  task: TaskStateBase,
): ToolUseContext {
  return {
    ...parentContext,
    // 新的 abort controller
    abortController: new AbortController(),
    // 独立的文件状态缓存
    readFileState: cloneFileStateCache(parentContext.readFileState),
    // 子 Agent ID
    agentId: generateAgentId(),
    // 消息历史从空开始
    messages: [],
  }
}
```

### 2. 任务输出管理

```typescript
// src/utils/task/TaskOutput.ts
export class TaskOutput {
  private filePath: string
  private buffer: string[] = []
  
  constructor(taskId: string) {
    this.filePath = getTaskOutputPath(taskId)
  }
  
  append(text: string): void {
    this.buffer.push(text)
    // 定期刷新到磁盘
    if (this.buffer.length > 10) {
      this.flush()
    }
  }
  
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return
    await appendFile(this.filePath, this.buffer.join(''))
    this.buffer = []
  }
  
  async read(offset?: number): Promise<string> {
    await this.flush()
    const content = await readFile(this.filePath, 'utf-8')
    return offset ? content.slice(offset) : content
  }
}
```

### 3. 终端状态判断

```typescript
export function isTerminalTaskStatus(status: TaskStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'killed'
}

// 用于：
// 1. 防止向已完成的任务注入消息
// 2. 从 AppState 清理已完成任务
// 3. 孤儿任务清理
```

## 💻 代码示例

### 实现简单的任务管理器

```typescript
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

interface Task {
  id: string
  description: string
  status: TaskStatus
  output: string[]
  startTime: number
  endTime?: number
}

class TaskManager {
  private tasks: Map<string, Task> = new Map()
  private idCounter = 0
  
  create(description: string): string {
    const id = `task-${++this.idCounter}`
    this.tasks.set(id, {
      id,
      description,
      status: 'pending',
      output: [],
      startTime: Date.now(),
    })
    return id
  }
  
  async run(id: string, fn: (log: (msg: string) => void) => Promise<void>): Promise<void> {
    const task = this.tasks.get(id)
    if (!task) throw new Error(`Task not found: ${id}`)
    
    task.status = 'running'
    
    try {
      await fn((msg) => task.output.push(msg))
      task.status = 'completed'
    } catch (error) {
      task.output.push(`Error: ${(error as Error).message}`)
      task.status = 'failed'
    } finally {
      task.endTime = Date.now()
    }
  }
  
  get(id: string): Task | undefined {
    return this.tasks.get(id)
  }
  
  list(filter?: TaskStatus): Task[] {
    const all = Array.from(this.tasks.values())
    return filter ? all.filter(t => t.status === filter) : all
  }
  
  kill(id: string): boolean {
    const task = this.tasks.get(id)
    if (!task || task.status !== 'running') return false
    task.status = 'failed'
    task.endTime = Date.now()
    task.output.push('[Killed by user]')
    return true
  }
}

// 使用
const manager = new TaskManager()
const taskId = manager.create('分析代码质量')

await manager.run(taskId, async (log) => {
  log('开始扫描文件...')
  await new Promise(r => setTimeout(r, 1000))
  log('发现 15 个文件')
  log('分析完成')
})

console.log(manager.get(taskId))
```

## 🏋️ 练习任务

### 练习 1：任务状态机（15 分钟）
画出完整的任务状态转换图，标明每个转换的触发条件。

### 练习 2：并行任务执行器（25 分钟）
扩展上面的 TaskManager，支持并行执行多个任务，并限制最大并发数。

### 练习 3：探索源码（20 分钟）
在 Claude Code 源码中找到 TaskCreateTool 的实现，分析它如何创建子 Agent。

## 📚 扩展阅读

1. **[状态机设计模式](https://refactoring.guru/design-patterns/state)** - 状态模式详解
2. **[Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)** - 并行任务
3. **[Process Manager Pattern](https://www.enterpriseintegrationpatterns.com/ProcessManager.html)** - 进程管理模式

## 🤔 反思问题

1. 为什么需要 7 种不同的任务类型？它们的使用场景分别是什么？
2. Dream Agent（后台整理任务）的作用是什么？什么时候会触发？
3. 子 Agent 的上下文为什么要从空开始？共享父 Agent 的上下文会有什么问题？

---

## 📝 今日总结

✅ 7 种任务类型和 ID 前缀系统  
✅ 任务状态机（pending → running → completed/failed/killed）  
✅ TaskCreate/TaskGet/TaskList 工具  
✅ 子 Agent 上下文隔离  
✅ 任务输出管理和磁盘持久化  

**明天预告**：Day 11 深入 QueryEngine — API 调用、流式响应和错误处理！

## 🔗 导航

- [← Day 9: Glob & Grep](day-09-glob-grep.md)
- [→ Day 11: QueryEngine](day-11-query-engine.md)
- [📊 Week 2 Quiz](quiz-02.json)
