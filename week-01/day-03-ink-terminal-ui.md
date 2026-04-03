# Day 03: 终端 UI — 用 React 写命令行界面

[← 上一天: 入口与启动](./day-02-entry-and-bootstrap.md) | [课程首页](../README.md) | [下一天: REPL 与输入 →](./day-04-repl-and-input.md)

---

## 🎯 学习目标

1. 理解 **Ink 框架**的核心概念（React for CLI）
2. 掌握 Claude Code 中 `<Box>` 和 `<Text>` 的**终端布局**
3. 了解 **Provider 模式**在终端 UI 中的应用
4. 学习如何用 **React 组件**渲染终端界面

**难度:** 🟢 入门 | **预计时间:** 1 小时（30 分钟阅读 + 30 分钟动手）

---

## 📚 核心概念

### 为什么用 React 写终端？

传统的 CLI 工具直接 `console.log` 输出文本。但 Claude Code 需要复杂得多的界面：实时更新的 Spinner、可滚动的消息列表、权限对话框、进度条——这些用 `console.log` 根本无法实现。

Ink 让你用 React 的方式写终端 UI。`<Box>` 相当于 `<div>`，`<Text>` 相当于 `<span>`。React 的状态管理、生命周期、组件组合在终端中全部可用。

```tsx
// Ink 基础示例
import { Box, Text } from 'ink'

function App() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="green">✓ 任务完成</Text>
      <Text dimColor>耗时 2.3 秒</Text>
    </Box>
  )
}
```

### Claude Code 的组件树

Claude Code 的 UI 层次结构：

```
<App>                               # 顶层容器
  <FpsMetricsProvider>              # FPS 性能监控
    <StatsProvider>                 # 统计数据
      <AppStateProvider>            # 全局状态
        <REPL>                      # 主交互界面
          <VirtualMessageList>      # 虚拟滚动消息列表
            <MessageRow>            # 单条消息
              <Message>             # 消息内容
              <ToolUseLoader>       # 工具执行动画
          <StatusLine>              # 底部状态栏
          <PromptInput>             # 输入框
```

看 `App.tsx` 的实际代码：

```tsx
// src/components/App.tsx
export function App({ getFpsMetrics, stats, initialState, children }) {
  return (
    <FpsMetricsProvider getFpsMetrics={getFpsMetrics}>
      <StatsProvider store={stats}>
        <AppStateProvider
          initialState={initialState}
          onChangeAppState={onChangeAppState}
        >
          {children}
        </AppStateProvider>
      </StatsProvider>
    </FpsMetricsProvider>
  )
}
```

这是经典的 **Provider 嵌套**模式——每一层 Provider 为子组件提供不同的上下文数据。

### Ink 的布局系统

Ink 使用 Flexbox 布局，和 CSS Flexbox 几乎一样：

```tsx
// 水平布局
<Box flexDirection="row">
  <Text>左边</Text>
  <Box flexGrow={1} />  {/* 弹性空间 */}
  <Text>右边</Text>
</Box>

// 垂直布局 + 边距
<Box flexDirection="column" marginLeft={2} paddingY={1}>
  <Text>第一行</Text>
  <Text>第二行</Text>
</Box>

// 边框
<Box borderStyle="round" borderColor="cyan" padding={1}>
  <Text>带边框的内容</Text>
</Box>
```

### Claude Code 中的 Spinner

看看 Claude Code 如何实现加载动画：

```tsx
// src/components/Spinner.tsx — 简化版
export function SpinnerWithVerb({ verb, mode }) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  const [frameIndex, setFrameIndex] = useState(0)
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex(i => (i + 1) % frames.length)
    }, 80)
    return () => clearInterval(timer)
  }, [])
  
  return (
    <Text color="yellow">
      {frames[frameIndex]} {verb}...
    </Text>
  )
}
```

这个 Spinner 用 `setInterval` 每 80ms 切换一帧，就像 Web 中的 CSS 动画——但它是在终端里跑的！

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **Ink** | React for CLI 框架 | 用 JSX 写终端界面 |
| **Box** | Ink 的布局容器（类似 div） | `<Box flexDirection="column">` |
| **Text** | Ink 的文本组件（类似 span） | `<Text bold color="red">` |
| **Provider** | React 上下文提供者 | `<AppStateProvider>` |
| **useInput** | Ink 的键盘输入 Hook | 监听按键事件 |
| **VirtualList** | 虚拟滚动列表 | 只渲染可见区域的消息 |

---

## 💻 代码示例

### 示例 1: 最小的 Ink 应用

```tsx
// mini-cli.tsx
import React, { useState, useEffect } from 'react'
import { render, Box, Text, useInput } from 'ink'

function MiniCLI() {
  const [messages, setMessages] = useState<string[]>([])
  const [input, setInput] = useState('')
  
  useInput((inputChar, key) => {
    if (key.return) {
      setMessages(prev => [...prev, `> ${input}`])
      setInput('')
    } else if (key.backspace) {
      setInput(prev => prev.slice(0, -1))
    } else {
      setInput(prev => prev + inputChar)
    }
  })
  
  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => (
        <Text key={i}>{msg}</Text>
      ))}
      <Box>
        <Text color="cyan">❯ </Text>
        <Text>{input}</Text>
        <Text color="gray">│</Text>
      </Box>
    </Box>
  )
}

render(<MiniCLI />)
```

### 示例 2: 带状态栏的完整界面

```tsx
// Claude Code 风格的状态栏
function StatusLine({ model, tokenCount, cost }) {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text dimColor>Model: </Text>
      <Text color="cyan">{model}</Text>
      <Box flexGrow={1} />
      <Text dimColor>Tokens: </Text>
      <Text>{tokenCount.toLocaleString()}</Text>
      <Text dimColor> | Cost: </Text>
      <Text color="yellow">${cost.toFixed(4)}</Text>
    </Box>
  )
}
```

> **💡 试一试：** 安装 Ink (`npm install ink react`)，然后运行示例 1 的代码。体验用 React 写终端的感觉。

---

## ✏️ 动手练习

### 练习 1: Hello Ink (⏱️ ~15 分钟)

```bash
mkdir ink-demo && cd ink-demo
npm init -y
npm install ink react
```

创建一个显示当前时间的 Ink 应用，每秒更新一次。

### 练习 2: 消息列表组件 (⏱️ ~20 分钟)

创建一个 `<MessageList>` 组件，支持：
- 显示用户消息（绿色 `>`）
- 显示 AI 消息（蓝色 `◆`）
- 最新消息自动高亮

### 练习 3: 分析 Claude Code 组件 (⏱️ ~10 分钟)

打开 `src/components/` 目录，数一数有多少组件。找到 3 个你觉得最有趣的组件名，猜猜它们的功能。

---

## 📖 扩展阅读

1. **Ink 官方文档**
   - 🔗 https://github.com/vadimdemedes/ink
   - 推荐：Components 和 Hooks 部分

2. **Ink 组件库 ink-ui**
   - 🔗 https://github.com/vadimdemedes/ink-ui
   - 推荐：现成的 Select、TextInput、Spinner 组件

---

## 🤔 思考题

1. **理解：** 为什么 Claude Code 需要 `VirtualMessageList` 而不是直接渲染所有消息？
2. **应用：** 如果你要添加一个"正在输入..."的动画，应该放在组件树的哪个位置？
3. **对比：** Ink 和 blessed（另一个终端 UI 库）相比，React 模式有什么优势？

---

## ➡️ 下一步

**明天：** [Day 04 — REPL 与输入](./day-04-repl-and-input.md) — 我们将深入 REPL.tsx，这个 2000+ 行的核心交互组件。

**继续前请确认：**
- [ ] 我理解 Ink 的 `<Box>` 和 `<Text>` 组件
- [ ] 我知道 Provider 模式在 UI 中的作用
- [ ] 我能写一个简单的 Ink 应用
- [ ] 我了解 Claude Code 的组件层次结构

[← 上一天: 入口与启动](./day-02-entry-and-bootstrap.md) | [课程首页](../README.md) | [下一天: REPL 与输入 →](./day-04-repl-and-input.md)
