# Day 14: 第二周回顾 + 项目实战

[← 上一天: 子 Agent](./day-13-agent-tool.md) | [课程首页](../README.md) | [下一天: 权限系统 →](../week-03/day-15-permission-system.md)

---

## 🎯 学习目标

1. 巩固第二周**核心概念**
2. 完成**中级项目**：带工具系统的 Agent CLI
3. 评估学习进度

**难度:** 🟡 中级 | **预计时间:** 1 小时（15 分钟复习 + 45 分钟项目）

---

## 📚 第二周知识图谱

```
Day 08: BashTool
  └─ 命令解析 → 安全检查 → 权限 → 执行 → 截断
  └─ AST 安全分析、沙盒

Day 09: 文件工具
  └─ Read / Write / Edit 三种模式
  └─ old_str/new_str 精确编辑
  └─ Diff 显示、文件状态缓存

Day 10: Agent 循环
  └─ QueryEngine.submitMessage()
  └─ query() while(true) 核心循环
  └─ 流式响应处理
  └─ 终止条件

Day 11: 上下文管理
  └─ System Prompt 动态组装
  └─ CLAUDE.md 多级加载
  └─ 记忆系统

Day 12: 上下文压缩
  └─ Snip / MicroCompact / Full Compact
  └─ 自动触发、压缩边界
  └─ Token 预算管理

Day 13: 子 Agent
  └─ Agent 调用 Agent
  └─ 前台/后台执行
  └─ 并行处理
```

---

## 🏗️ 项目：功能完整的 Agent CLI

**在 Day 07 的基础上，添加：**

1. **真实的 Anthropic API 调用**（使用 API Key）
2. **BashTool + FileReadTool**（至少 2 个工具）
3. **流式输出**（实时显示回复）
4. **上下文管理**（token 估算 + 简单压缩）

### 核心代码框架

```typescript
// agent-cli/src/index.ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

const tools = [
  {
    name: 'bash',
    description: '执行 shell 命令',
    input_schema: {
      type: 'object',
      properties: { command: { type: 'string' } },
      required: ['command']
    }
  },
  {
    name: 'read_file',
    description: '读取文件内容',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path']
    }
  }
]

async function agentLoop(prompt: string) {
  const messages = [{ role: 'user', content: prompt }]
  
  for (let turn = 0; turn < 15; turn++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      tools,
      messages,
      stream: true  // 流式输出
    })
    
    // 处理流式响应...
    // 执行工具调用...
    // 检查是否完成...
  }
}
```

---

## ✅ 自测清单

- [ ] 能解释 BashTool 的安全检查流程
- [ ] 能实现 old_str/new_str 的精确编辑
- [ ] 能写出 Agent 循环的核心代码
- [ ] 理解 System Prompt 的组装过程
- [ ] 能解释三种压缩策略的区别
- [ ] 理解子 Agent 的前台/后台模式

---

## 🤔 思考题

1. 你的 Agent 项目和 Claude Code 还差什么？列出 5 个最重要的差距。
2. 如果你要把这个 Agent 发布给其他人使用，首先要解决什么问题？
3. 回顾第一、二周，哪个概念对你影响最大？

---

## ➡️ 下一步

**下周预告：** 第三周进入高级主题——权限系统、MCP 集成、任务系统、多 Agent 架构、终极项目。

[← 上一天: 子 Agent](./day-13-agent-tool.md) | [课程首页](../README.md) | [下一天: 权限系统 →](../week-03/day-15-permission-system.md)
