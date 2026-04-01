# Day 4: Tool System 基础

> "工具是 Agent 的手和脚 — 没有工具，Agent 只是一个会说话的模型" 

## 🎯 学习目标

完成今天的学习后，你将能够：

1. 理解 Tool 接口的完整定义（name、inputSchema、call 等）
2. 掌握 `buildTool()` 工厂函数的工作原理
3. 学会使用 Zod 进行参数验证
4. 理解工具注册和发现机制
5. 实现一个自定义工具并集成到 Agent 中

## 📖 核心概念

### Tool 接口的全貌

在 Claude Code 中，每个工具都是一个符合 `Tool` 类型的对象。打开 `src/Tool.ts`（792 行），你会看到一个非常丰富的接口定义：

```typescript
export type Tool<
  Input extends AnyObject = AnyObject,
  Output = unknown,
  P extends ToolProgressData = ToolProgressData,
> = {
  readonly name: string
  aliases?: string[]
  searchHint?: string
  readonly inputSchema: Input
  maxResultSizeChars: number
  
  // 核心方法
  call(
    args: z.infer<Input>,
    context: ToolUseContext,
    canUseTool: CanUseToolFn,
    parentMessage: AssistantMessage,
    onProgress?: ToolCallProgress<P>,
  ): Promise<ToolResult<Output>>
  
  description(
    input: z.infer<Input>,
    options: { isNonInteractiveSession: boolean; tools: Tools }
  ): Promise<string>
  
  // 安全与权限
  checkPermissions(input, context): Promise<PermissionResult>
  validateInput?(input, context): Promise<ValidationResult>
  
  // 行为标记
  isConcurrencySafe(input: z.infer<Input>): boolean
  isEnabled(): boolean
  isReadOnly(input: z.infer<Input>): boolean
  isDestructive?(input: z.infer<Input>): boolean
  
  // UI 和搜索相关
  isSearchOrReadCommand?(input): { isSearch: boolean; isRead: boolean }
  interruptBehavior?(): 'cancel' | 'block'
  readonly shouldDefer?: boolean
}
```

**关键设计原则**：

1. **泛型参数**：`Input`（输入类型）、`Output`（输出类型）、`P`（进度事件类型）都是泛型，保证类型安全
2. **只读标记**：`name` 和 `inputSchema` 是 `readonly`，防止运行时意外修改
3. **可选方法**：`validateInput`、`isDestructive` 等是可选的，不是每个工具都需要

### buildTool：工厂函数

Claude Code 不直接创建 Tool 对象，而是使用 `buildTool()` 工厂函数：

```typescript
// 来自 src/Tool.ts
export type ToolDef<
  Input extends AnyObject,
  Output,
  P extends ToolProgressData = ToolProgressData,
> = Omit<Tool<Input, Output, P>, 'inputSchema'> & {
  inputSchema: Input | (() => Input)
}

export function buildTool<Input, Output, P>(
  def: ToolDef<Input, Output, P>
): Tool<Input, Output, P> {
  // 处理 lazy schema
  const inputSchema = typeof def.inputSchema === 'function'
    ? def.inputSchema()
    : def.inputSchema
  
  return { ...def, inputSchema }
}
```

**为什么用工厂函数？**

- **Lazy Schema**：`inputSchema` 可以传函数，延迟创建 Zod schema，减少启动时间
- **默认值注入**：可以为缺失的可选方法填充默认实现
- **类型推断**：TypeScript 可以从参数推断出完整的 Tool 类型

### Zod：参数验证的守门员

Claude Code 使用 [Zod](https://zod.dev/) 进行参数验证。每个工具的 `inputSchema` 都是一个 Zod schema：

```typescript
// GlobTool 的输入 schema
const inputSchema = lazySchema(() =>
  z.strictObject({
    pattern: z.string()
      .describe('The glob pattern to match files against'),
    path: z.string()
      .optional()
      .describe('The directory to search in'),
  }),
)

// GrepTool 的输入 schema - 更复杂
const inputSchema = lazySchema(() =>
  z.strictObject({
    pattern: z.string()
      .describe('The regular expression pattern to search for'),
    path: z.string().optional()
      .describe('File or directory to search in'),
    glob: z.string().optional()
      .describe('Glob pattern to filter files (e.g. "*.js")'),
    output_mode: z.enum(['content', 'files_with_matches', 'count'])
      .optional()
      .describe('Output mode'),
  }),
)
```

**`lazySchema` 的作用**：

```typescript
// 延迟创建 schema，避免启动时创建所有 40+ 工具的 schema
function lazySchema<T>(factory: () => T): () => T {
  let cached: T | undefined
  return () => {
    if (!cached) cached = factory()
    return cached
  }
}
```

### 工具注册与发现

Claude Code 中的工具通过 `tools.ts` 文件统一注册：

```typescript
// src/tools.ts - 工具注册中心
import { BashTool } from './tools/BashTool/BashTool.js'
import { FileReadTool } from './tools/FileReadTool/FileReadTool.js'
import { FileWriteTool } from './tools/FileWriteTool/FileWriteTool.js'
import { GlobTool } from './tools/GlobTool/GlobTool.js'
import { GrepTool } from './tools/GrepTool/GrepTool.js'
// ... 40+ 工具导入

export function getTools(): Tools {
  return [
    BashTool,
    FileReadTool,
    FileWriteTool,
    GlobTool,
    GrepTool,
    // ... 所有工具
  ].filter(tool => tool.isEnabled())
}
```

**ToolSearch 延迟加载机制**：

```typescript
// 并非所有工具都需要一开始就加载
// shouldDefer = true 的工具只在 ToolSearch 匹配到时才加载
export const GlobTool = buildTool({
  name: 'Glob',
  searchHint: 'find files by name pattern or wildcard',
  shouldDefer: false,  // 常用工具，立即加载
  // ...
})

export const NotebookEditTool = buildTool({
  name: 'NotebookEdit',
  searchHint: 'jupyter notebook cell edit',
  shouldDefer: true,   // 不常用，延迟加载
  // ...
})
```

## 🔧 关键技术

### 1. ToolResult 返回值

工具执行后返回 `ToolResult<T>` 类型：

```typescript
export type ToolResult<T> = {
  data: T                    // 工具输出数据
  newMessages?: Message[]    // 可选：需要注入的新消息
  contextModifier?: (ctx: ToolUseContext) => ToolUseContext  // 可选：修改上下文
}
```

实际使用示例（GlobTool 简化版）：

```typescript
async call(input, context) {
  const results = await glob(input.pattern, { cwd: input.path })
  
  return {
    data: {
      durationMs: Date.now() - startTime,
      numFiles: results.length,
      filenames: results,
      truncated: results.length > 100,
    }
  }
}
```

### 2. 权限检查流程

每个工具都必须实现 `checkPermissions`：

```typescript
// 权限检查的三种结果
type PermissionResult = 
  | { behavior: 'allow' }           // 自动允许
  | { behavior: 'ask'; message: string }  // 需要询问用户
  | { behavior: 'deny'; message: string } // 自动拒绝

// 文件工具的权限检查
async checkPermissions(input, context) {
  const decision = checkReadPermissionForTool(
    input.file_path,
    context.toolPermissionContext
  )
  
  if (decision === 'allow') {
    return { behavior: 'allow' }
  }
  
  return {
    behavior: 'ask',
    message: `Allow reading ${input.file_path}?`
  }
}
```

### 3. 输入验证

`validateInput` 在 `checkPermissions` 之前执行：

```typescript
// 验证结果类型
export type ValidationResult =
  | { result: true }
  | { result: false; message: string; errorCode: number }

// FileWriteTool 的验证
async validateInput(input, context) {
  // 路径必须是绝对路径
  if (!isAbsolute(input.file_path)) {
    return {
      result: false,
      message: 'file_path must be an absolute path',
      errorCode: 1
    }
  }
  return { result: true }
}
```

### 4. 并发安全标记

`isConcurrencySafe` 决定工具是否可以并行执行：

```typescript
// 读取类工具 - 并发安全
isConcurrencySafe(input) { return true }  // GlobTool, GrepTool

// 写入类工具 - 不能并发
isConcurrencySafe(input) { return false } // FileWriteTool, BashTool
```

## 💻 代码示例

### 示例 1：实现一个自定义工具

```typescript
import { z } from 'zod/v4'

// 定义输入 schema
const wordCountSchema = z.strictObject({
  file_path: z.string().describe('文件路径'),
  count_type: z.enum(['words', 'lines', 'chars'])
    .optional()
    .describe('统计类型，默认 words'),
})

// 构建工具
const WordCountTool = buildTool({
  name: 'WordCount',
  searchHint: 'count words lines characters in file',
  maxResultSizeChars: 1000,
  inputSchema: () => wordCountSchema,
  
  async description(input) {
    return '统计文件的字数、行数或字符数'
  },
  
  async call(input, context) {
    const { file_path, count_type = 'words' } = input
    const content = await readFileAsync(file_path, 'utf-8')
    
    let count: number
    switch (count_type) {
      case 'words':
        count = content.split(/\s+/).filter(Boolean).length
        break
      case 'lines':
        count = content.split('\n').length
        break
      case 'chars':
        count = content.length
        break
    }
    
    return {
      data: { file_path, count_type, count }
    }
  },
  
  isEnabled() { return true },
  isReadOnly() { return true },
  isConcurrencySafe() { return true },
  
  async checkPermissions(input, context) {
    return checkReadPermissionForTool(
      input.file_path, context.toolPermissionContext
    )
  },
  
  async validateInput(input) {
    if (!input.file_path.startsWith('/')) {
      return { result: false, message: '需要绝对路径', errorCode: 1 }
    }
    return { result: true }
  },
})
```

### 示例 2：带进度回调的工具

```typescript
// 进度事件类型
type ScanProgress = {
  type: 'bash_progress'
  filesScanned: number
  totalFiles: number
}

const DirectoryScanTool = buildTool({
  name: 'DirectoryScan',
  maxResultSizeChars: 50_000,
  inputSchema: () => z.strictObject({
    directory: z.string(),
    pattern: z.string().optional(),
  }),
  
  async call(input, context, canUseTool, parentMsg, onProgress) {
    const files = await readdir(input.directory, { recursive: true })
    const results = []
    
    for (let i = 0; i < files.length; i++) {
      // 每处理 10 个文件，报告一次进度
      if (i % 10 === 0 && onProgress) {
        onProgress({
          toolUseID: parentMsg.id,
          data: {
            type: 'bash_progress',
            filesScanned: i,
            totalFiles: files.length,
          }
        })
      }
      
      // 处理文件...
      results.push(files[i])
    }
    
    return { data: { files: results, total: results.length } }
  },
  
  // ... 其他方法
})
```

## 🏋️ 练习任务

### 练习 1：分析工具接口（15 分钟）

阅读源码 `src/Tool.ts`，回答：

1. `Tool` 类型有多少个方法/属性？哪些是必需的，哪些是可选的？
2. `ToolResult` 的 `contextModifier` 有什么用？在什么场景下需要？
3. `shouldDefer` 和 `alwaysLoad` 这对属性如何配合工作？

### 练习 2：实现一个 JSON 格式化工具（20 分钟）

要求：
- 输入：`{ file_path: string, indent: number }`
- 输出：格式化后的 JSON 字符串
- 包含输入验证（文件必须是 .json 扩展名）
- 是只读操作，并发安全

### 练习 3：探索真实工具实现（25 分钟）

对比 GlobTool 和 GrepTool 的实现：

1. 两者的 `inputSchema` 有什么不同？GrepTool 为什么更复杂？
2. 两者的 `maxResultSizeChars` 分别是多少？为什么不同？
3. GrepTool 使用了 `ripGrep` 而不是 Node.js 的 grep，为什么？

## 📚 扩展阅读

1. **[Zod 官方文档](https://zod.dev/)** - 参数验证框架
2. **[Anthropic Tool Use 文档](https://docs.anthropic.com/claude/docs/tool-use)** - 官方工具使用指南
3. **[JSON Schema 规范](https://json-schema.org/)** - 理解 inputJSONSchema 的底层标准

## 🤔 反思问题

1. 为什么 Claude Code 选择 Zod 而不是 JSON Schema 来定义工具参数？两者的优缺点是什么？
2. `lazySchema` 延迟加载对启动性能有多大影响？如果有 100 个工具，这个优化意味着什么？
3. 如果你要设计一个"发送邮件"工具，`isDestructive` 应该返回什么？`isConcurrencySafe` 呢？
4. 工具的 `description` 为什么是异步函数而不是静态字符串？

---

## 📝 今日总结

✅ Tool 接口定义：name、inputSchema、call、checkPermissions 等  
✅ buildTool 工厂函数和 lazySchema 延迟加载  
✅ Zod 参数验证框架的使用  
✅ 工具注册、发现和延迟加载机制  
✅ 权限检查和输入验证流程  
✅ 并发安全标记的设计  

**明天预告**：Day 5 我们将学习 **Context Management**，理解上下文窗口管理和 Prompt Cache 优化策略！

## 🔗 导航

- [← Day 3: Ink 高级特性](day-03-ink-advanced.md)
- [→ Day 5: Context Management](day-05-context-management.md)
- [📊 Week 1 Quiz](quiz-01.json)
