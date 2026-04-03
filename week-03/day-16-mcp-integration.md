# Day 16: MCP 协议集成

[← 上一天: 权限系统](./day-15-permission-system.md) | [课程首页](../README.md) | [下一天: 任务系统 →](./day-17-task-system.md)

---

## 🎯 学习目标

1. 理解 **MCP（Model Context Protocol）**的核心概念
2. 掌握 Claude Code 中 MCP **工具发现和执行**的机制
3. 了解 **MCP Server 连接管理**
4. 学习如何为你的 Agent 集成 MCP

**难度:** 🔴 高级 | **预计时间:** 1 小时

---

## 📚 核心概念

### 什么是 MCP？

MCP（Model Context Protocol）是 Anthropic 推出的开放协议，让 AI Agent 可以连接**任何外部工具和数据源**。你可以把它理解为 AI 的 "USB 接口"——标准化的连接方式。

```
不用 MCP:
  Agent → 自己写 GitHub API 调用
  Agent → 自己写数据库查询
  Agent → 自己写 Slack 接口
  （每个都要自己实现）

用 MCP:
  Agent → MCP Client → MCP Server (GitHub)
                     → MCP Server (Database)
                     → MCP Server (Slack)
  （统一协议，即插即用）
```

### Claude Code 的 MCP 架构

```
src/services/mcp/
├── client.ts          # MCP 客户端管理
├── types.ts           # MCP 类型定义
├── officialRegistry.ts # 官方 MCP Server 注册表
├── vscodeSdkMcp.ts    # VS Code MCP 集成
└── ...
```

### MCP Server 配置

在 `~/.claude/settings.json` 或项目的 `.claude/settings.json` 中：

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxxx"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/docs"]
    }
  }
}
```

### MCP 工具如何变成 Agent 工具

Claude Code 将 MCP Server 提供的工具**自动注册**到 Tool 系统：

```typescript
// src/services/mcp/client.ts — MCP 工具发现（简化）
async function getMcpToolsCommandsAndResources() {
  const mcpTools = []
  
  for (const [name, config] of Object.entries(mcpServers)) {
    // 1. 连接 MCP Server
    const client = await connectMcpServer(config)
    
    // 2. 获取 Server 提供的工具列表
    const tools = await client.listTools()
    
    // 3. 将 MCP 工具转换为 Agent Tool
    for (const tool of tools) {
      mcpTools.push(buildTool({
        name: `mcp_${name}_${tool.name}`,
        description: tool.description,
        inputSchema: tool.inputSchema,
        
        async call(input) {
          // 通过 MCP 协议调用远程工具
          return await client.callTool(tool.name, input)
        }
      }))
    }
  }
  
  return mcpTools
}
```

### MCP 的三种能力

| 能力 | 描述 | Claude Code 对应 |
|------|------|-----------------|
| **Tools** | 可调用的函数 | MCPTool |
| **Resources** | 可读取的数据 | ReadMcpResourceTool / ListMcpResourcesTool |
| **Prompts** | 预定义的提示模板 | （部分支持） |

---

## 🔑 关键术语

| 术语 | 定义 | 示例 |
|------|------|------|
| **MCP** | Model Context Protocol | AI 工具集成标准协议 |
| **MCP Server** | 工具提供方 | GitHub Server、数据库 Server |
| **MCP Client** | 工具消费方 | Claude Code 本身 |
| **Transport** | 传输层 | stdio（本地进程） / HTTP（远程） |
| **Resource** | MCP 资源 | 可读取的外部数据 |

---

## 💻 代码示例

### 示例 1: 集成 MCP 到你的 Agent

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

async function connectMcpServer(config: { command: string, args: string[] }) {
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args
  })
  
  const client = new Client({ name: 'my-agent', version: '1.0.0' })
  await client.connect(transport)
  
  // 获取可用工具
  const { tools } = await client.listTools()
  console.log('MCP 工具:', tools.map(t => t.name))
  
  return { client, tools }
}
```

---

## ✏️ 动手练习

### 练习 1: 安装一个 MCP Server (⏱️ ~20 分钟)

安装并测试 `@modelcontextprotocol/server-filesystem`，理解 MCP 的连接过程。

### 练习 2: MCP 工具注册 (⏱️ ~20 分钟)

实现将 MCP 工具自动注册为 Agent Tool 的转换逻辑。

### 练习 3: 阅读 MCP 源码 (⏱️ ~15 分钟)

查看 `src/services/mcp/` 目录，理解 MCP 审批流程（`mcpServerApproval.tsx`）。

---

## 📖 扩展阅读

1. **MCP 官方文档**
   - 🔗 https://modelcontextprotocol.io/
   - 推荐：理解协议设计

2. **MCP 中文解析**
   - 🔗 `~/Repos/cloud-code-study/docs/guide/09-skill-mcp.md`

---

## 🤔 思考题

1. MCP 和传统 REST API 有什么区别？为什么 AI Agent 需要专门的协议？
2. 如果 MCP Server 是恶意的，会有什么安全风险？怎么防范？
3. MCP 的 stdio 传输方式有什么局限？什么时候该用 HTTP？

---

## ➡️ 下一步

**明天：** [Day 17 — 任务系统](./day-17-task-system.md)

[← 上一天: 权限系统](./day-15-permission-system.md) | [课程首页](../README.md) | [下一天: 任务系统 →](./day-17-task-system.md)
