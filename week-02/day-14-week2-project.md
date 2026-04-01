# Day 14: Week 2 项目 - 构建文件处理 Agent

> "在 Day 7 的基础上，给你的 Agent 装上文件处理超能力"

## 🎯 学习目标

1. 在 MiniAgent 基础上添加完整的文件操作工具
2. 实现搜索功能（Glob + Grep）
3. 添加子任务管理能力
4. 构建完整的文件分析工作流

## 📖 项目概览

### 升级 MiniAgent v2.0

```
MiniAgent v2.0 新增功能：
├── 文件操作
│   ├── read_file（带行号）
│   ├── write_file（带冲突检测）
│   └── edit_file（只传 diff）
├── 搜索系统
│   ├── glob_search（文件名匹配）
│   └── grep_search（内容搜索）
├── 任务管理
│   ├── create_subtask
│   └── check_subtask
└── 上下文管理
    ├── 自动压缩
    └── 成本跟踪
```

## 💻 核心代码

### 1. 增强的文件操作

```typescript
// src/tools/enhancedFileOps.ts
import { readFileSync, writeFileSync, existsSync, statSync } from 'fs'
import { registry } from './registry.js'
import { z } from 'zod/v4'

// 文件状态缓存
const fileStates = new Map<string, { mtime: number; content: string }>()

// 带行号的文件读取
registry.register({
  name: 'read_file',
  description: '读取文件内容，自动添加行号',
  inputSchema: z.object({
    file_path: z.string(),
    offset: z.string().optional().describe('起始行号'),
    limit: z.string().optional().describe('读取行数'),
  }),
  isReadOnly: true,
  
  async execute(input) {
    try {
      const content = readFileSync(input.file_path, 'utf-8')
      const stat = statSync(input.file_path)
      
      // 缓存文件状态
      fileStates.set(input.file_path, {
        mtime: stat.mtimeMs,
        content,
      })
      
      const lines = content.split('\n')
      const offset = parseInt(input.offset || '1')
      const limit = parseInt(input.limit || String(lines.length))
      
      const selected = lines.slice(offset - 1, offset - 1 + limit)
      
      // 添加行号
      return selected
        .map((line, i) => `${String(offset + i).padStart(4)} | ${line}`)
        .join('\n')
    } catch (e) {
      return `Error: ${(e as Error).message}`
    }
  },
})

// 带冲突检测的文件写入
registry.register({
  name: 'write_file',
  description: '写入文件（如果文件存在，需要先读取）',
  inputSchema: z.object({
    file_path: z.string(),
    content: z.string(),
  }),
  isReadOnly: false,
  
  async execute(input) {
    // 冲突检测
    if (existsSync(input.file_path)) {
      const state = fileStates.get(input.file_path)
      if (!state) {
        return '❌ 必须先用 read_file 读取文件才能覆写'
      }
      
      const currentMtime = statSync(input.file_path).mtimeMs
      if (currentMtime !== state.mtime) {
        return '❌ 文件已被外部修改，请重新读取'
      }
    }
    
    writeFileSync(input.file_path, input.content)
    fileStates.set(input.file_path, {
      mtime: statSync(input.file_path).mtimeMs,
      content: input.content,
    })
    
    return `✅ 已写入 ${input.file_path}`
  },
})

// 精确编辑（只传 diff）
registry.register({
  name: 'edit_file',
  description: '编辑文件的一部分（替换匹配的文本）',
  inputSchema: z.object({
    file_path: z.string(),
    old_text: z.string().describe('要被替换的原始文本'),
    new_text: z.string().describe('替换后的新文本'),
  }),
  isReadOnly: false,
  
  async execute(input) {
    const state = fileStates.get(input.file_path)
    if (!state) {
      return '❌ 必须先用 read_file 读取文件'
    }
    
    if (!state.content.includes(input.old_text)) {
      return '❌ 未找到要替换的文本，请检查是否完全匹配'
    }
    
    const newContent = state.content.replace(input.old_text, input.new_text)
    writeFileSync(input.file_path, newContent)
    
    // 更新缓存
    fileStates.set(input.file_path, {
      mtime: statSync(input.file_path).mtimeMs,
      content: newContent,
    })
    
    // 显示 diff
    const oldLines = input.old_text.split('\n').length
    const newLines = input.new_text.split('\n').length
    return `✅ 已编辑 ${input.file_path} (-${oldLines} +${newLines} 行)`
  },
})
```

### 2. 搜索工具

```typescript
// src/tools/searchTools.ts
import { execSync } from 'child_process'
import { z } from 'zod/v4'
import { registry } from './registry.js'

registry.register({
  name: 'glob_search',
  description: '按文件名模式搜索文件',
  inputSchema: z.object({
    pattern: z.string().describe('Glob 模式，如 "**/*.ts"'),
    directory: z.string().optional(),
  }),
  isReadOnly: true,
  
  async execute(input) {
    const dir = input.directory || '.'
    try {
      const result = execSync(
        `find ${dir} -name "${input.pattern}" -not -path "*/node_modules/*" -not -path "*/.git/*" | head -100`,
        { encoding: 'utf-8', timeout: 10000 }
      )
      const files = result.trim().split('\n').filter(Boolean)
      return `找到 ${files.length} 个文件:\n${files.join('\n')}`
    } catch {
      return '未找到匹配文件'
    }
  },
})

registry.register({
  name: 'grep_search',
  description: '在文件内容中搜索模式',
  inputSchema: z.object({
    pattern: z.string().describe('正则表达式'),
    path: z.string().optional(),
    file_type: z.string().optional().describe('文件类型过滤，如 "ts"'),
  }),
  isReadOnly: true,
  
  async execute(input) {
    const searchPath = input.path || '.'
    const typeFilter = input.file_type 
      ? `--include="*.${input.file_type}"` 
      : ''
    
    try {
      const result = execSync(
        `grep -rn "${input.pattern}" ${searchPath} ${typeFilter} | head -50`,
        { encoding: 'utf-8', timeout: 10000 }
      )
      const matches = result.trim().split('\n').filter(Boolean)
      return `找到 ${matches.length} 处匹配:\n${matches.join('\n')}`
    } catch {
      return '未找到匹配内容'
    }
  },
})
```

### 3. 完整的测试场景

```typescript
// 测试: 让 Agent 分析一个项目
async function testFileAgent() {
  const tasks = [
    '请分析当前目录的项目结构，列出所有 TypeScript 文件',
    '搜索代码中所有的 TODO 注释，统计每个文件的数量',
    '读取 package.json，告诉我项目的依赖列表',
    '在 src/utils/ 目录创建一个 helpers.ts 文件，包含常用工具函数',
  ]
  
  for (const task of tasks) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`任务: ${task}`)
    console.log('='.repeat(60))
    await runAgent(task)
  }
}
```

## 🏋️ 扩展挑战

### 挑战 1：添加 undo 功能
记录所有文件修改，支持 `undo` 命令回滚最近的修改。

### 挑战 2：实现简单的 Coordinator
让 Agent 能创建子任务来并行处理文件分析。

### 挑战 3：添加 git 集成
在每次文件修改后自动 `git diff`，让 Agent 能看到自己的修改。

## 🤔 反思问题

1. v2.0 相比 v1.0 增加了什么关键能力？还缺少什么？
2. 文件冲突检测的实现有什么局限性？如何改进？
3. 搜索工具直接调用系统命令，有什么安全隐患？

---

## 📝 Week 2 总结

| 天数 | 主题 | 关键收获 |
|------|------|---------|
| Day 8 | File Ops | Read/Write/Edit 三工具设计 |
| Day 9 | Glob & Grep | ripgrep、搜索模式、结果折叠 |
| Day 10 | Task System | 7 种任务类型、状态机 |
| Day 11 | QueryEngine | 流式响应、重试、成本跟踪 |
| Day 12 | Message & UI | Diff 显示、Spinner、PromptInput |
| Day 13 | Coordinator | 多 Agent 协调、并行执行 |
| Day 14 | 项目 | 文件处理 Agent v2.0 |

**下周预告**：Week 3 进入高级主题 — 安全架构、性能优化、MCP 集成！

## 🔗 导航

- [← Day 13: Coordinator Mode](day-13-coordinator.md)
- [→ Day 15: Security Architecture](../week-03/day-15-security.md)
- [📊 Week 2 Quiz](quiz-02.json)
