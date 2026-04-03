# Day 09: 文件工具 — 读、写、编辑

[← 上一天: BashTool](./day-08-bash-tool.md) | [课程首页](../README.md) | [下一天: Agent 循环 →](./day-10-agent-loop.md)

---

## 🎯 学习目标

1. 理解三种文件工具的**设计差异**和使用场景
2. 掌握 FileEditTool 的**精确编辑**机制
3. 了解**文件状态缓存**和编辑历史
4. 学习**差异显示 (Diff)** 的实现

**难度:** 🟡 中级 | **预计时间:** 1 小时

---

## 📚 核心概念

### 三种文件工具

```
FileReadTool — 只读，返回文件内容
  └─ 权限: 不需要确认（isReadOnly = true）
  └─ 特殊: 行号显示、大文件截断、编码检测

FileWriteTool — 创建/覆盖整个文件
  └─ 权限: 需要确认（创建新文件或覆盖现有文件）
  └─ 特殊: 自动创建目录、编码保留

FileEditTool — 精确的搜索替换
  └─ 权限: 需要确认（修改文件内容）
  └─ 特殊: old_str/new_str 模式、diff 显示
```

### FileEditTool 的搜索替换设计

FileEditTool 不是基于行号编辑——它用**精确文本匹配**：

```typescript
// FileEditTool 的 inputSchema
{
  type: 'object',
  properties: {
    file_path: { type: 'string' },
    old_str: { type: 'string', description: '要替换的精确文本' },
    new_str: { type: 'string', description: '替换后的文本' }
  },
  required: ['file_path', 'old_str', 'new_str']
}
```

为什么用文本匹配而不是行号？因为**行号会变**。如果 Claude 先在第 10 行添加了代码，之后想编辑第 20 行的内容，行号可能已经偏移了。文本匹配更可靠。

### 文件状态缓存

Claude Code 维护一个文件状态缓存，记录每个文件的最后已知内容：

```typescript
// src/utils/fileStateCache.ts
type FileStateCache = Map<string, {
  content: string
  modifiedTime: number
  encoding: string
}>

// 用于检测外部修改
// 如果文件被 Claude 之外的程序修改，会提示用户
```

### Diff 显示

编辑后，Claude Code 会渲染漂亮的差异视图：

```typescript
// src/components/StructuredDiff.tsx
// 显示编辑前后的对比
// - 红色背景: 删除的行
// + 绿色背景: 添加的行
//   灰色: 未变化的上下文
```

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **old_str/new_str** | 搜索替换模式 | `old_str: 'foo'`, `new_str: 'bar'` |
| **FileStateCache** | 文件状态缓存 | 记录文件内容和修改时间 |
| **StructuredDiff** | 结构化差异视图 | 红绿色对比显示修改 |
| **Encoding** | 文件编码 | UTF-8、UTF-16、ASCII |
| **Line Endings** | 行结束符 | `\n` (Unix) vs `\r\n` (Windows) |

---

## 💻 代码示例

### 示例 1: FileEditTool 核心逻辑

```typescript
// 简化的 FileEditTool
const FileEditTool = buildTool({
  name: 'Edit',
  description: '对文件进行精确的文本替换编辑。',
  
  inputSchema: {
    type: 'object',
    properties: {
      file_path: { type: 'string' },
      old_str: { type: 'string' },
      new_str: { type: 'string' }
    },
    required: ['file_path', 'old_str', 'new_str']
  },
  
  async call(input) {
    const { file_path, old_str, new_str } = input
    const content = await readFile(file_path, 'utf8')
    
    // 检查 old_str 是否存在
    if (!content.includes(old_str)) {
      return { type: 'tool_result', content: '错误: 未找到要替换的文本' }
    }
    
    // 检查 old_str 是否唯一
    const occurrences = content.split(old_str).length - 1
    if (occurrences > 1) {
      return { type: 'tool_result', content: `错误: 找到 ${occurrences} 处匹配，请提供更精确的文本` }
    }
    
    // 执行替换
    const newContent = content.replace(old_str, new_str)
    await writeFile(file_path, newContent)
    
    return { type: 'tool_result', content: '文件已更新' }
  }
})
```

### 示例 2: 带 Diff 显示的编辑

```typescript
// 生成可读的 diff 输出
function generateDiff(oldStr: string, newStr: string): string {
  const oldLines = oldStr.split('\n')
  const newLines = newStr.split('\n')
  
  let diff = ''
  for (const line of oldLines) {
    diff += `- ${line}\n`  // 删除的行
  }
  for (const line of newLines) {
    diff += `+ ${line}\n`  // 添加的行
  }
  return diff
}
```

---

## ✏️ 动手练习

### 练习 1: 实现 FileReadTool (⏱️ ~15 分钟)

实现一个 FileReadTool，支持：行号显示、指定读取范围（startLine/endLine）、大文件截断。

### 练习 2: 编辑冲突检测 (⏱️ ~20 分钟)

实现 "乐观锁" 编辑：编辑前检查文件是否被外部修改（对比修改时间），如果是则警告用户。

### 练习 3: Diff 美化 (⏱️ ~15 分钟)

用 Ink 的 `<Text>` 组件渲染一个彩色 diff 视图：红色显示删除、绿色显示添加。

---

## 📖 扩展阅读

1. **Claude Code FileEditTool 源码**
   - 🔗 `~/Repos/cloud-code/claude-code-source/src/tools/FileEditTool/`
   - 推荐：完整实现

---

## 🤔 思考题

1. **理解：** 为什么 FileEditTool 要求 old_str 唯一匹配？如果允许多处替换会怎样？
2. **应用：** 如果文件很大（超过 100MB），FileReadTool 应该怎么处理？
3. **思辨：** 文本搜索替换 vs 行号编辑 vs AST 编辑，各有什么优缺点？

---

## ➡️ 下一步

**明天：** [Day 10 — Agent 循环](./day-10-agent-loop.md) — 深入 QueryEngine 和 query() 主循环。

[← 上一天: BashTool](./day-08-bash-tool.md) | [课程首页](../README.md) | [下一天: Agent 循环 →](./day-10-agent-loop.md)
