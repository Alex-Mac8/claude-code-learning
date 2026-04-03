# Day 15: 权限系统与安全模型

[← 上一天: 第二周回顾](../week-02/day-14-week2-review.md) | [课程首页](../README.md) | [下一天: MCP 集成 →](./day-16-mcp-integration.md)

---

## 🎯 学习目标

1. 理解 Claude Code 的**多层安全模型**
2. 掌握**权限模式**的设计（Plan/Auto/Bypass）
3. 了解**工具级权限控制**和用户确认流程
4. 学习**命令安全审计**的实现

**难度:** 🔴 高级 | **预计时间:** 1 小时

---

## 📚 核心概念

### 多层安全模型

Claude Code 的安全不是单一层面的——它是**多层防御**：

```
Layer 1: 权限模式（全局）
  ├─ Plan Mode: 只规划不执行
  ├─ Auto Mode: 自动执行已允许的操作
  └─ Default: 每次都确认

Layer 2: 工具级权限
  ├─ isReadOnly: 只读工具免确认
  ├─ needsPermission: 逐工具判断
  └─ CLAUDE.md 规则: allow/deny 配置

Layer 3: 命令安全
  ├─ AST 解析: 检测危险命令结构
  ├─ 破坏性命令检测: rm, dd, mkfs
  └─ 网络安全: curl|sh, wget|bash

Layer 4: 沙盒隔离
  ├─ 文件系统限制
  └─ 网络访问控制
```

### 权限模式

```typescript
// src/types/permissions.ts
export type PermissionMode = 
  | 'default'    // 默认：每次确认
  | 'plan'       // 规划模式：只看不做
  | 'auto'       // 自动模式：按规则执行
  | 'bypass'     // 绕过模式（危险！需要明确开启）
```

### 权限请求流程

```typescript
// 当工具需要权限时的流程
async function checkPermission(tool: Tool, input: unknown): Promise<boolean> {
  // 1. 只读工具直接通过
  if (tool.isReadOnly()) return true
  
  // 2. 检查 CLAUDE.md 的 allow/deny 规则
  const rule = matchPermissionRule(tool.name, input)
  if (rule === 'allow') return true
  if (rule === 'deny') return false
  
  // 3. 检查权限模式
  if (permissionMode === 'auto') {
    return checkAutoModeRules(tool, input)
  }
  
  // 4. 默认：弹出确认对话框
  return await askUserPermission({
    tool: tool.name,
    input,
    message: `允许执行 ${tool.name}？`
  })
}
```

### 权限 UI

```tsx
// src/components/permissions/PermissionRequest.tsx
// 终端中的权限对话框
//
// ┌─ 权限请求 ───────────────────────────┐
// │                                      │
// │  Bash 工具想要执行:                    │
// │  > npm run build                     │
// │                                      │
// │  [y] 允许  [n] 拒绝  [a] 始终允许     │
// └──────────────────────────────────────┘
```

### 拒绝追踪

Claude Code 会追踪被拒绝的操作，避免重复请求：

```typescript
// src/utils/permissions/denialTracking.ts
type DenialTrackingState = {
  deniedTools: Map<string, {
    count: number      // 被拒绝次数
    lastDenied: number // 最后拒绝时间
    inputs: string[]   // 被拒绝的输入
  }>
}
```

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **Permission Mode** | 全局权限模式 | default / plan / auto |
| **allow/deny** | CLAUDE.md 中的权限规则 | `allow: git *` |
| **isReadOnly** | 只读标记 | 只读工具免确认 |
| **Denial Tracking** | 拒绝追踪 | 记录被拒绝的操作 |
| **Sandbox** | 沙盒隔离 | 限制 Agent 访问范围 |

---

## 💻 代码示例

### 示例 1: 你的权限系统

```typescript
// 简单但完整的权限系统
class PermissionSystem {
  private mode: 'ask' | 'auto' | 'readonly' = 'ask'
  private allowRules: string[] = []
  private denyRules: string[] = []
  
  async check(toolName: string, input: unknown): Promise<boolean> {
    // readonly 模式：只允许只读操作
    if (this.mode === 'readonly') {
      return this.isReadOnlyTool(toolName)
    }
    
    // 检查 deny 规则（优先级最高）
    if (this.matchRule(this.denyRules, toolName, input)) {
      return false
    }
    
    // 检查 allow 规则
    if (this.matchRule(this.allowRules, toolName, input)) {
      return true
    }
    
    // auto 模式：已知安全的操作自动通过
    if (this.mode === 'auto') {
      return this.isKnownSafe(toolName, input)
    }
    
    // 默认：询问用户
    return this.promptUser(toolName, input)
  }
}
```

---

## ✏️ 动手练习

### 练习 1: 实现权限配置 (⏱️ ~20 分钟)

实现从 `.agent/permissions.json` 加载 allow/deny 规则的功能。

### 练习 2: 命令安全检查 (⏱️ ~20 分钟)

实现一个函数，检测以下危险模式：`rm -rf /`, `curl|sh`, `dd if=`, `chmod 777`。

### 练习 3: 权限 UI (⏱️ ~15 分钟)

用 Ink 实现一个权限确认对话框：显示工具名、参数，支持 y/n/a（始终允许）。

---

## 📖 扩展阅读

1. **OWASP 命令注入防御**
   - 🔗 https://owasp.org/www-community/attacks/Command_Injection

2. **Claude Code 安全模型中文解析**
   - 🔗 `~/Repos/cloud-code-study/docs/guide/02-tool-sandbox.md`

---

## 🤔 思考题

1. "始终允许" 选项有什么安全隐患？如何缓解？
2. 如何平衡安全性和用户体验？每次都确认很安全但很烦人。
3. 沙盒能防止所有安全问题吗？有什么局限？

---

## ➡️ 下一步

**明天：** [Day 16 — MCP 集成](./day-16-mcp-integration.md)

[← 上一天: 第二周回顾](../week-02/day-14-week2-review.md) | [课程首页](../README.md) | [下一天: MCP 集成 →](./day-16-mcp-integration.md)
