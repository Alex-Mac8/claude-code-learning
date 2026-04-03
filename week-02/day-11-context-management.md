# Day 11: 上下文管理 — System Prompt 与 CLAUDE.md

[← 上一天: Agent 循环](./day-10-agent-loop.md) | [课程首页](../README.md) | [下一天: 上下文压缩 →](./day-12-context-compression.md)

---

## 🎯 学习目标

1. 理解 **System Prompt** 的组装过程
2. 掌握 **CLAUDE.md** 配置文件的加载机制
3. 了解**上下文窗口**管理策略
4. 学习**动态上下文注入**的设计

**难度:** 🟡 中级 | **预计时间:** 1 小时

---

## 📚 核心概念

### System Prompt 组装

Claude Code 的 System Prompt 不是一个静态字符串——它是**动态组装**的，包含多个来源：

```
System Prompt 组成：
├── 1. 基础角色定义（"你是 Claude，一个 AI 编程助手"）
├── 2. 工具列表（所有可用工具的描述）
├── 3. 行为规则（安全规则、输出格式）
├── 4. 项目上下文
│    ├── Git 状态（分支、最近 commit）
│    ├── 工作目录
│    └── 操作系统信息
├── 5. CLAUDE.md 内容（用户自定义指令）
├── 6. 记忆文件（~/.claude/memory）
└── 7. 动态注入（插件、MCP 工具描述）
```

```typescript
// src/constants/prompts.ts — System Prompt 构建（简化）
export function getSystemPrompt(config) {
  return `
你是 Claude，一个由 Anthropic 开发的 AI 编程助手。
你在用户的终端中运行，可以使用以下工具：

${formatToolDescriptions(config.tools)}

## 行为规则
- 在执行破坏性操作前必须获得用户确认
- 不要输出文件的完整内容，除非被要求
- 优先使用精确编辑而不是重写整个文件
...

## 项目上下文
工作目录: ${config.cwd}
Git 分支: ${config.gitBranch}
最近 commit: ${config.recentCommits}

## 用户自定义指令 (CLAUDE.md)
${config.claudeMdContent}
  `
}
```

### CLAUDE.md 加载

Claude Code 会在多个位置搜索 CLAUDE.md 文件：

```typescript
// src/utils/claudemd.ts — CLAUDE.md 搜索路径
export async function getClaudeMds() {
  const paths = [
    // 项目级：当前项目的指令
    join(projectRoot, 'CLAUDE.md'),
    join(projectRoot, '.claude/CLAUDE.md'),
    
    // 用户级：全局偏好
    join(homeDir, '.claude/CLAUDE.md'),
    
    // 父目录级：monorepo 支持
    ...getParentDirectoryClaudeMds(projectRoot),
  ]
  
  // 读取所有存在的文件，合并内容
  const contents = await Promise.all(
    paths.map(p => readFileSafe(p))
  )
  
  return contents.filter(Boolean).join('\n\n')
}
```

优先级：项目级 > 父目录级 > 用户级。这让你可以有全局偏好，同时每个项目有自己的规则。

### 记忆系统

Claude Code 有一个记忆系统，可以跨会话保存信息：

```typescript
// src/utils/memory/ — 记忆类型
const MEMORY_TYPE_VALUES = [
  'user_preference',    // 用户偏好
  'project_convention', // 项目规范
  'workflow_pattern',   // 工作流模式
  'lesson_learned',     // 经验教训
]
```

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **System Prompt** | 告诉 Claude "你是谁" | 角色 + 规则 + 上下文 |
| **CLAUDE.md** | 用户自定义指令文件 | 项目偏好、编码规范 |
| **Context Window** | 上下文窗口大小限制 | Claude 3.5 Sonnet: 200K tokens |
| **Memory** | 跨会话记忆 | 记住用户偏好和项目规范 |
| **Dynamic Injection** | 动态注入上下文 | 根据当前状态调整 prompt |

---

## 💻 代码示例

### 示例 1: 你的 Agent 的 System Prompt 构建

```typescript
function buildSystemPrompt(config: {
  tools: ToolDef[]
  cwd: string
  projectConfig?: string
}) {
  const toolDescriptions = config.tools.map(t => 
    `### ${t.name}\n${t.description}\n参数: ${JSON.stringify(t.inputSchema)}`
  ).join('\n\n')
  
  return `
你是一个 AI 编程助手。

## 可用工具
${toolDescriptions}

## 工作环境
- 当前目录: ${config.cwd}
- 时间: ${new Date().toISOString()}

## 规则
1. 执行文件修改前必须先读取文件
2. 使用精确编辑，不要重写整个文件
3. 危险命令需要用户确认

${config.projectConfig ? `## 项目配置\n${config.projectConfig}` : ''}
  `.trim()
}
```

---

## ✏️ 动手练习

### 练习 1: 写一个 CLAUDE.md (⏱️ ~10 分钟)

为你自己的项目写一个 CLAUDE.md，包含：编码规范、偏好语言、禁止的操作。

### 练习 2: System Prompt 优化 (⏱️ ~20 分钟)

比较两个 System Prompt 版本：一个精简版（200 字），一个详细版（2000 字）。思考哪个更有效，为什么。

### 练习 3: 实现记忆加载 (⏱️ ~20 分钟)

实现一个简单的记忆系统：从 `~/.my-agent/memory.json` 加载用户偏好，注入到 System Prompt。

---

## 📖 扩展阅读

1. **Anthropic System Prompt 最佳实践**
   - 🔗 https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering
   - 推荐：官方的 prompt 写法指导

2. **上下文管理中文解析**
   - 🔗 `~/Repos/cloud-code-study/docs/guide/05-system-prompt.md`

---

## 🤔 思考题

1. System Prompt 越长越好吗？长 prompt 的代价是什么？
2. CLAUDE.md 的多层级设计（项目级/用户级）有什么好处？
3. 记忆系统如何防止过时信息影响 Agent 行为？

---

## ➡️ 下一步

**明天：** [Day 12 — 上下文压缩](./day-12-context-compression.md)

[← 上一天: Agent 循环](./day-10-agent-loop.md) | [课程首页](../README.md) | [下一天: 上下文压缩 →](./day-12-context-compression.md)
