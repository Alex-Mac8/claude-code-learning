# Claude Code 源码学习课程

**21天从零构建 AI Agent CLI 工具**

## 📚 课程概览

本课程基于泄露的 Claude Code 真实源码（516K 行代码，1,921 个 TypeScript 文件），带你从零开始学习如何构建工业级 AI Agent CLI 工具。

**适合人群**：有 ChatGPT/Claude 使用经验，想要深入理解 Agent 系统架构的开发者

**学习时长**：每天 1 小时，共 21 天

**学习目标**：掌握 Terminal UI、Tool System、Agent 协调、安全机制等全栈技能，能够独立构建类似的 AI Agent CLI 工具

## 🗓️ 课程安排

### 第一周：基础架构（Foundations）

| 天数 | 主题 | 核心内容 |
|------|------|----------|
| Day 1 | [Agent 系统概览](week-01/day-01-agent-overview.md) | ReAct 循环、架构分层、目录结构 |
| Day 2 | [Terminal UI 基础 (Ink)](week-01/day-02-ink-basics.md) | React 组件、布局系统、事件处理 |
| Day 3 | [Ink 高级特性](week-01/day-03-ink-advanced.md) | 自定义渲染、性能优化、流式输出 |
| Day 4 | [Tool System 基础](week-01/day-04-tool-system.md) | Tool.ts、工具注册、参数验证 |
| Day 5 | [Context Management](week-01/day-05-context-management.md) | 上下文窗口、Prompt Cache、优化策略 |
| Day 6 | [BashTool 深入](week-01/day-06-bash-tool.md) | BashTool、沙盒、权限检查、安全规则 |
| Day 7 | [Week 1 项目](week-01/day-07-week1-project.md) | 构建简单的 CLI Agent |

### 第二周：核心能力（Building）

| 天数 | 主题 | 核心内容 |
|------|------|----------|
| Day 8 | [File Operations](week-02/day-08-file-operations.md) | FileRead、FileWrite、FileEdit 工具 |
| Day 9 | [Glob & Grep](week-02/day-09-glob-grep.md) | 文件搜索、内容检索、正则表达式 |
| Day 10 | [Agent Task System](week-02/day-10-agent-task.md) | Task.ts、LocalAgentTask、任务编排 |
| Day 11 | [QueryEngine 详解](week-02/day-11-query-engine.md) | API 调用、流式响应、错误处理 |
| Day 12 | [Message & UI](week-02/day-12-message-ui.md) | 消息渲染、Diff 显示、PromptInput |
| Day 13 | [Coordinator Mode](week-02/day-13-coordinator.md) | 多 Agent 协调、工作分配、结果汇总 |
| Day 14 | [Week 2 项目](week-02/day-14-week2-project.md) | 构建文件处理 Agent |

### 第三周：进阶功能（Advanced）

| 天数 | 主题 | 核心内容 |
|------|------|----------|
| Day 15 | [Security Architecture](week-03/day-15-security.md) | 沙盒、权限系统、Zsh 威胁模型 |
| Day 16 | [Anti-Distillation](week-03/day-16-anti-distillation.md) | 假工具注入、Connector Text、客户端认证 |
| Day 17 | [Prompt Cache 优化](week-03/day-17-prompt-cache.md) | Cache-break 检测、Sticky Latches |
| Day 18 | [Performance](week-03/day-18-performance.md) | Ink 优化、ASCII Pool、Patch Optimizer |
| Day 19 | [MCP Integration](week-03/day-19-mcp.md) | Model Context Protocol、Server 管理 |
| Day 20 | [Production Patterns](week-03/day-20-production.md) | 错误处理、日志、GrowthBook Feature Flags |
| Day 21 | [Capstone Project](week-03/day-21-capstone.md) | 构建完整的 AI Agent CLI |

## 🎯 学习成果

完成本课程后，你将能够：

- ✅ 理解工业级 Agent 系统的完整架构
- ✅ 使用 Ink 构建美观的 Terminal UI
- ✅ 实现安全的 Tool 系统（文件、Shell、网络）
- ✅ 设计多 Agent 协作机制
- ✅ 优化上下文管理和 Token 使用
- ✅ 集成外部服务（MCP 协议）
- ✅ 独立构建自己的 AI Agent CLI 工具

## 📖 如何使用本课程

### 在线学习

访问课程网站（PWA 应用，可安装到桌面）：
```
https://CeciliaW888.github.io/claude-code-learning/
```

### 本地学习

克隆仓库并在编辑器中阅读：
```bash
git clone https://github.com/CeciliaW888/claude-code-learning.git
cd claude-code-learning
```

### 每日学习流程

1. **阅读当天指南**（30 分钟）- 理解核心概念和代码示例
2. **完成练习**（20 分钟）- 动手实践，加深理解
3. **复习测验**（10 分钟）- 检验学习成果
4. **反思记录**（5 分钟）- 写下学到的关键点

## 📚 参考资料

### 源码仓库
- [Cloud Code 源码](https://github.com/Janlaywss/cloud-code) - 开源版本
- [Cloud Code Study](https://cloud-code-study.vercel.app/) - 中文源码分析文档

### 技术栈文档
- [Ink](https://github.com/vadimdemedes/ink) - React for CLI
- [TypeScript](https://www.typescriptlang.org/) - 类型系统
- [Node.js](https://nodejs.org/) - 运行时
- [Anthropic API](https://docs.anthropic.com/) - Claude 模型

### 相关文章
- [Building effective agents](https://www.anthropic.com/research/building-effective-agents) - Anthropic 官方指南
- [ReAct: Synergizing Reasoning and Acting](https://arxiv.org/abs/2210.03629) - ReAct 论文
- [LangChain Agents](https://python.langchain.com/docs/modules/agents/) - Agent 设计模式

## 💬 社区与支持

- **问题讨论**：[GitHub Issues](https://github.com/CeciliaW888/claude-code-learning/issues)
- **学习笔记分享**：[GitHub Discussions](https://github.com/CeciliaW888/claude-code-learning/discussions)
- **作者 RedNote**：[@702329823](https://www.xiaohongshu.com/user/profile/702329823) - AI 工具与学习分享

## 🎓 进阶学习

完成本课程后，可以继续学习：

- **多 Agent 系统**：Team Swarm、Buddy Companion 等高级模式
- **分布式 Agent**：跨机器协作、远程 Agent 管理
- **领域特化**：代码审查、文档生成、测试自动化等专业场景

## 📄 License

本课程内容采用 [MIT License](LICENSE) 开源。

课程基于 Claude Code 源码分析，仅供学习研究使用。请尊重原项目的许可证和知识产权。

---

**开始学习** → [Day 1: Agent 系统概览](week-01/day-01-agent-overview.md)

祝学习愉快！🚀
