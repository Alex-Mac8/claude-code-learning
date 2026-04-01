# Day 2: Terminal UI 基础 (Ink)

> "CLI 不一定丑陋，Ink 让 Terminal 变得优雅" — React 开发者的命令行新世界

## 🎯 学习目标

完成今天的学习后，你将能够：

1. 理解 Ink 的核心原理（React for CLI）
2. 掌握 Ink 组件的基本用法（Box, Text, Input）
3. 实现简单的布局系统（Flexbox for Terminal）
4. 处理用户输入和键盘事件
5. 构建第一个交互式 CLI 应用

## 📖 核心概念

### 什么是 Ink？

Ink 是一个用 **React 组件** 构建命令行界面的框架。是的，你没看错，就是那个写网页用的 React！

**传统 CLI 方式**（直接操作 stdout）：
```typescript
process.stdout.write('Hello\n')
process.stdout.write('Calculating...\r')
process.stdout.write('Done!       \n')  // 手动清除旧内容
```

**Ink 方式**（声明式组件）：
```tsx
import { Text, Box } from 'ink'

function App() {
  const [status, setStatus] = useState('Calculating...')
  
  return (
    <Box>
      <Text>Hello</Text>
      <Text color="green">{status}</Text>
    </Box>
  )
}
```

**核心优势**：
- ✅ **声明式 UI**：只需描述界面"是什么"，不用管"怎么更新"
- ✅ **组件复用**：写一次 LoadingSpinner，到处用
- ✅ **熟悉的 React API**：useState, useEffect, Context 全都能用
- ✅ **自动重绘**：状态改变，UI 自动更新

### Ink 渲染原理

Ink 如何把 React 组件变成 Terminal 字符？

```
React 组件树                    Ink 渲染引擎                Terminal 输出
───────────────    ──────────►  ───────────────    ──────►  ───────────────
<Box>                           计算布局              移动光标到 (0, 0)
  <Text>Hello</Text>            生成字符矩阵          写入 "Hello"
  <Text>World</Text>            应用样式（颜色等）     移动光标到 (0, 1)
</Box>                          Diff 算法优化         写入 "World"
                                                      刷新 stdout
```

**关键步骤**：
1. **Virtual DOM**：和浏览器一样，Ink 维护一个虚拟 DOM 树
2. **Layout 计算**：用 Yoga（Flexbox 布局引擎）计算每个元素的位置
3. **Diff 算法**：对比新旧虚拟 DOM，找出最小变更
4. **Patch Terminal**：只更新变化的部分，避免闪烁

### Ink 核心组件

Ink 提供了一套内置组件，对应 Terminal 的基本元素：

| 组件 | 作用 | 类比 HTML |
|------|------|----------|
| `<Text>` | 显示文本 | `<span>` |
| `<Box>` | 布局容器 | `<div>` |
| `<Newline>` | 换行 | `<br>` |
| `<Spacer>` | 弹性空白 | `flex-grow: 1` |
| `<Static>` | 静态内容（不参与重绘） | - |
| `<Transform>` | 转换子组件输出 | - |

**例子**：
```tsx
<Box flexDirection="column">          {/* 垂直布局 */}
  <Text color="cyan">Title</Text>     {/* 青色文本 */}
  <Newline />                         {/* 空一行 */}
  <Box>                               {/* 水平布局 */}
    <Text>Left</Text>
    <Spacer />                        {/* 填充中间空白 */}
    <Text>Right</Text>
  </Box>
</Box>
```

**输出**：
```
Title

Left                                                              Right
```

## 🔧 关键技术

### 1. Text 组件：样式化文本

**文件**：`node_modules/ink/dist/components/Text.js`（Ink 库自带）

`<Text>` 支持丰富的样式：

```tsx
// 基础样式
<Text color="green">成功</Text>
<Text color="red">错误</Text>
<Text color="yellow">警告</Text>

// RGB 颜色
<Text color="#ff6347">番茄红</Text>

// 文字装饰
<Text bold>粗体</Text>
<Text italic>斜体</Text>
<Text underline>下划线</Text>
<Text strikethrough>删除线</Text>

// 背景色
<Text backgroundColor="blue">蓝色背景</Text>

// 组合样式
<Text bold color="cyan" backgroundColor="black">
  高亮标题
</Text>
```

**Claude Code 中的实际使用**：

```tsx
// src/ink/components/ThinkingBlock.tsx
function ThinkingBlock({ text }: { text: string }) {
  return (
    <Box borderStyle="round" borderColor="gray" padding={1}>
      <Text color="gray" italic>
        💭 {text}
      </Text>
    </Box>
  )
}
```

### 2. Box 组件：Flexbox 布局

**文件**：`src/ink/layout/Box.ts`（Claude Code 自定义扩展）

Ink 的 Box 完全遵循 CSS Flexbox 规范：

```tsx
// 水平排列（默认）
<Box>
  <Text>A</Text>
  <Text>B</Text>
  <Text>C</Text>
</Box>
// 输出: A B C

// 垂直排列
<Box flexDirection="column">
  <Text>A</Text>
  <Text>B</Text>
</Box>
// 输出:
// A
// B

// 居中对齐
<Box justifyContent="center" alignItems="center" height={10}>
  <Text>居中内容</Text>
</Box>

// 响应式布局
<Box width="50%">                     {/* 占父容器的 50% */}
  <Text>左侧</Text>
</Box>
<Box flexGrow={1}>                    {/* 填充剩余空间 */}
  <Text>右侧（自动伸展）</Text>
</Box>
```

**常用 Flexbox 属性**：

| 属性 | 值 | 说明 |
|------|------|------|
| `flexDirection` | `row` \| `column` | 主轴方向 |
| `justifyContent` | `flex-start` \| `center` \| `flex-end` \| `space-between` | 主轴对齐 |
| `alignItems` | `flex-start` \| `center` \| `flex-end` | 交叉轴对齐 |
| `flexGrow` | 数字 | 伸展比例 |
| `width` / `height` | 数字 \| 百分比 | 固定尺寸 |
| `padding` | 数字 | 内边距 |
| `margin` | 数字 | 外边距 |
| `borderStyle` | `single` \| `double` \| `round` | 边框样式 |

### 3. 处理用户输入

**文件**：`src/ink/components/Input.tsx`

Ink 提供两种输入处理方式：

#### 方式 1：useInput Hook（底层 API）

```tsx
import { useInput } from 'ink'

function InteractiveApp() {
  const [count, setCount] = useState(0)
  
  useInput((input, key) => {
    if (key.upArrow) {
      setCount(c => c + 1)
    }
    if (key.downArrow) {
      setCount(c => c - 1)
    }
    if (input === 'q') {
      process.exit(0)
    }
  })
  
  return <Text>计数: {count} (↑↓调整, q退出)</Text>
}
```

**key 对象包含的属性**：
```typescript
{
  upArrow: boolean
  downArrow: boolean
  leftArrow: boolean
  rightArrow: boolean
  return: boolean       // Enter 键
  escape: boolean       // Esc 键
  ctrl: boolean         // Ctrl 修饰符
  shift: boolean
  meta: boolean         // Cmd/Win 键
}
```

#### 方式 2：TextInput 组件（高级封装）

```tsx
import { TextInput } from 'ink'

function SearchBox() {
  const [query, setQuery] = useState('')
  
  return (
    <Box>
      <Text>搜索: </Text>
      <TextInput
        value={query}
        onChange={setQuery}
        onSubmit={q => console.log('搜索:', q)}
        placeholder="输入关键词..."
      />
    </Box>
  )
}
```

**Claude Code 的实际输入处理**：

```tsx
// src/ink/components/ChatInput.tsx (简化版)
function ChatInput({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [input, setInput] = useState('')
  
  useInput((char, key) => {
    if (key.return) {
      onSubmit(input)
      setInput('')
    } else if (key.backspace || key.delete) {
      setInput(input.slice(0, -1))
    } else if (!key.ctrl && !key.meta) {
      setInput(input + char)
    }
  })
  
  return (
    <Box>
      <Text color="cyan">❯ </Text>
      <Text>{input}</Text>
      <Text color="gray">▋</Text>  {/* 光标 */}
    </Box>
  )
}
```

### 4. 流式输出（Streaming）

Claude Code 的核心特性之一：逐字显示 AI 回复

```tsx
function StreamingText({ stream }: { stream: AsyncIterable<string> }) {
  const [text, setText] = useState('')
  
  useEffect(() => {
    (async () => {
      for await (const chunk of stream) {
        setText(prev => prev + chunk)
      }
    })()
  }, [stream])
  
  return <Text>{text}</Text>
}
```

**实际使用**：

```tsx
// src/ink/components/AssistantMessage.tsx
function AssistantMessage() {
  const [content, setContent] = useState('')
  
  useEffect(() => {
    const stream = callClaudeAPI({ stream: true })
    
    ;(async () => {
      for await (const delta of stream) {
        if (delta.type === 'content_block_delta') {
          setContent(prev => prev + delta.delta.text)
        }
      }
    })()
  }, [])
  
  return (
    <Box borderStyle="round" borderColor="blue" padding={1}>
      <Text>{content}</Text>
    </Box>
  )
}
```

## 💻 代码示例

### 示例 1：Hello Ink

创建第一个 Ink 应用：

```tsx
// hello-ink.tsx
import React from 'react'
import { render, Text, Box } from 'ink'

function App() {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="cyan" bold>
        🎉 欢迎使用 Ink！
      </Text>
      <Text>
        这是一个用 React 构建的命令行应用
      </Text>
    </Box>
  )
}

render(<App />)
```

**运行**：
```bash
npx tsx hello-ink.tsx
```

### 示例 2：交互式计数器

```tsx
import React, { useState } from 'react'
import { render, Text, Box, useInput } from 'ink'

function Counter() {
  const [count, setCount] = useState(0)
  
  useInput((input, key) => {
    if (key.upArrow) {
      setCount(c => c + 1)
    }
    if (key.downArrow) {
      setCount(c => c - 1)
    }
    if (key.return) {
      setCount(0)
    }
    if (input === 'q') {
      process.exit(0)
    }
  })
  
  return (
    <Box flexDirection="column" padding={1}>
      <Text>
        当前计数: <Text color="green" bold>{count}</Text>
      </Text>
      <Text color="gray">
        ↑ 增加 | ↓ 减少 | Enter 重置 | q 退出
      </Text>
    </Box>
  )
}

render(<Counter />)
```

### 示例 3：加载动画

```tsx
import React, { useState, useEffect } from 'react'
import { render, Text, Box } from 'ink'

const spinners = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

function Spinner() {
  const [frame, setFrame] = useState(0)
  
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % spinners.length)
    }, 80)
    
    return () => clearInterval(timer)
  }, [])
  
  return <Text color="cyan">{spinners[frame]}</Text>
}

function LoadingApp() {
  const [status, setStatus] = useState('连接服务器...')
  
  useEffect(() => {
    const steps = [
      ['连接服务器...', 1000],
      ['加载配置...', 1500],
      ['初始化完成!', 500]
    ] as const
    
    let timeout: NodeJS.Timeout
    let currentStep = 0
    
    const runStep = () => {
      if (currentStep >= steps.length) {
        process.exit(0)
        return
      }
      
      setStatus(steps[currentStep][0])
      timeout = setTimeout(() => {
        currentStep++
        runStep()
      }, steps[currentStep][1])
    }
    
    runStep()
    return () => clearTimeout(timeout)
  }, [])
  
  return (
    <Box>
      <Spinner />
      <Text> {status}</Text>
    </Box>
  )
}

render(<LoadingApp />)
```

### 示例 4：简单的 REPL

```tsx
import React, { useState } from 'react'
import { render, Text, Box, useInput } from 'ink'

function REPL() {
  const [history, setHistory] = useState<string[]>([])
  const [input, setInput] = useState('')
  
  useInput((char, key) => {
    if (key.return) {
      // 执行命令
      if (input === 'exit') {
        process.exit(0)
      }
      
      const result = `输出: ${input.toUpperCase()}`
      setHistory([...history, `> ${input}`, result])
      setInput('')
    } else if (key.backspace || key.delete) {
      setInput(input.slice(0, -1))
    } else if (!key.ctrl && !key.meta) {
      setInput(input + char)
    }
  })
  
  return (
    <Box flexDirection="column">
      {/* 历史记录（静态部分） */}
      {history.map((line, i) => (
        <Text key={i} color={line.startsWith('>') ? 'cyan' : 'green'}>
          {line}
        </Text>
      ))}
      
      {/* 当前输入 */}
      <Box>
        <Text color="cyan">❯ </Text>
        <Text>{input}</Text>
        <Text color="gray">▋</Text>
      </Box>
    </Box>
  )
}

render(<REPL />)
```

## 🏋️ 练习任务

### 练习 1：个人名片（15 分钟）

创建一个显示个人信息的 CLI 名片：

```tsx
// 目标效果:
╭─────────────────────────────╮
│  张三                       │
│  全栈开发工程师             │
│                             │
│  📧 zhangsan@example.com    │
│  🌐 github.com/zhangsan     │
│  💼 北京                    │
╰─────────────────────────────╯
```

要求：
- 使用 Box 组件创建边框
- 使用不同颜色区分信息类型
- 至少包含 4 项信息

<details>
<summary>参考答案</summary>

```tsx
import React from 'react'
import { render, Text, Box } from 'ink'

function BusinessCard() {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      width={40}
    >
      <Text bold color="cyan">张三</Text>
      <Text color="gray">全栈开发工程师</Text>
      <Text> </Text>
      <Text>📧 zhangsan@example.com</Text>
      <Text>🌐 github.com/zhangsan</Text>
      <Text>💼 北京</Text>
    </Box>
  )
}

render(<BusinessCard />)
```

</details>

### 练习 2：进度条（20 分钟）

实现一个模拟下载的进度条：

```tsx
// 目标效果:
下载中... ████████████░░░░░░░░ 60% (3.2 MB / 5.3 MB)
```

要求：
- 使用 useEffect 模拟下载进度
- 每 100ms 增加 5% 进度
- 下载完成后显示"完成！"并退出

<details>
<summary>参考答案</summary>

```tsx
import React, { useState, useEffect } from 'react'
import { render, Text, Box } from 'ink'

function ProgressBar() {
  const [progress, setProgress] = useState(0)
  const totalSize = 5.3
  const currentSize = (totalSize * progress / 100).toFixed(1)
  
  useEffect(() => {
    if (progress >= 100) {
      setTimeout(() => process.exit(0), 500)
      return
    }
    
    const timer = setTimeout(() => {
      setProgress(p => Math.min(100, p + 5))
    }, 100)
    
    return () => clearTimeout(timer)
  }, [progress])
  
  const barLength = 20
  const filledLength = Math.floor(barLength * progress / 100)
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)
  
  return (
    <Box>
      <Text>
        {progress < 100 ? '下载中...' : '完成！   '}{' '}
        <Text color="cyan">{bar}</Text>
        {' '}{progress}% ({currentSize} MB / {totalSize} MB)
      </Text>
    </Box>
  )
}

render(<ProgressBar />)
```

</details>

### 练习 3：简易菜单（25 分钟）

实现一个可以用方向键选择的菜单：

```tsx
// 目标效果:
请选择操作:
❯ 创建新文件
  删除文件
  退出

(按 ↑↓ 选择, Enter 确认)
```

要求：
- 用 ↑↓ 键切换选项
- 选中项用不同颜色高亮
- Enter 键打印选中的项

<details>
<summary>参考答案</summary>

```tsx
import React, { useState } from 'react'
import { render, Text, Box, useInput } from 'ink'

const menuItems = ['创建新文件', '删除文件', '退出']

function Menu() {
  const [selected, setSelected] = useState(0)
  
  useInput((input, key) => {
    if (key.upArrow) {
      setSelected(s => (s - 1 + menuItems.length) % menuItems.length)
    }
    if (key.downArrow) {
      setSelected(s => (s + 1) % menuItems.length)
    }
    if (key.return) {
      console.log(`\n你选择了: ${menuItems[selected]}`)
      process.exit(0)
    }
  })
  
  return (
    <Box flexDirection="column">
      <Text>请选择操作:</Text>
      {menuItems.map((item, i) => (
        <Box key={i}>
          <Text color={i === selected ? 'cyan' : 'white'}>
            {i === selected ? '❯ ' : '  '}{item}
          </Text>
        </Box>
      ))}
      <Text color="gray">(按 ↑↓ 选择, Enter 确认)</Text>
    </Box>
  )
}

render(<Menu />)
```

</details>

## 📚 扩展阅读

### 必读文章

1. **[Ink 官方文档](https://github.com/vadimdemedes/ink)**
   - 核心 API 参考
   - 重点阅读：Components 和 Hooks 章节
   - 阅读时长：30 分钟

2. **[Yoga 布局引擎](https://yogalayout.com/)**
   - Ink 底层使用的 Flexbox 实现
   - 重点：Flexbox 布局可视化工具
   - 阅读时长：15 分钟

3. **[Building a CLI with React](https://vadimdemedes.com/posts/building-a-cli-with-react)**
   - Ink 作者的博客文章
   - 重点：为什么选择 React 构建 CLI
   - 阅读时长：10 分钟

### 视频教程

1. **[Ink 快速入门](https://www.youtube.com/watch?v=example1)**
   - 适合：React 开发者转 CLI
   - 时长：12:34
   - 重点：5:20 - 9:00 (布局系统演示)

2. **[打造美观的命令行工具](https://www.bilibili.com/video/BV1example2)**
   - 适合：UI/UX 关注者
   - 时长：18:45
   - 重点：12:00 - 16:00 (颜色和排版技巧)

### 开源项目

1. **[Pastel](https://github.com/vadimdemedes/pastel)**
   - Ink 的上层框架，类似 Next.js
   - 重点学习：路由、状态管理

2. **[create-ink-app](https://github.com/vadimdemedes/create-ink-app)**
   - Ink 项目脚手架
   - 重点学习：项目结构、构建配置

## 🤔 反思问题

1. **性能思考**：如果 Terminal 窗口很小（20x10），而你的 UI 有 100 行内容，Ink 如何处理？会有性能问题吗？

2. **对比分析**：Ink 和浏览器中的 React 有什么核心区别？哪些 React 特性在 CLI 中不可用？

3. **设计权衡**：为什么 Claude Code 选择 Ink 而不是更轻量的库（如 blessed）？

4. **实际应用**：如果你要做一个代码审查 CLI 工具，需要展示文件对比（diff），如何用 Ink 实现？

5. **扩展想象**：Terminal UI 能做到什么程度？能实现图表、表格、甚至简单的游戏吗？

---

## 📝 今日总结

今天我们学习了：

✅ Ink 的核心原理（React for CLI）  
✅ Text 和 Box 组件的使用  
✅ Flexbox 布局系统  
✅ 用户输入处理（useInput + TextInput）  
✅ 流式输出和动画效果  
✅ 构建交互式 CLI 应用  

**明天预告**：Day 3 我们将学习 **Ink 高级特性**，包括自定义渲染、性能优化、复杂组件设计！

## 🔗 导航

- [← Day 1: Agent 系统概览](day-01-agent-overview.md)
- [→ Day 3: Ink 高级特性](day-03-ink-advanced.md)
- [📊 Week 1 Quiz](quiz-01.json)
