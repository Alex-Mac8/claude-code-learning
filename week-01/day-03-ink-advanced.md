# Day 3: Ink 高级特性

> "掌握底层原理，才能写出高性能的 Terminal UI" — 性能优化的前提是理解渲染机制

## 🎯 学习目标

完成今天的学习后，你将能够：

1. 理解 Ink 的渲染流程和 Diff 算法
2. 使用 Static 组件优化性能
3. 实现自定义 Hook 封装复杂逻辑
4. 处理 Terminal 窗口大小变化
5. 构建高性能的流式输出组件

## 📖 核心概念

### Ink 渲染流程详解

当状态改变时，Ink 如何高效更新 Terminal？

```
State 变化触发
      │
      ▼
┌────────────────────────┐
│  1. React 重新渲染     │  生成新的虚拟 DOM 树
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  2. Diff 算法          │  对比新旧虚拟 DOM
│  找出最小变更集        │  
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  3. Layout 计算        │  用 Yoga 计算每个元素位置
│  (Flexbox)             │
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│  4. Patch Terminal     │  只更新变化的区域
│  移动光标 + 写入字符   │  
└────────────────────────┘
```

**关键优化点**：
- **Diff 算法**：避免全量重绘，只更新变化部分
- **批量更新**：多次 setState 会被合并成一次渲染
- **光标优化**：最小化光标移动距离

### Static 组件：性能杀手锏

**问题**：历史消息每次都重新渲染，即使它们从未改变

```tsx
function ChatHistory({ messages }: { messages: Message[] }) {
  return (
    <>
      {messages.map((msg, i) => (
        <Text key={i}>{msg.content}</Text>  // ❌ 每次都重新渲染
      ))}
    </>
  )
}
```

**解决方案**：用 `<Static>` 包裹不变的内容

```tsx
import { Static } from 'ink'

function ChatHistory({ messages }: { messages: Message[] }) {
  return (
    <Static items={messages}>
      {(msg, i) => <Text key={i}>{msg.content}</Text>}
    </Static>
  )
}
```

**Static 的工作原理**：
- 第一次渲染：正常渲染所有 item
- 后续渲染：**只渲染新增的 item**
- 旧 item 的输出被"冻结"，不再参与 Diff

**Claude Code 的实际使用**：

```tsx
// src/ink/components/ConversationHistory.tsx
function ConversationHistory({ messages }: Props) {
  const [staticMessages, recentMessages] = useMemo(() => {
    // 前 N-5 条用 Static（历史）
    // 最后 5 条正常渲染（可能还在变化）
    const split = Math.max(0, messages.length - 5)
    return [
      messages.slice(0, split),
      messages.slice(split)
    ]
  }, [messages])
  
  return (
    <>
      <Static items={staticMessages}>
        {msg => <MessageBlock message={msg} />}
      </Static>
      {recentMessages.map(msg => (
        <MessageBlock key={msg.id} message={msg} />
      ))}
    </>
  )
}
```

### 处理 Terminal 大小变化

Terminal 窗口可以被用户调整大小，如何响应？

```tsx
import { useStdout } from 'ink'

function ResponsiveLayout() {
  const { stdout } = useStdout()
  const [size, setSize] = useState({
    columns: stdout.columns,
    rows: stdout.rows
  })
  
  useEffect(() => {
    const handler = () => {
      setSize({
        columns: stdout.columns,
        rows: stdout.rows
      })
    }
    
    stdout.on('resize', handler)
    return () => stdout.off('resize', handler)
  }, [stdout])
  
  return (
    <Box width={size.columns} height={size.rows}>
      <Text>窗口大小: {size.columns}×{size.rows}</Text>
    </Box>
  )
}
```

**实际应用场景**：
- 自动调整布局（宽屏 vs 窄屏）
- 限制内容显示区域
- 实现滚动效果

## 🔧 关键技术

### 1. 自定义 Hook：封装复杂逻辑

**文件**：`src/ink/hooks/useStreamingText.ts`

实现一个可复用的流式文本 Hook：

```typescript
function useStreamingText(stream: AsyncIterable<string>) {
  const [text, setText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  
  useEffect(() => {
    let cancelled = false
    
    ;(async () => {
      try {
        for await (const chunk of stream) {
          if (cancelled) break
          setText(prev => prev + chunk)
        }
        setIsComplete(true)
      } catch (error) {
        console.error('Stream error:', error)
      }
    })()
    
    return () => {
      cancelled = true
    }
  }, [stream])
  
  return { text, isComplete }
}

// 使用示例
function StreamingMessage({ apiCall }: Props) {
  const stream = useMemo(() => apiCall(), [])
  const { text, isComplete } = useStreamingText(stream)
  
  return (
    <Box>
      <Text>{text}</Text>
      {!isComplete && <Text color="gray"> ▋</Text>}
    </Box>
  )
}
```

### 2. Transform 组件：处理子组件输出

**用途**：在渲染子组件后，修改其输出文本

```tsx
import { Transform } from 'ink'

// 给所有输出加行号
function LineNumbers({ children }: { children: React.ReactNode }) {
  return (
    <Transform transform={(output, index) => `${index + 1}. ${output}`}>
      {children}
    </Transform>
  )
}

// 使用
<LineNumbers>
  <Text>First line</Text>
  <Text>Second line</Text>
</LineNumbers>

// 输出:
// 1. First line
// 2. Second line
```

**Claude Code 实际使用：代码块语法高亮**

```tsx
// src/ink/components/CodeBlock.tsx
import { Transform } from 'ink'
import highlight from 'cli-highlight'

function CodeBlock({ code, language }: Props) {
  return (
    <Transform
      transform={output => {
        try {
          return highlight(output, { language })
        } catch {
          return output
        }
      }}
    >
      <Text>{code}</Text>
    </Transform>
  )
}
```

### 3. 实现滚动效果

Terminal 没有原生滚动，如何实现？

```tsx
function ScrollableList({ items }: { items: string[] }) {
  const [scroll, setScroll] = useState(0)
  const { stdout } = useStdout()
  const maxVisible = stdout.rows - 2  // 留两行给标题和提示
  
  useInput((input, key) => {
    if (key.upArrow) {
      setScroll(s => Math.max(0, s - 1))
    }
    if (key.downArrow) {
      setScroll(s => Math.min(items.length - maxVisible, s + 1))
    }
  })
  
  const visibleItems = items.slice(scroll, scroll + maxVisible)
  
  return (
    <Box flexDirection="column">
      <Text bold>列表 ({scroll + 1}-{scroll + visibleItems.length} / {items.length})</Text>
      {visibleItems.map((item, i) => (
        <Text key={i}>{item}</Text>
      ))}
      <Text color="gray">↑↓ 滚动</Text>
    </Box>
  )
}
```

### 4. 错误边界

React 的 ErrorBoundary 在 Ink 中同样适用：

```tsx
class InkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Ink error:', error, errorInfo)
  }
  
  render() {
    if (this.state.error) {
      return (
        <Box borderStyle="round" borderColor="red" padding={1}>
          <Text color="red" bold>错误: {this.state.error.message}</Text>
        </Box>
      )
    }
    
    return this.props.children
  }
}

// 使用
<InkErrorBoundary>
  <App />
</InkErrorBoundary>
```

## 💻 代码示例

### 示例 1：高性能聊天界面

```tsx
import React, { useState, useCallback } from 'react'
import { render, Box, Text, Static, useInput } from 'ink'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

function ChatApp() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  
  const sendMessage = useCallback((text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text
    }
    
    setMessages(msgs => [...msgs, userMsg])
    
    // 模拟 AI 回复
    setTimeout(() => {
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `收到: ${text}`
      }
      setMessages(msgs => [...msgs, aiMsg])
    }, 500)
  }, [])
  
  useInput((char, key) => {
    if (key.return && input.trim()) {
      sendMessage(input)
      setInput('')
    } else if (key.backspace || key.delete) {
      setInput(input.slice(0, -1))
    } else if (!key.ctrl && !key.meta) {
      setInput(input + char)
    }
  })
  
  // 性能优化：用 Static 渲染历史消息
  const historyMessages = messages.slice(0, -2)
  const recentMessages = messages.slice(-2)
  
  return (
    <Box flexDirection="column">
      {/* 历史消息（Static） */}
      <Static items={historyMessages}>
        {msg => (
          <Box key={msg.id}>
            <Text color={msg.role === 'user' ? 'cyan' : 'green'}>
              {msg.role === 'user' ? '你' : 'AI'}: {msg.content}
            </Text>
          </Box>
        )}
      </Static>
      
      {/* 最近消息（正常渲染） */}
      {recentMessages.map(msg => (
        <Box key={msg.id}>
          <Text color={msg.role === 'user' ? 'cyan' : 'green'}>
            {msg.role === 'user' ? '你' : 'AI'}: {msg.content}
          </Text>
        </Box>
      ))}
      
      {/* 输入框 */}
      <Box marginTop={1}>
        <Text>❯ {input}</Text>
        <Text color="gray">▋</Text>
      </Box>
    </Box>
  )
}

render(<ChatApp />)
```

### 示例 2：实时日志查看器

```tsx
import React, { useState, useEffect } from 'react'
import { render, Box, Text, useInput, useStdout } from 'ink'
import { readFileSync, watchFile } from 'fs'

function LogViewer({ filePath }: { filePath: string }) {
  const [lines, setLines] = useState<string[]>([])
  const [scroll, setScroll] = useState(0)
  const { stdout } = useStdout()
  const maxVisible = stdout.rows - 3
  
  useEffect(() => {
    // 初次读取
    const content = readFileSync(filePath, 'utf-8')
    setLines(content.split('\n'))
    
    // 监听文件变化
    const watcher = watchFile(filePath, () => {
      const newContent = readFileSync(filePath, 'utf-8')
      const newLines = newContent.split('\n')
      setLines(newLines)
      
      // 自动滚动到底部
      setScroll(Math.max(0, newLines.length - maxVisible))
    })
    
    return () => watcher.unref()
  }, [filePath, maxVisible])
  
  useInput((input, key) => {
    if (key.upArrow) {
      setScroll(s => Math.max(0, s - 1))
    }
    if (key.downArrow) {
      setScroll(s => Math.min(lines.length - maxVisible, s + 1))
    }
    if (key.pageUp) {
      setScroll(s => Math.max(0, s - maxVisible))
    }
    if (key.pageDown) {
      setScroll(s => Math.min(lines.length - maxVisible, s + maxVisible))
    }
    if (input === 'q') {
      process.exit(0)
    }
  })
  
  const visibleLines = lines.slice(scroll, scroll + maxVisible)
  
  return (
    <Box flexDirection="column">
      <Text bold>日志查看器: {filePath}</Text>
      <Text color="gray">
        行 {scroll + 1}-{scroll + visibleLines.length} / {lines.length}
      </Text>
      
      <Box flexDirection="column" marginTop={1}>
        {visibleLines.map((line, i) => (
          <Text key={scroll + i}>{line}</Text>
        ))}
      </Box>
      
      <Text color="gray" marginTop={1}>
        ↑↓ 滚动 | PgUp/PgDn 翻页 | q 退出
      </Text>
    </Box>
  )
}

render(<LogViewer filePath="/var/log/system.log" />)
```

## 🏋️ 练习任务

### 练习 1：性能测试（15 分钟）

对比 Static 和普通渲染的性能差异：

```tsx
// 创建一个有 1000 条消息的聊天界面
// 每秒添加 1 条新消息
// 测量两种方式的 CPU 占用率
```

### 练习 2：自定义 Hook（20 分钟）

实现 `useKeyPress` Hook：

```tsx
function useKeyPress(targetKey: string): boolean {
  // 返回该键是否被按下
}

// 使用示例
function App() {
  const isSpacePressed = useKeyPress(' ')
  return <Text>空格键: {isSpacePressed ? '按下' : '未按下'}</Text>
}
```

### 练习 3：响应式布局（25 分钟）

实现一个根据窗口宽度自动切换布局的组件：
- 宽度 > 80：三列布局
- 宽度 40-80：两列布局
- 宽度 < 40：单列布局

---

## 📝 今日总结

✅ Ink 渲染流程和 Diff 算法  
✅ Static 组件性能优化  
✅ 自定义 Hook 封装  
✅ Terminal 窗口大小处理  
✅ Transform 和错误边界  

**明天预告**：Day 4 我们将学习 **Tool 系统设计**，理解 Agent 如何与外部世界交互！

## 🔗 导航

- [← Day 2: Terminal UI 基础](day-02-ink-basics.md)
- [→ Day 4: Tool 系统设计](day-04-tool-system.md)
