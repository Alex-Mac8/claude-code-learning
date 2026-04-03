# Day 17: 任务系统与后台执行

[← 上一天: MCP 集成](./day-16-mcp-integration.md) | [课程首页](../README.md) | [下一天: 状态管理 →](./day-18-state-management.md)

---

## 🎯 学习目标

1. 理解 Claude Code 的**任务（Task）系统**设计
2. 掌握**前台/后台任务**的管理
3. 了解 **Task 生命周期**和进度通知
4. 学习**长时间运行任务**的处理策略

**难度:** 🔴 高级 | **预计时间:** 1 小时

---

## 📚 核心概念

### 为什么需要任务系统？

Agent 执行的操作不都是瞬间完成的。`npm install` 可能要几分钟，`git clone` 可能要更长。任务系统让 Agent 能**管理长时间运行的操作**：

```
src/tasks/
├── LocalShellTask/     # 本地 Shell 任务（前台/后台命令）
├── LocalAgentTask/     # 本地 Agent 任务（子 Agent）
├── RemoteAgentTask/    # 远程 Agent 任务
└── InProcessTeammateTask/  # 进程内队友任务
```

### Task.ts — 任务接口

```typescript
// src/Task.ts — 任务核心定义
export type Task = {
  id: string
  type: 'shell' | 'agent' | 'remote'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  
  // 进度追踪
  progress?: {
    current: number
    total: number
    message: string
  }
  
  // 输出管理
  output: string
  
  // 生命周期
  startTime: number
  endTime?: number
}
```

### 前台与后台

```typescript
// 前台任务：用户可以看到输出、可以中断
registerForeground(taskId)
// UI 显示实时输出和进度

// 后台任务：静默运行
// 长命令（>2秒）显示 "按 b 转入后台" 提示
// 或自动后台化（>2分钟）
backgroundExistingForegroundTask(taskId)

// 后台任务完成后通知
markTaskNotified(taskId)
```

### 任务工具

Claude Code 提供了一组任务管理工具：

```typescript
// src/tools/ — 任务相关工具
TaskCreateTool  // 创建新任务
TaskListTool    // 列出所有任务
TaskGetTool     // 获取任务详情
TaskUpdateTool  // 更新任务状态
TaskStopTool    // 停止任务
TaskOutputTool  // 获取任务输出
```

Agent 可以用这些工具来管理并行工作流：

```
Claude: "我来并行处理这三个文件"
  ├─ TaskCreate: "格式化 file1.ts"
  ├─ TaskCreate: "格式化 file2.ts"  
  └─ TaskCreate: "格式化 file3.ts"
  │
  ▼ 等待完成
  TaskList → 检查所有任务状态
  TaskOutput → 获取每个任务的结果
```

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **Task** | 可管理的执行单元 | Shell 命令、子 Agent |
| **Foreground** | 前台任务 | 用户可看到和中断 |
| **Background** | 后台任务 | 静默执行、完成通知 |
| **Progress** | 进度追踪 | 当前/总量/消息 |
| **TaskOutput** | 任务输出 | 持久化到磁盘 |

---

## 💻 代码示例

### 示例 1: 简单的任务系统

```typescript
class TaskManager {
  private tasks = new Map<string, Task>()
  
  create(type: string, params: unknown): string {
    const id = crypto.randomUUID()
    this.tasks.set(id, {
      id, type, status: 'pending',
      output: '', startTime: Date.now()
    })
    return id
  }
  
  async run(id: string, fn: () => Promise<string>) {
    const task = this.tasks.get(id)!
    task.status = 'running'
    try {
      task.output = await fn()
      task.status = 'completed'
    } catch (e) {
      task.output = (e as Error).message
      task.status = 'failed'
    }
    task.endTime = Date.now()
  }
  
  list() { return Array.from(this.tasks.values()) }
  get(id: string) { return this.tasks.get(id) }
  stop(id: string) { /* AbortController */ }
}
```

---

## ✏️ 动手练习

### 练习 1: 实现任务管理器 (⏱️ ~25 分钟)

实现上面的 TaskManager，添加并行执行和超时支持。

### 练习 2: 进度显示 (⏱️ ~15 分钟)

用 Ink 实现任务进度条：`[████████░░] 80% — 正在编译...`

### 练习 3: 分析 LocalShellTask (⏱️ ~15 分钟)

阅读 `src/tasks/LocalShellTask/`，理解前台→后台的切换逻辑。

---

## 📖 扩展阅读

1. **后台任务中文解析**
   - 🔗 `~/Repos/cloud-code-study/docs/guide/08-background-task.md`

---

## 🤔 思考题

1. 任务失败时，Agent 应该自动重试还是报告给用户？
2. 如何限制并行任务数量？太多并行任务会导致什么问题？
3. 后台任务的输出应该存在哪里？内存 vs 磁盘？

---

## ➡️ 下一步

**明天：** [Day 18 — 状态管理](./day-18-state-management.md)

[← 上一天: MCP 集成](./day-16-mcp-integration.md) | [课程首页](../README.md) | [下一天: 状态管理 →](./day-18-state-management.md)
