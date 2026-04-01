# Day 19: MCP Integration

> "Model Context Protocol — AI Agent 的通用插件接口"

## 🎯 学习目标

1. 理解 MCP（Model Context Protocol）的设计理念
2. 掌握 MCP Server 的管理和生命周期
3. 学会 MCP 工具与内置工具的集成
4. 理解 LSP（Language Server Protocol）集成

## 📖 核心概念

### MCP 是什么？

MCP 是 Anthropic 提出的标准协议，让 AI Agent 能够连接外部服务：

```
传统方式：每个工具都硬编码在 Agent 中
  Agent ──硬编码──→ 数据库
  Agent ──硬编码──→ 搜索引擎
  Agent ──硬编码──→ 文件系统

MCP 方式：统一的协议接口
  Agent ──MCP──→ MCP Server A（数据库）
  Agent ──MCP──→ MCP Server B（搜索引擎）
  Agent ──MCP──→ MCP Server C（Slack）
  Agent ──MCP──→ MCP Server D（你自己写的）
```

### MCP 在 Claude Code 中的实现

```typescript
// src/services/mcp/types.ts
export type MCPServerConnection = {
  name: string              // 服务器名称
  status: 'connecting' | 'connected' | 'error' | 'disconnected'
  tools: MCPTool[]          // 该服务器提供的工具
  resources: MCPResource[]  // 该服务器提供的资源
  serverInfo?: {
    name: string
    version: string
  }
}

// MCP 工具会被转换为 Claude Code 的 Tool 类型
export type MCPTool = {
  name: string
  description: string
  inputSchema: ToolInputJSONSchema
  // MCP 工具使用 JSON Schema 而非 Zod
}
```

### MCP 工具注册

```typescript
// MCP 工具被注册为带前缀的普通工具
// 格式：mcp__serverName__toolName

// 例如 Slack MCP Server 提供的工具
// 原始名称：send_message
// 注册名称：mcp__slack__send_message

const mcpTool = buildTool({
  name: `mcp__${serverName}__${toolName}`,
  isMcp: true,
  mcpInfo: { serverName, toolName },
  
  async call(input, context) {
    // 通过 MCP 协议调用远程服务器
    const result = await mcpClient.callTool(toolName, input)
    return { data: result }
  },
  
  // MCP 工具使用 JSON Schema 而非 Zod
  inputJSONSchema: mcpToolDefinition.inputSchema,
})
```

### MCP Server 生命周期

```
1. 配置阶段
   └── .claude/mcp.json 定义服务器列表

2. 连接阶段
   ├── 启动 MCP Server 进程
   ├── 握手（协议版本协商）
   └── 获取工具和资源列表

3. 运行阶段
   ├── Agent 调用 MCP 工具
   ├── 通过 stdio/HTTP 通信
   └── 结果返回给 Agent

4. 断开阶段
   ├── 超时断开
   ├── 错误断开
   └── 会话结束时清理
```

### LSP 集成

Claude Code 也集成了 LSP（Language Server Protocol）来获取代码智能：

```typescript
// src/services/lsp/manager.ts
// LSP 提供：
// - 代码补全
// - 跳转到定义
// - 查找引用
// - 诊断（错误/警告）

export class LSPServerManager {
  private servers: Map<string, LSPServer> = new Map()
  
  // 根据文件类型自动启动对应的语言服务器
  async getServer(languageId: string): Promise<LSPServer | null> {
    if (this.servers.has(languageId)) {
      return this.servers.get(languageId)!
    }
    
    // 查找对应的语言服务器
    const serverConfig = findLSPServer(languageId)
    if (!serverConfig) return null
    
    const server = await startLSPServer(serverConfig)
    this.servers.set(languageId, server)
    return server
  }
}

// LSPTool 让 Agent 可以使用 LSP 功能
const LSPTool = buildTool({
  name: 'LSP',
  isLsp: true,
  
  async call(input, context) {
    const manager = getLspServerManager()
    const server = await manager.getServer(input.language)
    
    switch (input.action) {
      case 'diagnostics':
        return { data: await server.getDiagnostics(input.file) }
      case 'definition':
        return { data: await server.getDefinition(input.file, input.position) }
      case 'references':
        return { data: await server.getReferences(input.file, input.position) }
    }
  },
})
```

## 🔧 关键技术

### 1. MCP 配置

```json
// .claude/mcp.json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"],
      "env": {}
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "ghp_xxx"
      }
    },
    "custom-api": {
      "command": "node",
      "args": ["./my-mcp-server.js"],
      "env": {
        "API_KEY": "xxx"
      }
    }
  }
}
```

### 2. MCP 资源系统

```typescript
// MCP 除了工具，还提供"资源"（类似数据源）
const ReadMcpResourceTool = buildTool({
  name: 'ReadMcpResource',
  
  async call(input, context) {
    const resource = await mcpClient.readResource(input.uri)
    // 资源可以是文件内容、数据库记录等
    return { data: resource.contents }
  },
})

const ListMcpResourcesTool = buildTool({
  name: 'ListMcpResources',
  
  async call(input, context) {
    const resources = context.options.mcpResources
    return {
      data: Object.entries(resources).map(([server, list]) => ({
        server,
        resources: list.map(r => ({ uri: r.uri, name: r.name })),
      }))
    }
  },
})
```

### 3. MCP 认证

```typescript
// src/tools/McpAuthTool/
// MCP 服务器可能需要 OAuth 认证
const McpAuthTool = buildTool({
  name: 'McpAuth',
  
  async call(input, context) {
    // 处理 OAuth 流程
    const authUrl = await mcpClient.getAuthUrl(input.serverName)
    
    // 打开浏览器让用户授权
    await open(authUrl)
    
    // 等待回调
    const token = await waitForAuthCallback()
    
    // 存储 token
    await saveToken(input.serverName, token)
    
    return { data: 'Authentication successful' }
  },
})
```

## 💻 代码示例

### 构建简单的 MCP Server

```typescript
// my-mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = new Server({
  name: 'my-custom-server',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
    resources: {},
  },
})

// 注册工具
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'get_weather',
      description: '获取天气信息',
      inputSchema: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名' },
        },
        required: ['city'],
      },
    },
  ],
}))

// 处理工具调用
server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'get_weather') {
    const { city } = request.params.arguments
    // 模拟天气 API
    return {
      content: [{
        type: 'text',
        text: `${city} 的天气：晴，25°C`,
      }],
    }
  }
})

// 启动
const transport = new StdioServerTransport()
await server.connect(transport)
```

## 🏋️ 练习任务

### 练习 1：构建 MCP Server（30 分钟）
创建一个 MCP Server，提供"查询数据库"和"执行 SQL"两个工具。

### 练习 2：MCP 配置（15 分钟）
为一个项目配置 3 个 MCP Server（文件系统、GitHub、自定义 API）。

### 练习 3：比较 MCP 和直接集成（15 分钟）
分析 MCP 的优缺点：什么场景适合 MCP？什么场景直接集成更好？

## 📚 扩展阅读

1. **[MCP 官方文档](https://modelcontextprotocol.io/)** - Model Context Protocol
2. **[LSP 规范](https://microsoft.github.io/language-server-protocol/)** - Language Server Protocol
3. **[MCP Server 示例](https://github.com/modelcontextprotocol/servers)** - 官方 MCP Server 集合

## 🤔 反思问题

1. MCP 的 `mcp__server__tool` 命名约定有什么优缺点？
2. MCP Server 崩溃时，Agent 如何优雅降级？
3. LSP 和 MCP 有什么相似之处？为什么 Anthropic 要创建新协议而不是复用 LSP？

---

## 📝 今日总结

✅ MCP 协议的设计理念和架构  
✅ MCP Server 的配置和生命周期  
✅ MCP 工具在 Claude Code 中的注册  
✅ LSP 集成和代码智能  
✅ 构建自定义 MCP Server  

## 🔗 导航

- [← Day 18: Performance](day-18-performance.md)
- [→ Day 20: Production Patterns](day-20-production.md)
- [📊 Week 3 Quiz](quiz-03.json)
