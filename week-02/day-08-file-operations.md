# Day 8: File Operations

> "文件操作是 Agent 与代码世界交互的基本方式"

## 🎯 学习目标

1. 理解 FileReadTool、FileWriteTool、FileEditTool 的设计差异
2. 掌握文件读取的行号标记、图片处理、PDF 解析
3. 学会 FileEditTool 的 diff 机制和冲突检测
4. 理解文件操作的权限模型

## 📖 核心概念

### 三个文件工具的定位

```
FileReadTool (Read)    → 只读，高频使用，永不截断
FileWriteTool (Write)  → 创建新文件 or 完全覆写
FileEditTool (Edit)    → 局部修改，只传 diff
```

**设计哲学**：为什么需要三个工具？

- **Read vs Write** 分离：权限模型不同，读是低风险操作
- **Write vs Edit** 分离：Edit 只传差异部分，节省 tokens，减少出错概率
- Claude Code 的提示词明确建议："Prefer the Edit tool for modifying existing files"

### FileReadTool 深度解析

FileReadTool 不只是简单的 `readFile()`，它处理多种文件类型：

```typescript
// src/tools/FileReadTool/FileReadTool.ts
async call(input, context) {
  const filePath = expandPath(input.file_path)
  
  // 1. 图片文件 → 压缩 + base64 编码
  if (isImageFile(filePath)) {
    const buffer = await readFileAsync(filePath)
    const resized = await maybeResizeAndDownsampleImageBuffer(buffer)
    return { data: { type: 'image', base64: resized.toString('base64') } }
  }
  
  // 2. PDF 文件 → 提取文本和图片
  if (isPDFExtension(filePath)) {
    const pages = await extractPDFPages(filePath, input.page_range)
    return { data: { type: 'pdf', pages } }
  }
  
  // 3. Notebook 文件 → 解析 cell 结构
  if (filePath.endsWith('.ipynb')) {
    const cells = await readNotebook(filePath)
    return { data: mapNotebookCellsToToolResult(cells) }
  }
  
  // 4. 文本文件 → 添加行号
  const content = await readFileInRange(filePath, input.offset, input.limit)
  const withLineNumbers = addLineNumbers(content, input.offset || 1)
  return { data: withLineNumbers }
}
```

**行号标记**的重要性：

```
// 没有行号 — Agent 很难定位修改位置
function hello() {
  console.log("hello")
}

// 有行号 — Agent 可以精确引用
1 | function hello() {
2 |   console.log("hello")
3 | }
```

### FileWriteTool：创建与覆写

```typescript
// src/tools/FileWriteTool/FileWriteTool.ts
const inputSchema = z.strictObject({
  file_path: z.string().describe('文件的绝对路径'),
  content: z.string().describe('要写入的内容'),
})

async call(input, context) {
  const filePath = expandPath(input.file_path)
  
  // 安全检查：如果文件已存在，必须先读过
  if (fileExists(filePath) && !context.readFileState.has(filePath)) {
    return {
      data: { error: 'Must read file before overwriting' }
    }
  }
  
  // 检测文件编码和换行符
  const encoding = await detectFileEncoding(filePath)
  const lineEndings = await detectLineEndings(filePath)
  
  // 写入文件
  await writeTextContent(filePath, input.content, { encoding, lineEndings })
  
  // 生成 diff 用于 UI 显示
  const patch = getPatchForDisplay(originalContent, input.content)
  
  // 记录文件历史（用于撤销）
  if (fileHistoryEnabled()) {
    await fileHistoryTrackEdit(filePath, originalContent, input.content)
  }
  
  return {
    data: {
      type: fileExists ? 'update' : 'create',
      filePath,
      content: input.content,
      structuredPatch: patch,
    }
  }
}
```

### FileEditTool：精确的局部修改

FileEditTool 是最节省 tokens 的修改方式：

```typescript
// FileEditTool 只需要传 old_string 和 new_string
// 而不是整个文件内容
const inputSchema = z.strictObject({
  file_path: z.string(),
  old_string: z.string().describe('要替换的原始文本'),
  new_string: z.string().describe('替换后的新文本'),
})

// 优势：
// Write: 传整个文件（可能 10000 字符）
// Edit: 只传变化部分（可能 200 字符）
// 节省 98% 的 tokens！
```

**冲突检测**：

```typescript
// FileEditTool 会检查文件是否被外部修改
async validateInput(input, context) {
  const currentModTime = await getFileModificationTime(input.file_path)
  const lastReadTime = context.readFileState.get(input.file_path)
  
  if (currentModTime > lastReadTime) {
    return {
      result: false,
      message: FILE_UNEXPECTEDLY_MODIFIED_ERROR,
      errorCode: 1,
    }
  }
  return { result: true }
}
```

## 🔧 关键技术

### 1. 文件状态缓存

```typescript
// src/utils/fileStateCache.ts
// 追踪已读文件的状态，用于冲突检测
export type FileStateCache = Map<string, {
  modifiedTime: number    // 最后修改时间
  content?: string        // 内容缓存（可选）
  readTime: number        // 读取时间
}>
```

### 2. 文件历史（撤销支持）

```typescript
// src/utils/fileHistory.ts
export async function fileHistoryTrackEdit(
  filePath: string,
  before: string,
  after: string,
): Promise<void> {
  // 保存修改前的版本，支持 undo
  const historyDir = path.join('.claude', 'file-history')
  const timestamp = Date.now()
  const backupPath = path.join(historyDir, `${timestamp}-${path.basename(filePath)}`)
  await writeFile(backupPath, before)
}
```

### 3. 权限差异

```typescript
// 读取权限 — 相对宽松
checkReadPermissionForTool(filePath, context)
// 允许读取项目内的所有文件
// 项目外的文件需要询问

// 写入权限 — 更严格
checkWritePermissionForTool(filePath, context)  
// 需要明确的权限规则
// 写入项目外文件需要用户确认
```

## 💻 代码示例

### 示例：带冲突检测的文件编辑器

```typescript
import { readFileSync, writeFileSync, statSync } from 'fs'

class SafeFileEditor {
  private fileStates: Map<string, { mtime: number; content: string }> = new Map()
  
  read(path: string): string {
    const content = readFileSync(path, 'utf-8')
    const stat = statSync(path)
    this.fileStates.set(path, {
      mtime: stat.mtimeMs,
      content,
    })
    return content
  }
  
  edit(path: string, oldStr: string, newStr: string): boolean {
    const state = this.fileStates.get(path)
    if (!state) {
      throw new Error('必须先读取文件才能编辑')
    }
    
    // 冲突检测
    const currentMtime = statSync(path).mtimeMs
    if (currentMtime !== state.mtime) {
      throw new Error('文件已被外部修改，请重新读取')
    }
    
    // 查找并替换
    if (!state.content.includes(oldStr)) {
      throw new Error('未找到要替换的文本')
    }
    
    const newContent = state.content.replace(oldStr, newStr)
    writeFileSync(path, newContent)
    
    // 更新状态
    this.fileStates.set(path, {
      mtime: statSync(path).mtimeMs,
      content: newContent,
    })
    
    return true
  }
}
```

## 🏋️ 练习任务

### 练习 1：分析文件工具代码量（10 分钟）
统计 FileReadTool、FileWriteTool、FileEditTool 各自的代码行数。哪个最复杂？为什么？

### 练习 2：实现简单的 FileEdit（25 分钟）
实现一个支持多处替换的编辑函数，并添加 undo 功能。

### 练习 3：图片处理流程（15 分钟）
追踪 FileReadTool 读取图片的完整流程，画出从文件到 base64 的数据流图。

## 📚 扩展阅读

1. **[Node.js fs 模块](https://nodejs.org/api/fs.html)** - 文件系统 API
2. **[Diff 算法](https://en.wikipedia.org/wiki/Diff)** - 差异计算原理
3. **[Unified Diff Format](https://www.gnu.org/software/diffutils/manual/html_node/Unified-Format.html)** - diff 格式标准

## 🤔 反思问题

1. 为什么 FileReadTool 的 `maxResultSizeChars` 是 `Infinity`？这不危险吗？
2. FileEditTool 只传 diff 的设计有什么缺点？（提示：想想多处修改的情况）
3. 文件编码检测（UTF-8, GBK 等）为什么重要？如果忽略会怎样？

---

## 📝 今日总结

✅ 三个文件工具的定位和差异  
✅ FileReadTool 的多格式支持  
✅ FileWriteTool 的安全机制（先读后写）  
✅ FileEditTool 的 diff 机制和冲突检测  
✅ 文件状态缓存和历史追踪  

**明天预告**：Day 9 学习 Glob & Grep 工具 — 文件搜索和内容检索的利器！

## 🔗 导航

- [← Day 7: Week 1 项目](../week-01/day-07-week1-project.md)
- [→ Day 9: Glob & Grep](day-09-glob-grep.md)
- [📊 Week 2 Quiz](quiz-02.json)
