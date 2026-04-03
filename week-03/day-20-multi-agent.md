# Day 20: 多 Agent 系统 — Team 与 Swarm

[← 上一天: 成本与性能](./day-19-cost-and-performance.md) | [课程首页](../README.md) | [下一天: 终极项目 →](./day-21-capstone.md)

---

## 🎯 学习目标

1. 理解 Claude Code 的**多 Agent 架构**（Team/Swarm）
2. 掌握 **Agent 间通信**和协调机制
3. 了解 **Coordinator 模式**
4. 学习**分布式 Agent 协作**的设计

**难度:** 🔴 高级 | **预计时间:** 1 小时

---

## 📚 核心概念

### 从子 Agent 到 Team

Day 13 我们学习了子 Agent（1 对 1 关系）。Claude Code 的 Team/Swarm 系统更进一步——多个 Agent **平等协作**：

```
子 Agent 模式（Day 13）:
  主 Agent
    ├─ 子 Agent A
    └─ 子 Agent B
  （父子关系，子 Agent 报告给父 Agent）

Team 模式:
  Coordinator（协调者）
    ├─ Teammate 1（前端）
    ├─ Teammate 2（后端）
    └─ Teammate 3（测试）
  （各自独立工作，Coordinator 分配和汇总）

Swarm 模式:
  Agent 1 ←→ Agent 2
    ↕           ↕
  Agent 3 ←→ Agent 4
  （对等网络，互相通信）
```

### Team 创建

```typescript
// src/tools/TeamCreateTool/TeamCreateTool.ts
// Agent 可以创建 "团队"
const TeamCreateTool = buildTool({
  name: 'TeamCreate',
  description: '创建一组并行工作的 Teammate Agent',
  
  inputSchema: {
    type: 'object',
    properties: {
      teammates: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string' },     // "前端开发者"
            prompt: { type: 'string' },    // 任务描述
            tools: { type: 'array' },      // 可用工具
          }
        }
      }
    }
  }
})
```

### Coordinator 模式

```typescript
// src/coordinator/coordinatorMode.ts
// Coordinator 是特殊的 Agent：不直接写代码，只分配和协调

// Coordinator 的 System Prompt 会包含：
// "你是一个协调者。你的工作是：
//  1. 分析任务
//  2. 将任务分配给 Teammate
//  3. 监控进度
//  4. 汇总结果
//  不要自己写代码！"
```

### Agent 间消息传递

```typescript
// src/tools/SendMessageTool/SendMessageTool.ts
// Agent 之间可以发送消息

const SendMessageTool = buildTool({
  name: 'SendMessage',
  description: '向另一个 Teammate 发送消息',
  
  inputSchema: {
    type: 'object',
    properties: {
      target: { type: 'string', description: '目标 Teammate ID' },
      message: { type: 'string', description: '消息内容' }
    }
  }
})
```

### 权限同步

多 Agent 场景下，权限需要集中管理：

```typescript
// src/utils/swarm/permissionSync.ts
// Swarm 工作者需要从 Leader 获取权限批准

// Worker Agent 需要执行危险操作时：
// 1. 发送权限请求给 Leader
// 2. Leader 弹出确认对话框
// 3. 用户确认/拒绝
// 4. 结果同步回 Worker
```

### Worktree 隔离

并行工作时，每个 Agent 在自己的 git worktree 中工作，避免冲突：

```typescript
// src/utils/worktree.ts
async function createAgentWorktree(agentId: string) {
  // 每个 Agent 有自己的工作目录副本
  // 避免多个 Agent 同时修改同一个文件
  await exec(`git worktree add .worktrees/${agentId}`)
}
```

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **Team** | 有协调者的 Agent 组 | Coordinator + Teammates |
| **Swarm** | 对等 Agent 网络 | Agent 互相通信 |
| **Coordinator** | 协调 Agent | 分配任务、汇总结果 |
| **Teammate** | 团队成员 Agent | 接受任务、独立执行 |
| **Worktree** | Git 工作树 | 每个 Agent 独立的文件副本 |
| **Leader** | 权限管理者 | 集中处理权限请求 |

---

## 💻 代码示例

### 示例 1: 简单的多 Agent 协调器

```typescript
// 协调器模式实现
class Coordinator {
  private teammates = new Map<string, TeammateAgent>()
  
  async delegateTask(task: string, teamConfig: TeamConfig[]) {
    // 1. 创建 Teammate Agents
    for (const config of teamConfig) {
      const agent = new TeammateAgent(config.role, config.tools)
      this.teammates.set(config.role, agent)
    }
    
    // 2. 分配子任务
    const subTasks = await this.analyzeAndSplit(task)
    
    // 3. 并行执行
    const results = await Promise.all(
      subTasks.map(async (subTask) => {
        const teammate = this.teammates.get(subTask.assignee)!
        return await teammate.execute(subTask.prompt)
      })
    )
    
    // 4. 汇总结果
    return this.summarize(results)
  }
}
```

---

## ✏️ 动手练习

### 练习 1: 设计 Agent 团队 (⏱️ ~15 分钟)

为一个"网站开发"任务设计 Agent 团队：角色、工具分配、协作流程。

### 练习 2: Agent 通信 (⏱️ ~25 分钟)

实现两个 Agent 之间的消息传递系统（使用共享消息队列）。

### 练习 3: 分析 Swarm 源码 (⏱️ ~15 分钟)

阅读 `src/utils/swarm/` 目录，理解权限同步和 worktree 管理。

---

## 📖 扩展阅读

1. **Team/Swarm 中文解析**
   - 🔗 `~/Repos/cloud-code-study/docs/guide/11-team-swarm.md`

2. **多 Agent 系统设计模式**
   - 🔗 https://docs.anthropic.com/en/docs/build-with-claude/agentic-tool-use

---

## 🤔 思考题

1. Team 模式 vs Swarm 模式，什么时候用哪个？
2. 多 Agent 系统的成本如何控制？N 个 Agent = N 倍成本？
3. 如何处理 Agent 之间的"意见分歧"？

---

## ➡️ 下一步

**明天：** [Day 21 — 终极项目](./day-21-capstone.md) — 构建你自己的 AI Agent CLI 工具！

[← 上一天: 成本与性能](./day-19-cost-and-performance.md) | [课程首页](../README.md) | [下一天: 终极项目 →](./day-21-capstone.md)
