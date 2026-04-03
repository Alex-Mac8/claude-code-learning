# Day 18: 状态管理与 AppState

[← 上一天: 任务系统](./day-17-task-system.md) | [课程首页](../README.md) | [下一天: 成本与性能 →](./day-19-cost-and-performance.md)

---

## 🎯 学习目标

1. 理解 Claude Code 的 **AppState** 设计
2. 掌握 **React Context** 在终端应用中的状态管理
3. 了解**会话恢复**机制
4. 学习**不可变状态更新**模式

**难度:** 🟡 中级 | **预计时间:** 1 小时

---

## 📚 核心概念

### AppState — 全局状态中心

```typescript
// src/state/AppState.ts — 核心状态类型（简化）
export type AppState = {
  // 会话状态
  messages: Message[]
  isLoading: boolean
  
  // 配置
  model: string
  permissionMode: PermissionMode
  tools: Tool[]
  
  // UI 状态
  inputMode: 'normal' | 'vim'
  theme: 'dark' | 'light'
  
  // 运行时
  sessionId: string
  cwd: string
  cost: number
  tokenCount: number
}
```

### Provider 模式

AppState 通过 React Context 提供给整个组件树：

```tsx
// src/state/AppState.ts — Provider
export function AppStateProvider({ initialState, onChangeAppState, children }) {
  const [state, setState] = useState(initialState)
  
  // 状态变化时的回调（用于持久化等）
  useEffect(() => {
    onChangeAppState(state)
  }, [state])
  
  return (
    <AppStateContext.Provider value={{ state, setState }}>
      {children}
    </AppStateContext.Provider>
  )
}

// 任何子组件都可以访问和更新状态
function useAppState() {
  return useContext(AppStateContext)
}
```

### 状态变化监听

```typescript
// src/state/onChangeAppState.ts
// 状态变化时触发的副作用
export function onChangeAppState(newState: AppState, prevState: AppState) {
  // 消息列表变化 → 持久化到磁盘
  if (newState.messages !== prevState.messages) {
    saveSessionTranscript(newState.messages)
  }
  
  // 成本变化 → 更新成本追踪
  if (newState.cost !== prevState.cost) {
    updateCostTracker(newState.cost)
  }
}
```

### 会话恢复

Claude Code 支持恢复之前的会话：

```typescript
// claude --resume <sessionId>
// 从磁盘加载之前的消息历史，恢复对话状态
async function resumeSession(sessionId: string): Promise<AppState> {
  const transcript = await loadSessionTranscript(sessionId)
  return {
    ...defaultState,
    sessionId,
    messages: transcript.messages,
    // 恢复其他状态...
  }
}
```

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **AppState** | 全局应用状态 | 消息、配置、运行时数据 |
| **Context** | React 上下文 | 状态共享机制 |
| **Provider** | 状态提供者 | 包裹组件树，提供状态 |
| **Immutable Update** | 不可变更新 | 创建新对象而不是修改原对象 |
| **Session Resume** | 会话恢复 | 恢复之前的对话 |

---

## 💻 代码示例

### 示例 1: 你的 Agent 状态管理

```typescript
// 简单的状态管理
type AgentState = {
  messages: Message[]
  isRunning: boolean
  model: string
  tokenCount: number
  cost: number
}

class StateManager {
  private state: AgentState
  private listeners: ((state: AgentState) => void)[] = []
  
  constructor(initial: AgentState) {
    this.state = initial
  }
  
  update(partial: Partial<AgentState>) {
    // 不可变更新
    this.state = { ...this.state, ...partial }
    // 通知监听者
    this.listeners.forEach(l => l(this.state))
  }
  
  subscribe(listener: (state: AgentState) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }
  
  getState() { return this.state }
  
  // 持久化
  async save(path: string) {
    await writeFile(path, JSON.stringify(this.state.messages))
  }
  
  // 恢复
  static async restore(path: string): Promise<AgentState> {
    const messages = JSON.parse(await readFile(path, 'utf8'))
    return { messages, isRunning: false, model: 'claude-sonnet', tokenCount: 0, cost: 0 }
  }
}
```

---

## ✏️ 动手练习

### 练习 1: 实现状态持久化 (⏱️ ~20 分钟)

将 Agent 的对话历史保存到 `~/.my-agent/sessions/<id>.json`，支持恢复。

### 练习 2: Ink + Context (⏱️ ~20 分钟)

用 Ink 的 React Context 实现一个全局主题切换（dark/light）。

### 练习 3: 状态快照 (⏱️ ~15 分钟)

实现状态快照功能：在关键操作前保存状态，出错时可以回滚。

---

## 📖 扩展阅读

1. **React Context 文档**
   - 🔗 https://react.dev/reference/react/useContext

---

## 🤔 思考题

1. 为什么用不可变更新模式？直接修改状态有什么问题？
2. 状态持久化应该同步还是异步？各有什么优缺点？
3. 会话恢复后，之前的工具调用还能重新执行吗？

---

## ➡️ 下一步

**明天：** [Day 19 — 成本与性能](./day-19-cost-and-performance.md)

[← 上一天: 任务系统](./day-17-task-system.md) | [课程首页](../README.md) | [下一天: 成本与性能 →](./day-19-cost-and-performance.md)
