# 🤖 Claude Code 源码解析：21天构建 AI Agent CLI 工具

> 基于泄露的 Claude Code 源码，从零到一学会构建类似的 AI Agent CLI 工具

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-c4825a)](./website/index.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Days](https://img.shields.io/badge/课程-21天-blue.svg)](#课程大纲)

## 📖 课程简介

这是一门基于 **Claude Code 真实源码**（516K 行 TypeScript）的深度解析课程。通过 21 天的系统学习，你将掌握构建一个类似 Claude Code 的 AI Agent CLI 工具所需的全部核心技能。

**不是抽象理论，是真实代码。** 每一天的代码示例都直接来自 Claude Code 源码。

## 🎯 学习目标

完成本课程后，你将能够：

- ✅ 理解 AI Agent CLI 工具的**完整架构**
- ✅ 使用 Ink（React for CLI）构建**终端 UI**
- ✅ 实现 Tool 系统：Bash、文件操作、Web 搜索等
- ✅ 构建 **Agent 循环**：感知 → 思考 → 行动
- ✅ 实现**上下文管理**和对话压缩
- ✅ 设计**多 Agent 协作**和子 Agent 系统
- ✅ 理解**安全模型**：权限控制、沙盒、命令审计
- ✅ 构建自己的 AI Agent CLI 工具原型

## 👤 适合谁

- 有一定 Claude/ChatGPT 使用经验
- 对 TypeScript/JavaScript 有基础了解
- 每天能投入 **1 小时**学习
- 想构建类似的 AI Agent 工具

## 📅 课程大纲

### 第一周：基础篇 🟢

| 天 | 主题 | 关键文件 |
|----|------|---------|
| [Day 01](./week-01/day-01-architecture-overview.md) | 架构总览：从 `claude` 命令到完整系统 | `main.tsx`, `package.json` |
| [Day 02](./week-01/day-02-entry-and-bootstrap.md) | 入口与启动：CLI 解析与状态初始化 | `cli.tsx`, `bootstrap/state.ts` |
| [Day 03](./week-01/day-03-ink-terminal-ui.md) | 终端 UI：用 React 写命令行界面 | `ink/`, `components/App.tsx` |
| [Day 04](./week-01/day-04-repl-and-input.md) | REPL 循环与用户输入处理 | `screens/REPL.tsx`, `PromptInput/` |
| [Day 05](./week-01/day-05-tool-system-basics.md) | Tool 系统基础：注册、定义与执行 | `Tool.ts`, `tools.ts` |
| [Day 06](./week-01/day-06-message-types.md) | 消息类型与对话流 | `types/message.ts`, `utils/messages.ts` |
| [Day 07](./week-01/day-07-week1-review.md) | 第一周回顾 + 迷你项目 | 综合复习 |

### 第二周：实战篇 🟡

| 天 | 主题 | 关键文件 |
|----|------|---------|
| [Day 08](./week-02/day-08-bash-tool.md) | BashTool 深度解析 | `tools/BashTool/` |
| [Day 09](./week-02/day-09-file-tools.md) | 文件工具：读、写、编辑 | `FileReadTool/`, `FileWriteTool/`, `FileEditTool/` |
| [Day 10](./week-02/day-10-agent-loop.md) | Agent 循环：QueryEngine 与 query() | `QueryEngine.ts`, `query.ts` |
| [Day 11](./week-02/day-11-context-management.md) | 上下文管理：System Prompt 与 CLAUDE.md | `context.ts`, `constants/prompts.ts` |
| [Day 12](./week-02/day-12-context-compression.md) | 上下文压缩与紧凑化 | `services/compact/` |
| [Day 13](./week-02/day-13-agent-tool.md) | 子 Agent 工具：多 Agent 协作 | `tools/AgentTool/` |
| [Day 14](./week-02/day-14-week2-review.md) | 第二周回顾 + 项目实战 | 综合复习 |

### 第三周：进阶篇 🔴

| 天 | 主题 | 关键文件 |
|----|------|---------|
| [Day 15](./week-03/day-15-permission-system.md) | 权限系统与安全模型 | `permissions/`, `bashSecurity.ts` |
| [Day 16](./week-03/day-16-mcp-integration.md) | MCP 协议集成 | `services/mcp/` |
| [Day 17](./week-03/day-17-task-system.md) | 任务系统与后台执行 | `tasks/`, `Task.ts` |
| [Day 18](./week-03/day-18-state-management.md) | 状态管理与 AppState | `state/AppState.ts` |
| [Day 19](./week-03/day-19-cost-and-performance.md) | 成本追踪与性能优化 | `cost-tracker.ts`, `utils/` |
| [Day 20](./week-03/day-20-multi-agent.md) | 多 Agent 系统：Team 与 Swarm | `coordinator/`, `TeamCreateTool/` |
| [Day 21](./week-03/day-21-capstone.md) | 终极项目：构建你的 Agent CLI | 综合实战 |

## 🚀 快速开始

```bash
# 克隆课程
git clone https://github.com/ceci-sh/claude-code-learning.git
cd claude-code-learning

# 打开 PWA 网站（离线可用）
open website/index.html

# 从第一天开始
open week-01/day-01-architecture-overview.md
```

## 📱 PWA 安装

本课程提供可安装的 PWA 网站，支持离线学习：

1. 打开 `website/index.html`
2. 在浏览器中选择"安装"或"添加到主屏幕"
3. 随时随地离线学习！

## 📂 项目结构

```
claude-code-learning/
├── README.md                    # 本文件
├── week-01/                     # 第一周：基础篇
│   ├── day-01-*.md ~ day-07-*.md
│   └── quiz-01.json
├── week-02/                     # 第二周：实战篇
│   ├── day-08-*.md ~ day-14-*.md
│   └── quiz-02.json
├── week-03/                     # 第三周：进阶篇
│   ├── day-15-*.md ~ day-21-*.md
│   └── quiz-03.json
├── projects/                    # 实战项目
├── flashcards/                  # 闪卡复习
├── diagrams/                    # Excalidraw 源文件
└── website/                     # PWA 课程网站
    ├── index.html
    ├── manifest.json
    ├── sw.js
    └── offline.html
```

## 🔗 参考资源

- [Claude Code 源码](https://github.com/) — 516K 行 TypeScript
- [Ink — React for CLI](https://github.com/vadimdemedes/ink) — 终端 UI 框架
- [Anthropic API 文档](https://docs.anthropic.com/) — Claude API
- [MCP 协议](https://modelcontextprotocol.io/) — Model Context Protocol

## 📄 License

MIT — 学习使用，请勿用于商业发布 Claude Code 本身。
