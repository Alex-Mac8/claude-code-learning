# Day 6: BashTool 深入

> "在 Agent 手中，Shell 是最强大的武器 — 也是最危险的"

## 🎯 学习目标

完成今天的学习后，你将能够：

1. 理解 BashTool 的完整架构（18 个源文件）
2. 掌握命令安全检查的流程和规则
3. 学会沙盒执行机制（`shouldUseSandbox`）
4. 理解命令分段解析和权限判断
5. 识别常见的命令注入攻击模式

## 📖 核心概念

### BashTool 的文件结构

BashTool 是 Claude Code 中最复杂的工具，有 18 个源文件：

```
src/tools/BashTool/
├── BashTool.tsx              # 主入口，buildTool 定义
├── BashToolResultMessage.tsx  # 结果渲染
├── UI.tsx                    # UI 组件
├── bashCommandHelpers.ts     # 命令解析辅助
├── bashPermissions.ts        # 权限检查核心
├── bashSecurity.ts           # 安全规则引擎
├── commandSemantics.ts       # 命令语义分析
├── commentLabel.ts           # 注释标签
├── destructiveCommandWarning.ts  # 危险命令警告
├── modeValidation.ts         # 模式验证
├── pathValidation.ts         # 路径验证
├── prompt.ts                 # 提示词模板
├── readOnlyValidation.ts     # 只读模式验证
├── sedEditParser.ts          # sed 命令解析
├── sedValidation.ts          # sed 命令验证
├── shouldUseSandbox.ts       # 沙盒判断
├── toolName.ts               # 工具名常量
└── utils.ts                  # 工具函数
```

### 命令执行流程

```
用户/Agent 提交命令
        │
        ▼
┌─────────────────┐
│ 1. 输入验证      │  validateInput()
│ (路径、格式)      │
└────────┬────────┘
         │
┌────────▼────────┐
│ 2. 命令解析      │  parseForSecurity()
│ (AST 分析)       │  分段、管道、重定向
└────────┬────────┘
         │
┌────────▼────────┐
│ 3. 安全检查      │  bashCommandIsSafe()
│ (23种规则)       │  危险命令检测
└────────┬────────┘
         │
┌────────▼────────┐
│ 4. 权限判断      │  checkPermissions()
│ (allow/ask/deny) │  用户规则匹配
└────────┬────────┘
         │
┌────────▼────────┐
│ 5. 沙盒决策      │  shouldUseSandbox()
│ (隔离 vs 直接)   │
└────────┬────────┘
         │
┌────────▼────────┐
│ 6. 执行命令      │  exec()
│ (超时、输出捕获) │
└────────┬────────┘
         │
┌────────▼────────┐
│ 7. 结果处理      │  interpretCommandResult()
│ (语义分析)       │
└─────────────────┘
```

### 命令解析：AST 级别的安全

Claude Code 不是简单地用正则表达式检查命令，而是将 Shell 命令解析为 AST（抽象语法树）：

```typescript
// src/utils/bash/parser.ts
// 将 Shell 命令解析为语法树节点
export type Node = {
  type: 'command' | 'pipeline' | 'list' | 'compound'
  parts: Node[]
  operator?: '&&' | '||' | '|' | ';'
  redirects?: Redirect[]
}

// 示例：解析 "cd /tmp && rm -rf *"
// 结果：
// {
//   type: 'list',
//   operator: '&&',
//   parts: [
//     { type: 'command', name: 'cd', args: ['/tmp'] },
//     { type: 'command', name: 'rm', args: ['-rf', '*'] }
//   ]
// }
```

### 跨段安全检查

一个关键的安全机制 — 检测跨命令段的危险组合：

```typescript
// src/tools/BashTool/bashCommandHelpers.ts
async function segmentedCommandPermissionResult(
  input, segments, bashToolHasPermissionFn, checkers
): Promise<PermissionResult> {
  
  // 安全规则：多个 cd 命令需要审批
  const cdCommands = segments.filter(s => checkers.isNormalizedCdCommand(s))
  if (cdCommands.length > 1) {
    return {
      behavior: 'ask',
      message: 'Multiple directory changes require approval'
    }
  }
  
  // 安全规则：cd + git 跨段组合（防止 bare repo fsmonitor 攻击）
  let hasCd = false, hasGit = false
  for (const segment of segments) {
    const subcommands = splitCommand(segment)
    for (const sub of subcommands) {
      if (checkers.isNormalizedCdCommand(sub)) hasCd = true
      if (checkers.isNormalizedGitCommand(sub)) hasGit = true
    }
  }
  
  if (hasCd && hasGit) {
    return {
      behavior: 'ask',
      message: 'cd + git commands require approval (bare repo attack prevention)'
    }
  }
}
```

### 沙盒机制

```typescript
// src/tools/BashTool/shouldUseSandbox.ts
export function shouldUseSandbox(command: string): boolean {
  // 沙盒适用场景：
  // 1. 安装依赖（npm install, pip install）
  // 2. 构建项目（make, cargo build）
  // 3. 运行测试（npm test, pytest）
  
  const sandboxPatterns = [
    /^npm\s+(install|ci|test|run\s+build)/,
    /^yarn\s+(install|test|build)/,
    /^pip\s+install/,
    /^make\b/,
    /^cargo\s+(build|test)/,
  ]
  
  return sandboxPatterns.some(p => p.test(command.trim()))
}
```

## 🔧 关键技术

### 1. 命令分类系统

BashTool 对命令进行语义分类：

```typescript
// src/tools/BashTool/BashTool.tsx

// 搜索类命令 - 可折叠显示
const BASH_SEARCH_COMMANDS = new Set([
  'find', 'grep', 'rg', 'ag', 'ack', 'locate', 'which', 'whereis'
])

// 读取类命令 - 可折叠显示
const BASH_READ_COMMANDS = new Set([
  'cat', 'head', 'tail', 'less', 'more',
  'wc', 'stat', 'file', 'strings',
  'jq', 'awk', 'cut', 'sort', 'uniq', 'tr'
])

// 目录列表命令
const BASH_LIST_COMMANDS = new Set(['ls', 'tree', 'du'])

// 语义中立命令（不影响整体命令的性质）
const BASH_SEMANTIC_NEUTRAL_COMMANDS = new Set([
  'echo', 'printf', 'true', 'false', ':'
])

// 静默命令（成功时无输出）
const BASH_SILENT_COMMANDS = new Set([
  'mv', 'cp', 'rm', 'mkdir', 'rmdir', 'chmod', 
  'chown', 'chgrp', 'touch', 'ln', 'cd', 'export'
])
```

### 2. 超时管理

```typescript
// src/tools/BashTool/prompt.ts
export function getDefaultTimeoutMs(): number {
  return 120_000  // 默认 2 分钟
}

export function getMaxTimeoutMs(): number {
  return 600_000  // 最大 10 分钟
}

// BashTool.tsx 中的使用
async call(input, context) {
  const timeout = Math.min(
    input.timeout || getDefaultTimeoutMs(),
    getMaxTimeoutMs()
  )
  
  const result = await exec(input.command, {
    cwd: getCwd(),
    timeout,
    signal: context.abortController.signal,
  })
  
  // 超时处理
  if (result.timedOut) {
    return {
      data: `Command timed out after ${timeout}ms. ` +
        `Consider running in background or increasing timeout.`
    }
  }
}
```

### 3. 进度显示

```typescript
// 长时间运行的命令显示进度
const PROGRESS_THRESHOLD_MS = 2000  // 2 秒后开始显示进度

async call(input, context, canUseTool, parentMsg, onProgress) {
  const startTime = Date.now()
  
  const process = spawn(input.command, { shell: true })
  
  process.stdout.on('data', (chunk) => {
    const elapsed = Date.now() - startTime
    
    if (elapsed > PROGRESS_THRESHOLD_MS && onProgress) {
      onProgress({
        toolUseID: parentMsg.id,
        data: {
          type: 'bash_progress',
          content: chunk.toString().slice(-200),  // 最后 200 字符
        }
      })
    }
  })
}
```

### 4. sed 命令特殊处理

Claude Code 对 `sed` 命令有专门的解析器，因为 sed 可以修改文件：

```typescript
// src/tools/BashTool/sedEditParser.ts
export function parseSedEditCommand(command: string) {
  // 解析 sed -i 命令，提取目标文件
  const match = command.match(/sed\s+(-i[^\s]*\s+)?(.+)\s+(.+)/)
  
  if (match && match[1]) {
    // sed -i：就地编辑，需要写权限
    return {
      isEdit: true,
      targetFile: match[3],
      pattern: match[2],
    }
  }
  
  // 普通 sed：只读操作
  return { isEdit: false }
}
```

## 💻 代码示例

### 示例 1：安全的命令执行器

```typescript
import { exec as execAsync } from 'child_process'
import { promisify } from 'util'

const execPromise = promisify(execAsync)

// 危险命令黑名单
const DANGEROUS_COMMANDS = new Set([
  'rm -rf /',
  'dd if=/dev/zero',
  'mkfs',
  ':(){:|:&};:',  // Fork 炸弹
  '> /dev/sda',
])

// 危险模式
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//,          // 删除根目录
  />\s*\/dev\/sd/,           // 覆写磁盘
  /chmod\s+777\s+\//,        // 开放根目录权限
  /curl.*\|\s*sh/,           // 下载并执行
  /wget.*\|\s*bash/,         // 下载并执行
]

async function safeExec(
  command: string,
  options: { timeout?: number; cwd?: string } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // 1. 黑名单检查
  if (DANGEROUS_COMMANDS.has(command.trim())) {
    throw new Error(`Blocked dangerous command: ${command}`)
  }
  
  // 2. 模式检查
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(`Blocked dangerous pattern in: ${command}`)
    }
  }
  
  // 3. 执行（带超时）
  try {
    const { stdout, stderr } = await execPromise(command, {
      timeout: options.timeout || 30_000,
      cwd: options.cwd || process.cwd(),
      maxBuffer: 10 * 1024 * 1024,  // 10MB
    })
    
    return { stdout, stderr, exitCode: 0 }
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      exitCode: error.code || 1,
    }
  }
}

// 使用示例
const result = await safeExec('ls -la /tmp')
console.log(result.stdout)
```

### 示例 2：命令权限检查器

```typescript
type PermissionRule = {
  pattern: string      // 命令模式（支持通配符）
  decision: 'allow' | 'deny' | 'ask'
}

class CommandPermissionChecker {
  private rules: PermissionRule[] = []
  
  addRule(pattern: string, decision: 'allow' | 'deny' | 'ask') {
    this.rules.push({ pattern, decision })
  }
  
  check(command: string): 'allow' | 'deny' | 'ask' {
    // 从最具体的规则开始匹配
    for (const rule of this.rules) {
      if (this.matchPattern(command, rule.pattern)) {
        return rule.decision
      }
    }
    
    // 默认：需要询问
    return 'ask'
  }
  
  private matchPattern(command: string, pattern: string): boolean {
    // 简单的通配符匹配
    const regex = new RegExp(
      '^' + pattern.replace(/\*/g, '.*') + '$'
    )
    return regex.test(command.trim())
  }
}

// 使用
const checker = new CommandPermissionChecker()
checker.addRule('ls *', 'allow')          // ls 总是允许
checker.addRule('cat *', 'allow')         // cat 总是允许
checker.addRule('rm *', 'ask')            // rm 需要询问
checker.addRule('rm -rf /*', 'deny')      // rm -rf / 总是拒绝

console.log(checker.check('ls -la'))      // 'allow'
console.log(checker.check('rm file.txt')) // 'ask'
console.log(checker.check('rm -rf /'))    // 'deny'
```

## 🏋️ 练习任务

### 练习 1：安全规则分析（15 分钟）

阅读 `bashSecurity.ts`，列出至少 10 种被禁止或需要审批的命令模式。

### 练习 2：实现命令分类器（20 分钟）

编写一个函数，将命令分为：读取、搜索、写入、危险 四类：

```typescript
function classifyCommand(command: string): 
  'read' | 'search' | 'write' | 'dangerous' {
  // 你的实现
}
```

### 练习 3：沙盒策略设计（15 分钟）

设计一个沙盒策略，决定哪些命令应该在沙盒中执行。考虑：
1. 哪些命令有副作用（修改文件系统、网络请求）？
2. 哪些命令是只读的？
3. 沙盒的性能开销在什么情况下是值得的？

## 📚 扩展阅读

1. **[Shell 命令注入防护](https://owasp.org/www-community/attacks/Command_Injection)** - OWASP 指南
2. **[macOS Sandbox 机制](https://developer.apple.com/documentation/security/app_sandbox)** - Apple 沙盒文档
3. **[Bash Parser 实现](https://github.com/nicolo-ribaudo/bash-parser)** - Shell 语法解析

## 🤔 反思问题

1. 为什么 `cd + git` 的跨段组合需要特别审批？什么是 "bare repo fsmonitor" 攻击？
2. Claude Code 对 `sed -i` 和 `sed`（无 -i）的处理有什么不同？为什么？
3. 命令超时设置为 2 分钟是否合理？什么情况下需要更长的超时？
4. 如果一个命令是 `echo "hello" | rm -rf /`，应该被允许还是拒绝？如何判断？

---

## 📝 今日总结

✅ BashTool 的 18 个源文件结构  
✅ 命令执行的 7 步流程  
✅ AST 级别的命令安全解析  
✅ 跨段安全检查（cd + git 防护）  
✅ 沙盒执行机制  
✅ 命令分类和语义分析系统  

**明天预告**：Day 7 是 **Week 1 项目**，我们将综合所学，构建一个简单的 CLI Agent！

## 🔗 导航

- [← Day 5: Context Management](day-05-context-management.md)
- [→ Day 7: Week 1 项目](day-07-week1-project.md)
- [📊 Week 1 Quiz](quiz-01.json)
