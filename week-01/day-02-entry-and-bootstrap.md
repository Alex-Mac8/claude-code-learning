# Day 02: 入口与启动 — CLI 解析与状态初始化

[← 上一天: 架构总览](./day-01-architecture-overview.md) | [课程首页](../README.md) | [下一天: 终端 UI →](./day-03-ink-terminal-ui.md)

---

## 🎯 学习目标

1. 理解 Claude Code 的**启动流程**和优化策略
2. 掌握 Commander.js 的 **CLI 参数解析**模式
3. 了解**会话状态初始化**的设计
4. 学习**并行预加载**的性能优化技巧

**难度:** 🟢 入门 | **预计时间:** 1 小时（30 分钟阅读 + 30 分钟动手）

---

## 📚 核心概念

### 启动的第一毫秒

Claude Code 对启动速度极其执着。打开 `main.tsx`，前几行不是 import 库——而是**立即启动性能计时器和并行预加载**：

```typescript
// src/main.tsx — 文件的前 20 行
import { profileCheckpoint } from './utils/startupProfiler.js'
profileCheckpoint('main_tsx_entry')  // 启动计时！

import { startMdmRawRead } from './utils/settings/mdm/rawRead.js'
startMdmRawRead()  // 并行读取 MDM 配置

import { startKeychainPrefetch } from './utils/secureStorage/keychainPrefetch.js'
startKeychainPrefetch()  // 并行预读 keychain 凭证
```

这就像赛车发令枪响的瞬间——不是先热身，而是立刻起跑。MDM 配置读取和 keychain 凭证查询在后台并行执行，不阻塞主线程。这个模式节省了约 65ms 的启动时间。

### CLI 参数解析

Claude Code 使用 `@commander-js/extra-typings` 处理命令行参数，这个库提供了完整的 TypeScript 类型支持：

```typescript
// main.tsx 中的参数定义（简化版）
const program = new CommanderCommand()
  .name('claude')
  .argument('[prompt...]', '初始提示（可选）')
  .option('-p, --print', '非交互模式：输出后退出')
  .option('--model <model>', '指定使用的模型')
  .option('--resume <sessionId>', '恢复之前的会话')
  .option('--allowedTools <tools...>', '允许的工具列表')
  .option('--verbose', '详细输出模式')
```

注意 Claude Code 的**快速退出**策略——如果用户只是查看版本号或帮助，就直接退出，不加载完整系统：

```typescript
// 快速路径：不需要启动完整系统的命令
if (args.version) {
  console.log(version)
  process.exit(0)
}
if (args.dumpSystemPrompt) {
  // 直接输出 system prompt，退出
}
```

### 会话状态（Bootstrap State）

每次启动都会创建一个"黑板"——`bootstrap/state.ts` 管理整个会话的全局状态：

```typescript
// src/bootstrap/state.ts — State 类型定义（核心字段）
type State = {
  // 工作目录
  originalCwd: string      // 用户运行 claude 时的目录
  cwd: string              // 当前工作目录（可能被 cd 改变）
  projectRoot: string      // 项目根目录
  
  // 会话标识
  sessionId: string        // 唯一会话 ID
  
  // 功能开关
  model: string            // 使用的模型
  permissionMode: string   // 权限模式
  
  // 运行时状态
  messages: Message[]      // 对话历史
  tools: Tool[]            // 可用工具列表
}
```

**设计亮点：** 状态是**不可变更新**的。不是直接修改状态对象，而是通过更新函数创建新状态。这避免了复杂的状态竞争问题。

### 上下文收集

启动时，Claude Code 会并行收集项目上下文：

```typescript
// src/context.ts — 收集 git 状态和用户上下文
export const getSystemContext = memoize(async () => {
  const [branch, mainBranch, status, log, userName] = await Promise.all([
    getBranch(),           // 当前分支
    getDefaultBranch(),    // 默认分支（main/master）
    gitStatus(),           // git status --short
    gitLog(),              // 最近 5 条 commit
    gitUserName(),         // git 用户名
  ])
  // ... 组装成上下文字符串
})
```

注意 `Promise.all` 的使用——5 个 git 命令**并行执行**，而不是依次等待。这又是一个性能优化。

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **Bootstrap** | 启动初始化过程 | 读取配置、初始化状态、收集上下文 |
| **Profile Checkpoint** | 性能计时点 | `profileCheckpoint('main_tsx_entry')` |
| **Prefetch** | 预加载策略 | 启动时并行读取 keychain |
| **Commander.js** | CLI 参数解析库 | `.option('-p, --print')` |
| **Memoize** | 缓存函数结果 | `getSystemContext` 只执行一次 |
| **Quick Path** | 快速退出路径 | `--version` 不加载完整系统 |

---

## 💻 代码示例

### 示例 1: 完整的启动流程

```typescript
// 从 main.tsx 提取的启动流程（简化版）
async function cliMain(args: ParsedArgs) {
  // 第一步：应用环境变量
  applyConfigEnvironmentVariables()
  
  // 第二步：初始化（认证、配置）
  const { apiKey, model } = await init(args)
  
  // 第三步：并行预加载
  await Promise.all([
    prefetchFastModeStatus(),        // 快速模式状态
    prefetchPassesEligibility(),     // 订阅资格
    prefetchOfficialMcpUrls(),       // MCP 官方工具
    initializeGrowthBook(),          // 功能开关
  ])
  
  // 第四步：收集上下文
  const systemContext = await getSystemContext()
  const userContext = await getUserContext()
  
  // 第五步：组装工具池
  const tools = assembleToolPool(/* ... */)
  
  // 第六步：启动 REPL
  await launchRepl({
    tools,
    systemContext,
    userContext,
    initialPrompt: args.prompt,
  })
}
```

### 示例 2: 你的 Agent 的启动流程

```typescript
// 你自己的 Agent 可以这样写启动流程
import { Command } from 'commander'

const program = new Command()
  .name('my-agent')
  .version('1.0.0')
  .argument('[prompt...]', '提示词')
  .option('-m, --model <model>', '模型', 'claude-sonnet-4-20250514')
  .option('--non-interactive', '非交互模式')
  .parse()

const options = program.opts()
const prompt = program.args.join(' ')

// 初始化状态
const state = {
  cwd: process.cwd(),
  model: options.model,
  messages: [],
  tools: loadTools(),  // 加载工具
}

// 如果有初始提示，直接执行；否则进入 REPL
if (prompt) {
  await runOnce(state, prompt)
} else {
  await startRepl(state)
}
```

---

## ✏️ 动手练习

### 练习 1: 分析启动时间 (⏱️ ~15 分钟)

**目标：** 理解 Claude Code 的启动优化

1. 在 `main.tsx` 中找到所有 `profileCheckpoint()` 调用
2. 列出所有的 `prefetch` 和 `preload` 函数
3. 思考：为什么这些操作要并行而不是串行？

### 练习 2: 写一个 CLI 入口 (⏱️ ~20 分钟)

**目标：** 用 Commander.js 创建你自己的 CLI

```bash
mkdir my-agent && cd my-agent
npm init -y
npm install commander
```

创建 `index.ts`：
- 接受 `[prompt]` 参数
- 添加 `--model` 和 `--verbose` 选项
- 非交互模式时直接输出 "Thinking..."

### 练习 3: 设计状态结构 (⏱️ ~10 分钟)

**目标：** 为你的 Agent 设计会话状态

画出你的 Agent 需要的状态字段，参考 Claude Code 的 State 类型。

---

## 📖 扩展阅读

1. **Commander.js 文档**
   - 🔗 https://github.com/tj/commander.js
   - 推荐：CLI 参数解析的标准库

2. **Node.js 性能优化**
   - 🔗 https://nodejs.org/en/learn/getting-started/profiling
   - 推荐：理解启动优化的通用策略

---

## 🤔 思考题

1. **理解：** 为什么 Claude Code 在第一行就启动 `profileCheckpoint`？这告诉我们开发团队关心什么？
2. **应用：** 如果你的 Agent 启动需要连接数据库、加载模型、和读取配置，你怎么并行化？
3. **对比：** Claude Code 的 `--print` 模式和交互式 REPL 模式，在架构上有什么区别？

---

## ➡️ 下一步

**明天：** [Day 03 — 终端 UI](./day-03-ink-terminal-ui.md) — 我们将探索 Ink 框架，学习如何用 React 写命令行界面。

**继续前请确认：**
- [ ] 我理解 Claude Code 的启动优化策略
- [ ] 我知道 Commander.js 怎么解析 CLI 参数
- [ ] 我能说出会话状态包含哪些核心字段
- [ ] 我知道 `Promise.all` 在启动中的作用

[← 上一天: 架构总览](./day-01-architecture-overview.md) | [课程首页](../README.md) | [下一天: 终端 UI →](./day-03-ink-terminal-ui.md)
