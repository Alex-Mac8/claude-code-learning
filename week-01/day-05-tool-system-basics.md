# Day 05: Tool 系统基础 — 注册、定义与执行

[← 上一天: REPL 与输入](./day-04-repl-and-input.md) | [课程首页](../README.md) | [下一天: 消息类型 →](./day-06-message-types.md)

---

## 🎯 学习目标

1. 掌握 `Tool.ts` 中的 **Tool 接口**完整定义
2. 理解 Tool 的**生命周期**：注册 → 校验 → 权限 → 执行 → 结果
3. 学习 `buildTool()` 工厂函数的设计模式
4. 实现一个自己的 Tool

**难度:** 🟡 中级 | **预计时间:** 1 小时（25 分钟阅读 + 35 分钟动手）

---

## 📚 核心概念

### Tool 接口 — 一切工具的基石

Claude Code 有 30+ 种工具，但它们都基于同一个接口。打开 `Tool.ts`，核心定义：

```typescript
// src/Tool.ts — ToolDef 核心字段
export type ToolDef = {
  // 基本信息
  name: string              // 工具名，如 "Bash"、"Read"
  description: string       // 给 Claude 的描述（决定 Claude 何时调用）
  inputSchema: ToolInputJSONSchema  // JSON Schema 定义参数
  
  // 执行
  call: (input, context: ToolUseContext) => Promise<ToolResultBlockParam>
  
  // 权限
  isReadOnly: () => boolean
  needsPermission?: (input) => Promise<PermissionResult>
  
  // UI 渲染
  renderToolUseMessage?: (input) => React.ReactNode
  renderToolResultMessage?: (result) => React.ReactNode
  
  // 验证
  validateInput?: (input) => ValidationResult
}
```

**关键洞察：** `description` 不是给人看的——它是给 Claude 看的。Claude 根据 description 决定什么时候调用哪个工具。写好 description 直接决定 Agent 的行为质量。

### buildTool() 工厂函数

Claude Code 不直接导出 ToolDef 对象，而是用 `buildTool()` 封装：

```typescript
// buildTool 将原始定义转换为完整的 Tool 对象
export function buildTool(def: ToolDef): Tool {
  return {
    ...def,
    // 添加默认行为
    isReadOnly: def.isReadOnly ?? (() => false),
    // 包装 call 函数：添加日志、计时、错误处理
    call: async (input, context) => {
      const startTime = Date.now()
      try {
        return await def.call(input, context)
      } catch (error) {
        // 统一错误处理
        return buildErrorResult(error)
      } finally {
        logToolDuration(def.name, Date.now() - startTime)
      }
    }
  }
}
```

### Tool 执行生命周期

```
Claude 决定调用工具
     │
     ▼
1. validateInput(input)      → 参数校验
     │
     ▼
2. needsPermission(input)    → 需要用户授权？
     │  ├─ 需要 → 显示权限对话框 → 用户确认/拒绝
     │  └─ 不需要 → 继续
     │
     ▼
3. renderToolUseMessage()    → UI 显示 "正在执行..."
     │
     ▼
4. call(input, context)      → 实际执行
     │
     ▼
5. renderToolResultMessage() → UI 显示结果
     │
     ▼
结果返回给 Claude → 决定下一步
```

### 工具池组装

`tools.ts` 中的 `assembleToolPool()` 根据配置动态决定哪些工具可用：

```typescript
// src/tools.ts — 工具池组装（简化）
export function assembleToolPool(config) {
  const tools = [
    // 核心工具：永远可用
    BashTool,
    FileReadTool,
    FileEditTool,
    FileWriteTool,
    GlobTool,
    GrepTool,
    
    // 条件工具
    ...(config.webSearch ? [WebSearchTool] : []),
    ...(config.agentMode ? [AgentTool] : []),
    ...(config.taskMode ? [TaskCreateTool, TaskListTool] : []),
  ]
  
  // 过滤掉用户禁用的工具
  return tools.filter(t => !config.disabledTools.includes(t.name))
}
```

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **ToolDef** | 工具定义类型 | 包含 name、description、call 等 |
| **inputSchema** | 参数 JSON Schema | `{ type: 'object', properties: { command: { type: 'string' } } }` |
| **ToolUseContext** | 工具执行上下文 | 包含 cwd、权限模式、取消信号等 |
| **ToolResultBlockParam** | 工具返回值类型 | `{ type: 'tool_result', content: '...' }` |
| **buildTool** | 工具工厂函数 | 将 ToolDef 转为完整 Tool |
| **isReadOnly** | 是否只读操作 | `FileReadTool` 是只读，`BashTool` 不是 |

---

## 💻 代码示例

### 示例 1: 实际的 GrepTool 定义

```typescript
// src/tools/GrepTool/GrepTool.ts — 真实的 Claude Code 工具
export const GrepTool = buildTool({
  name: 'Grep',
  
  description: `Search for a pattern in files using ripgrep.
Results are returned with line numbers.
By default searches current directory recursively.`,
  
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'The regex pattern to search for'
      },
      path: {
        type: 'string',
        description: 'Directory or file to search in'
      },
      include: {
        type: 'string',
        description: 'File pattern to include (e.g., "*.ts")'
      }
    },
    required: ['pattern']
  },
  
  isReadOnly: () => true,  // 搜索是只读操作
  
  async call(input, context) {
    const { pattern, path, include } = input
    const result = await exec('rg', [
      '--line-number',
      pattern,
      path || '.',
      ...(include ? ['--glob', include] : [])
    ])
    return { type: 'tool_result', content: result.stdout }
  }
})
```

### 示例 2: 实现你自己的 Tool

```typescript
// 示例：一个翻译工具
const TranslateTool = buildTool({
  name: 'Translate',
  
  description: '将文本翻译成目标语言。用于需要翻译文档或消息时。',
  
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '要翻译的文本' },
      targetLang: { type: 'string', description: '目标语言代码（zh/en/ja 等）' }
    },
    required: ['text', 'targetLang']
  },
  
  isReadOnly: () => true,
  
  async call(input) {
    // 调用翻译 API
    const translated = await translateAPI(input.text, input.targetLang)
    return {
      type: 'tool_result',
      content: `翻译结果：\n${translated}`
    }
  }
})
```

---

## ✏️ 动手练习

### 练习 1: 分析 Tool 描述 (⏱️ ~10 分钟)

打开 `src/tools/` 中的 5 个不同工具，比较它们的 `description`。思考：哪些描述写得好？为什么？

### 练习 2: 实现一个 Tool (⏱️ ~25 分钟)

实现一个 `WordCountTool`：
- name: "WordCount"
- 接收 `filePath` 参数
- 返回文件的行数、单词数、字符数
- 设置为 `isReadOnly: true`

### 练习 3: 工具链设计 (⏱️ ~15 分钟)

思考并设计：如果 Claude 要"统计项目中所有 TypeScript 文件的总行数"，它需要按什么顺序调用哪些工具？画出工具调用链。

---

## 📖 扩展阅读

1. **Anthropic Tool Use 文档**
   - 🔗 https://docs.anthropic.com/en/docs/build-with-claude/tool-use
   - 推荐：官方 Tool Use 设计理念

2. **JSON Schema 入门**
   - 🔗 https://json-schema.org/learn/getting-started-step-by-step
   - 推荐：理解 inputSchema 的写法

---

## 🤔 思考题

1. **理解：** 为什么 `description` 对 Agent 行为如此重要？一个模糊的 description 会导致什么问题？
2. **应用：** 如果你要给 Agent 添加"发送邮件"工具，`needsPermission` 应该怎么实现？
3. **思辨：** Claude Code 有 30+ 工具，但工具越多，Claude 选择正确工具的难度也越大。你怎么看这个权衡？

---

## ➡️ 下一步

**明天：** [Day 06 — 消息类型](./day-06-message-types.md) — 理解 Claude Code 中各种消息类型和对话流的设计。

**继续前请确认：**
- [ ] 我能写出一个 ToolDef 的完整定义
- [ ] 我理解 Tool 的生命周期
- [ ] 我知道 `description` 为什么重要
- [ ] 我实现了自己的第一个 Tool

[← 上一天: REPL 与输入](./day-04-repl-and-input.md) | [课程首页](../README.md) | [下一天: 消息类型 →](./day-06-message-types.md)
