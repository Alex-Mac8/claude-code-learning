# Day 12: Message & UI Components

> "好的 Agent 不仅要做得好，还要展示得好"

## 🎯 学习目标

1. 理解 Claude Code 的消息类型系统
2. 掌握工具结果的渲染方式（Diff、进度条、折叠）
3. 学会 PromptInput 组件的设计
4. 理解消息在 API 和 UI 之间的转换

## 📖 核心概念

### 消息类型

Claude Code 定义了丰富的消息类型：

```typescript
// src/types/message.ts
export type Message =
  | UserMessage          // 用户输入
  | AssistantMessage     // Agent 回复
  | SystemMessage        // 系统消息（本地提示）
  | AttachmentMessage    // 附件（文件、图片）
  | ProgressMessage      // 工具执行进度

// 用户消息
type UserMessage = {
  role: 'user'
  content: string | ContentBlock[]
  // 可以包含文本、图片、工具结果
}

// Assistant 消息
type AssistantMessage = {
  role: 'assistant'
  content: ContentBlock[]  // text + tool_use 混合
  usage?: Usage           // Token 用量
  costUSD?: number        // 本条消息的成本
}
```

### Diff 显示

FileWrite 和 FileEdit 操作会生成 diff 展示：

```typescript
// src/tools/FileWriteTool/UI.tsx
function FileWriteToolUpdatedMessage({ filePath, patch, verbose }) {
  const { columns } = useTerminalSize()
  
  return (
    <Box flexDirection="column">
      <FilePathLink path={filePath} />
      
      {/* 显示变更行数 */}
      <Text>
        <Text color="green">+{patch.additions}</Text>
        <Text> / </Text>
        <Text color="red">-{patch.deletions}</Text>
        <Text> lines changed</Text>
      </Text>
      
      {/* 高亮显示 diff */}
      {verbose && patch.hunks.map((hunk, i) => (
        <Box key={i} flexDirection="column">
          {hunk.lines.map((line, j) => (
            <Text key={j} color={
              line.startsWith('+') ? 'green' :
              line.startsWith('-') ? 'red' : undefined
            }>
              {line}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  )
}
```

### 工具结果折叠

搜索类操作（Grep、Glob、ls）的结果默认折叠：

```typescript
// 折叠逻辑
function ToolResultDisplay({ tool, result, isSearchOrRead }) {
  const [expanded, setExpanded] = useState(false)
  
  if (isSearchOrRead && !expanded) {
    // 折叠模式：只显示摘要
    return (
      <Box>
        <Text dimColor>
          {tool === 'Grep' ? `Found ${result.matchCount} matches` :
           tool === 'Glob' ? `Found ${result.numFiles} files` :
           `Listed ${result.lineCount} items`}
        </Text>
        <Text dimColor> (Ctrl+O to expand)</Text>
      </Box>
    )
  }
  
  // 展开模式：显示完整结果
  return <FullResult data={result} />
}
```

### PromptInput 组件

Claude Code 的输入框支持丰富的交互：

```typescript
// 简化版 PromptInput
function PromptInput({ onSubmit, placeholder }) {
  const [value, setValue] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  
  useInput((input, key) => {
    // Enter 提交
    if (key.return) {
      onSubmit(value)
      setHistory(prev => [value, ...prev])
      setValue('')
      return
    }
    
    // 上/下键浏览历史
    if (key.upArrow && historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setValue(history[newIndex])
    }
    if (key.downArrow && historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setValue(history[newIndex])
    }
    
    // Ctrl+C 中断
    if (input === 'c' && key.ctrl) {
      process.exit(0)
    }
  })
  
  return (
    <Box>
      <Text color="cyan">❯ </Text>
      <TextInput value={value} onChange={setValue} placeholder={placeholder} />
    </Box>
  )
}
```

## 🔧 关键技术

### 1. Spinner 动画

```typescript
// 工具执行时的加载动画
function ToolSpinner({ toolName, input }) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  const [frame, setFrame] = useState(0)
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % frames.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])
  
  return (
    <Text>
      <Text color="yellow">{frames[frame]}</Text>
      <Text> {toolName}</Text>
      <Text dimColor> {summarizeInput(input)}</Text>
    </Text>
  )
}
```

### 2. 语法高亮

```typescript
// src/components/HighlightedCode.tsx
function HighlightedCode({ code, language }) {
  // 使用终端兼容的语法高亮
  const highlighted = highlightForTerminal(code, language)
  
  return (
    <Box borderStyle="round" paddingX={1}>
      <Text>{highlighted}</Text>
    </Box>
  )
}
```

### 3. 文件路径链接

```typescript
// 可点击的文件路径（在支持的终端中）
function FilePathLink({ path }) {
  const displayPath = getDisplayPath(path)  // 相对路径
  
  // OSC 8 超链接（iTerm2, Kitty 等支持）
  return (
    <Text>
      {`\x1b]8;;file://${path}\x07${displayPath}\x1b]8;;\x07`}
    </Text>
  )
}
```

## 💻 代码示例

### 实现聊天界面

```typescript
import React, { useState } from 'react'
import { render, Box, Text, Static } from 'ink'
import TextInput from 'ink-text-input'

type ChatMessage = {
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: number
}

function ChatApp() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  
  const handleSubmit = async (text: string) => {
    if (!text.trim()) return
    
    // 添加用户消息
    setMessages(prev => [...prev, {
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }])
    setInput('')
    setLoading(true)
    
    // 模拟 Agent 回复
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `收到你的消息: "${text}"`,
        timestamp: Date.now(),
      }])
      setLoading(false)
    }, 1000)
  }
  
  return (
    <Box flexDirection="column" padding={1}>
      {/* 历史消息 */}
      <Static items={messages}>
        {(msg, i) => (
          <Box key={i} marginBottom={1}>
            <Text color={msg.role === 'user' ? 'cyan' : 'green'}>
              {msg.role === 'user' ? '👤' : '🤖'} {msg.content}
            </Text>
          </Box>
        )}
      </Static>
      
      {/* 加载动画 */}
      {loading && <Text color="yellow">⏳ 思考中...</Text>}
      
      {/* 输入框 */}
      <Box>
        <Text color="cyan">❯ </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="输入你的问题..."
        />
      </Box>
    </Box>
  )
}

render(<ChatApp />)
```

## 🏋️ 练习任务

### 练习 1：Diff 渲染器（20 分钟）
实现一个函数，接收两段文本，输出彩色的 unified diff 格式。

### 练习 2：进度条组件（15 分钟）
用 Ink 实现一个带百分比和预计剩余时间的进度条组件。

### 练习 3：消息类型探索（15 分钟）
在源码中找到 `ProgressMessage` 的所有使用场景，列出哪些工具会发送进度消息。

## 📚 扩展阅读

1. **[ANSI 转义码](https://en.wikipedia.org/wiki/ANSI_escape_code)** - 终端颜色和控制
2. **[OSC 8 超链接](https://gist.github.com/egmontkob/eb114294efbcd5adb1944c9f3cb5feda)** - 终端超链接标准
3. **[Ink 组件库](https://github.com/vadimdemedes/ink#components)** - 官方组件

## 🤔 反思问题

1. 为什么搜索结果默认折叠？这对 Agent 工作效率有影响吗？
2. Spinner 动画的帧率（80ms/帧）是如何选择的？太快或太慢会怎样？
3. 文件路径链接只在部分终端中可用，如何做到优雅降级？

---

## 📝 今日总结

✅ 消息类型系统（User、Assistant、System、Progress）  
✅ Diff 显示和文件变更渲染  
✅ 搜索结果折叠和展开  
✅ PromptInput 交互组件  
✅ Spinner、语法高亮、文件链接  

**明天预告**：Day 13 学习 Coordinator Mode — 多 Agent 协调工作！

## 🔗 导航

- [← Day 11: QueryEngine](day-11-query-engine.md)
- [→ Day 13: Coordinator Mode](day-13-coordinator.md)
- [📊 Week 2 Quiz](quiz-02.json)
