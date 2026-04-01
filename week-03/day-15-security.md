# Day 15: Security Architecture

> "安全不是功能，是基础设施"

## 🎯 学习目标

1. 理解 Claude Code 的多层安全架构
2. 掌握沙盒机制和权限系统
3. 学会 Zsh 威胁模型和防护策略
4. 识别 Agent 系统的常见攻击向量

## 📖 核心概念

### 安全分层架构

```
┌─────────────────────────────────────────┐
│ Layer 4: 用户权限控制                    │
│ allow/deny/ask 规则、CLAUDE.md 策略      │
├─────────────────────────────────────────┤
│ Layer 3: 命令级安全                      │
│ AST 解析、危险命令检测、sed 验证          │
├─────────────────────────────────────────┤
│ Layer 2: 文件系统隔离                    │
│ 工作目录限制、路径验证、权限检查          │
├─────────────────────────────────────────┤
│ Layer 1: 进程沙盒                       │
│ macOS Sandbox、Linux seccomp            │
└─────────────────────────────────────────┘
```

### 权限模式

```typescript
// src/types/permissions.ts
export type PermissionMode =
  | 'default'    // 标准模式：危险操作需确认
  | 'plan'       // 计划模式：只读操作
  | 'bypass'     // 绕过模式：自动允许（高风险！）

// 权限结果
export type PermissionResult =
  | { behavior: 'allow'; decisionReason: DecisionReason }
  | { behavior: 'ask'; message: string; decisionReason: DecisionReason }
  | { behavior: 'deny'; message: string; decisionReason: DecisionReason }
```

### 权限规则系统

```typescript
// CLAUDE.md 中的权限配置
// .claude/settings.json
{
  "permissions": {
    "allow": [
      "Bash(npm test)",       // 允许运行测试
      "Bash(git *)",          // 允许所有 git 命令
      "Read(*)",              // 允许读取所有文件
    ],
    "deny": [
      "Bash(rm -rf *)",       // 禁止危险删除
      "Write(/etc/*)",        // 禁止写入系统文件
    ]
  }
}
```

### Zsh 威胁模型

Claude Code 特别防范通过 Shell 环境的攻击：

```
威胁 1: Bare Repo fsmonitor 攻击
  攻击方式：cd 到恶意 git 仓库 → 自动执行 fsmonitor 脚本
  防护：cd + git 跨段组合强制审批

威胁 2: 命令注入
  攻击方式：通过用户输入注入额外命令
  防护：AST 解析 + 命令分段检查

威胁 3: 路径遍历
  攻击方式：../../etc/passwd
  防护：路径规范化 + 工作目录限制

威胁 4: 环境变量注入
  攻击方式：通过 ENV 注入恶意配置
  防护：清洁的 Shell 环境

威胁 5: 重定向攻击
  攻击方式：> /dev/sda 或 > ~/.ssh/authorized_keys
  防护：重定向目标检查
```

## 🔧 关键技术

### 1. 路径验证

```typescript
// src/tools/BashTool/pathValidation.ts
export function validatePath(
  inputPath: string,
  cwd: string,
  projectRoot: string,
): { valid: boolean; reason?: string } {
  const resolved = path.resolve(cwd, inputPath)
  
  // 检查路径遍历
  if (!resolved.startsWith(projectRoot)) {
    return {
      valid: false,
      reason: `Path ${resolved} is outside project root ${projectRoot}`
    }
  }
  
  // 检查敏感路径
  const sensitivePatterns = [
    /\/\.ssh\//,
    /\/\.gnupg\//,
    /\/\.aws\//,
    /\/\.env$/,
    /\/\.npmrc$/,
  ]
  
  for (const pattern of sensitivePatterns) {
    if (pattern.test(resolved)) {
      return {
        valid: false,
        reason: `Path matches sensitive pattern: ${pattern}`
      }
    }
  }
  
  return { valid: true }
}
```

### 2. 拒绝追踪

```typescript
// src/utils/permissions/denialTracking.ts
// 追踪用户拒绝次数，达到阈值后自动切换策略
export type DenialTrackingState = {
  consecutiveDenials: number
  lastDenialTime: number
  totalDenials: number
}

function handleDenial(state: DenialTrackingState): void {
  state.consecutiveDenials++
  state.totalDenials++
  state.lastDenialTime = Date.now()
  
  // 连续 3 次拒绝 → 建议切换到 plan 模式
  if (state.consecutiveDenials >= 3) {
    console.log('💡 多次操作被拒绝，建议切换到 Plan 模式')
  }
}
```

### 3. 只读模式验证

```typescript
// src/tools/BashTool/readOnlyValidation.ts
export function checkReadOnlyConstraints(
  command: string,
  mode: PermissionMode,
): ValidationResult {
  if (mode !== 'plan') return { result: true }
  
  // Plan 模式下只允许只读命令
  const readOnlyCommands = new Set([
    'cat', 'head', 'tail', 'less', 'more', 'wc',
    'ls', 'tree', 'find', 'grep', 'rg',
    'git log', 'git status', 'git diff',
    'echo', 'date', 'whoami',
  ])
  
  const firstCommand = command.trim().split(/\s+/)[0]
  if (!readOnlyCommands.has(firstCommand)) {
    return {
      result: false,
      message: `Plan mode only allows read-only commands. "${firstCommand}" is not allowed.`,
      errorCode: 403,
    }
  }
  
  return { result: true }
}
```

## 💻 代码示例

### 实现安全审计器

```typescript
class SecurityAuditor {
  private violations: { level: string; message: string; command?: string }[] = []
  
  auditCommand(command: string): {
    safe: boolean
    level: 'low' | 'medium' | 'high' | 'critical'
    issues: string[]
  } {
    const issues: string[] = []
    let maxLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    
    // Critical: 系统破坏命令
    if (/rm\s+-rf\s+\/|mkfs|dd\s+if=/.test(command)) {
      issues.push('检测到系统破坏命令')
      maxLevel = 'critical'
    }
    
    // High: 敏感文件访问
    if (/\/\.ssh\/|\/\.aws\/|\/\.env/.test(command)) {
      issues.push('访问敏感文件/目录')
      maxLevel = maxLevel === 'critical' ? 'critical' : 'high'
    }
    
    // Medium: 网络操作
    if (/curl|wget|nc\s|netcat/.test(command)) {
      issues.push('包含网络操作')
      if (maxLevel !== 'critical' && maxLevel !== 'high') maxLevel = 'medium'
    }
    
    // Medium: 权限修改
    if (/chmod|chown|chgrp/.test(command)) {
      issues.push('修改文件权限')
      if (maxLevel !== 'critical' && maxLevel !== 'high') maxLevel = 'medium'
    }
    
    if (issues.length > 0) {
      this.violations.push({
        level: maxLevel,
        message: issues.join('; '),
        command,
      })
    }
    
    return {
      safe: issues.length === 0,
      level: maxLevel,
      issues,
    }
  }
  
  getReport(): string {
    if (this.violations.length === 0) return '✅ 未发现安全问题'
    
    return this.violations
      .map(v => `[${v.level.toUpperCase()}] ${v.message}\n  Command: ${v.command}`)
      .join('\n\n')
  }
}
```

## 🏋️ 练习任务

### 练习 1：威胁建模（20 分钟）
列出你能想到的所有 Agent 攻击向量，分为"通过用户输入"和"通过恶意文件"两类。

### 练习 2：权限规则设计（15 分钟）
为一个 Node.js Web 项目设计合理的权限规则配置。

### 练习 3：安全测试（25 分钟）
编写测试用例，验证上面的 SecurityAuditor 是否正确检测危险命令。

## 📚 扩展阅读

1. **[OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)**
2. **[macOS Sandbox Design](https://developer.apple.com/documentation/security/app_sandbox)**
3. **[STRIDE Threat Model](https://en.wikipedia.org/wiki/STRIDE_(security))**

## 🤔 反思问题

1. 为什么子 Agent 默认"自动拒绝权限提示"？
2. 如果 Agent 被指示"忽略安全规则"，Claude Code 如何防护？
3. Plan 模式的只读限制足够安全吗？`git log` 真的完全无害吗？

---

## 📝 今日总结

✅ 4 层安全架构（沙盒→文件系统→命令→用户权限）  
✅ 权限模式（default/plan/bypass）  
✅ Zsh 威胁模型和 5 种攻击向量  
✅ 路径验证和敏感文件保护  
✅ 拒绝追踪和只读模式  

## 🔗 导航

- [← Day 14: Week 2 项目](../week-02/day-14-week2-project.md)
- [→ Day 16: Anti-Distillation](day-16-anti-distillation.md)
- [📊 Week 3 Quiz](quiz-03.json)
