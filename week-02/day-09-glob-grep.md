# Day 9: Glob & Grep

> "大海捞针，不如有个好搜索工具"

## 🎯 学习目标

1. 理解 GlobTool 和 GrepTool 的设计和实现
2. 掌握 Glob 模式和正则表达式的区别
3. 学会 ripgrep 集成的优势
4. 理解搜索结果的截断和排序策略

## 📖 核心概念

### GlobTool：按文件名搜索

GlobTool 通过文件名模式匹配来查找文件：

```typescript
// src/tools/GlobTool/GlobTool.ts
export const GlobTool = buildTool({
  name: 'Glob',
  searchHint: 'find files by name pattern or wildcard',
  maxResultSizeChars: 100_000,
  
  inputSchema: () => z.strictObject({
    pattern: z.string().describe('The glob pattern'),
    path: z.string().optional().describe('Search directory'),
  }),
  
  async call(input, context) {
    const cwd = input.path ? expandPath(input.path) : getCwd()
    const startTime = Date.now()
    
    const results = await glob(input.pattern, { cwd })
    
    // 按修改时间排序（最新的在前）
    results.sort((a, b) => b.mtime - a.mtime)
    
    // 截断到 100 个文件
    const truncated = results.length > 100
    const filenames = results.slice(0, 100).map(f => toRelativePath(f))
    
    return {
      data: {
        durationMs: Date.now() - startTime,
        numFiles: results.length,
        filenames,
        truncated,
      }
    }
  },
  
  isConcurrencySafe() { return true },
  isReadOnly() { return true },
})
```

**常见 Glob 模式**：

```
**/*.ts       → 所有 .ts 文件（递归子目录）
src/**/*.tsx  → src 下所有 .tsx 文件
*.{js,ts}    → 当前目录的 .js 和 .ts 文件
!node_modules → 排除 node_modules
```

### GrepTool：按内容搜索

GrepTool 基于 ripgrep（`rg`），比原生 grep 快 10-100 倍：

```typescript
// src/tools/GrepTool/GrepTool.ts
export const GrepTool = buildTool({
  name: 'Grep',
  maxResultSizeChars: 100_000,
  
  inputSchema: () => z.strictObject({
    pattern: z.string().describe('正则表达式模式'),
    path: z.string().optional(),
    glob: z.string().optional().describe('文件过滤 (e.g. "*.ts")'),
    output_mode: z.enum(['content', 'files_with_matches', 'count']).optional(),
    '-B': z.number().optional().describe('匹配前的上下文行数'),
    '-A': z.number().optional().describe('匹配后的上下文行数'),
    '-n': z.boolean().optional().describe('显示行号'),
    multiline: z.boolean().optional().describe('跨行匹配'),
    head_limit: z.number().optional().describe('最大结果数'),
  }),
  
  async call(input, context) {
    const args = buildRipgrepArgs(input)
    const result = await ripGrep(args, { cwd: getCwd() })
    return { data: result }
  },
})

// 构建 ripgrep 命令参数
function buildRipgrepArgs(input): string[] {
  const args = [input.pattern]
  
  if (input.path) args.push(input.path)
  if (input.glob) args.push('--glob', input.glob)
  if (input['-B']) args.push('-B', String(input['-B']))
  if (input['-A']) args.push('-A', String(input['-A']))
  if (input['-n']) args.push('-n')
  if (input.multiline) args.push('--multiline')
  
  switch (input.output_mode) {
    case 'files_with_matches': args.push('-l'); break
    case 'count': args.push('-c'); break
    // 'content' 是默认模式
  }
  
  if (input.head_limit) args.push('--max-count', String(input.head_limit))
  
  return args
}
```

### 为什么用 ripgrep 而不是 Node.js grep？

```
性能对比（搜索 10 万个文件中的模式）：
┌─────────────┬──────────┬──────────┐
│ 工具         │ 时间      │ 内存     │
├─────────────┼──────────┼──────────┤
│ Node.js grep │ 45 秒    │ 800 MB   │
│ GNU grep     │ 12 秒    │ 50 MB    │
│ ripgrep      │ 0.8 秒   │ 20 MB    │
└─────────────┴──────────┴──────────┘

ripgrep 的优势：
1. 自动跳过 .gitignore 中的文件
2. 自动跳过二进制文件
3. 并行搜索
4. 智能编码检测
5. 内存映射文件（mmap）
```

### 搜索结果的 UI 折叠

Claude Code 将搜索类操作的结果折叠显示：

```typescript
// BashTool 也利用了这个机制
isSearchOrReadCommand(input) {
  // 检查命令是搜索还是读取
  const command = getFirstCommand(input.command)
  
  return {
    isSearch: BASH_SEARCH_COMMANDS.has(command),  // grep, find, rg
    isRead: BASH_READ_COMMANDS.has(command),      // cat, head, tail
    isList: BASH_LIST_COMMANDS.has(command),       // ls, tree
  }
}
```

## 🔧 关键技术

### 1. 权限过滤

搜索工具会自动过滤受限文件：

```typescript
// 搜索时自动排除敏感路径
function getFileReadIgnorePatterns(): string[] {
  return [
    'node_modules/**',
    '.git/**',
    '*.min.js',
    '*.map',
    'dist/**',
    'build/**',
  ]
}
```

### 2. 输出模式

GrepTool 支持三种输出模式：

```typescript
// content - 显示匹配行及上下文
$ rg "TODO" -n -B 1 -A 1
src/app.ts
14-  // Setup database
15:  // TODO: Add connection pooling
16-  const db = createPool()

// files_with_matches - 只显示文件名
$ rg "TODO" -l
src/app.ts
src/server.ts
src/utils.ts

// count - 显示匹配数量
$ rg "TODO" -c
src/app.ts:3
src/server.ts:1
```

## 💻 代码示例

### 实现简单的文件搜索引擎

```typescript
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

type SearchResult = {
  file: string
  line: number
  content: string
  context?: { before: string[]; after: string[] }
}

function searchFiles(
  dir: string,
  pattern: RegExp,
  options: {
    glob?: string
    contextLines?: number
    maxResults?: number
  } = {}
): SearchResult[] {
  const results: SearchResult[] = []
  const maxResults = options.maxResults || 100
  
  function walk(currentDir: string) {
    if (results.length >= maxResults) return
    
    const entries = readdirSync(currentDir, { withFileTypes: true })
    
    for (const entry of entries) {
      if (results.length >= maxResults) break
      
      const fullPath = join(currentDir, entry.name)
      
      // 跳过常见的忽略目录
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist'].includes(entry.name)) continue
        walk(fullPath)
        continue
      }
      
      // 文件过滤
      if (options.glob) {
        const ext = entry.name.split('.').pop()
        if (!options.glob.includes(ext || '')) continue
      }
      
      // 搜索文件内容
      try {
        const content = readFileSync(fullPath, 'utf-8')
        const lines = content.split('\n')
        
        lines.forEach((line, i) => {
          if (pattern.test(line) && results.length < maxResults) {
            const result: SearchResult = {
              file: relative(dir, fullPath),
              line: i + 1,
              content: line.trim(),
            }
            
            if (options.contextLines) {
              const n = options.contextLines
              result.context = {
                before: lines.slice(Math.max(0, i - n), i),
                after: lines.slice(i + 1, i + 1 + n),
              }
            }
            
            results.push(result)
          }
        })
      } catch (e) {
        // 跳过无法读取的文件
      }
    }
  }
  
  walk(dir)
  return results
}

// 使用
const results = searchFiles('.', /TODO|FIXME|HACK/, {
  glob: 'ts',
  contextLines: 2,
  maxResults: 50,
})

results.forEach(r => {
  console.log(`${r.file}:${r.line}: ${r.content}`)
})
```

## 🏋️ 练习任务

### 练习 1：对比搜索工具（15 分钟）
在 Claude Code 源码中，分别用 GlobTool 和 GrepTool 搜索所有包含 "permission" 的文件。对比两种方式的结果差异。

### 练习 2：实现 Glob 匹配器（25 分钟）
实现一个支持 `*`、`**`、`?`、`{}` 的 glob 模式匹配函数。

### 练习 3：搜索性能测试（20 分钟）
用 Node.js 的 `readdir + readFile` 和 `execSync('rg ...')` 分别搜索一个大型代码库，对比时间和内存消耗。

## 📚 扩展阅读

1. **[ripgrep 文档](https://github.com/BurntSushi/ripgrep/blob/master/GUIDE.md)** - ripgrep 完整指南
2. **[Glob Pattern 语法](https://en.wikipedia.org/wiki/Glob_(programming))** - Glob 模式详解
3. **[正则表达式入门](https://regexone.com/)** - 交互式学习正则

## 🤔 反思问题

1. GlobTool 为什么按修改时间排序而不是文件名排序？
2. 搜索结果限制 100 个文件是否合理？太多或太少会有什么问题？
3. ripgrep 默认跳过 .gitignore 文件，这在什么场景下会带来问题？

---

## 📝 今日总结

✅ GlobTool 和 GrepTool 的设计差异  
✅ ripgrep 集成的性能优势  
✅ 搜索结果的三种输出模式  
✅ 权限过滤和结果截断策略  

**明天预告**：Day 10 学习 Agent Task System — 任务创建、编排和管理！

## 🔗 导航

- [← Day 8: File Operations](day-08-file-operations.md)
- [→ Day 10: Agent Task System](day-10-agent-task.md)
- [📊 Week 2 Quiz](quiz-02.json)
