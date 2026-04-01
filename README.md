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
| Day 4 | [Tool 系统设计](week-01/day-04-tool-system.md) | Tool 接口、参数验证、结果处理 |
| Day 5 | [沙箱与安全](week-01/day-05-sandbox-security.md) | 进程隔离、权限控制、逃逸防护 |
| Day 6 | [State 管理](week-01/day-06-state-management.md) | 会话状态、持久化、恢复机制 |
| Day 7 | [第一周回顾 + 项目实践](week-01/day-07-week1-review.md) | 构建简单的 CLI Agent 原型 |

### 第二周：核心能力（Building）

| 天数 | 主题 | 核心内容 |
|------|------|----------|
| Day 8 | [工具实现：文件操作](week-02/day-08-file-tools.md) | FileRead、FileWrite、FileEdit |
| Day 9 | [工具实现：Shell 执行](week-02/day-09-shell-tools.md) | BashTool、安全检查、输出流 |
| Day 10 | [上下文管理](week-02/day-10-context-management.md) | 三级压缩、缓存策略、Token 优化 |
| Day 11 | [Memory 系统](week-02/day-11-memory-system.md) | 四层记忆结构、检索、持久化 |
| Day 12 | [System Prompt 工程](week-02/day-12-system-prompt.md) | 提示词拼装、分层缓存、失效检测 |
| Day 13 | [子 Agent 协调](week-02/day-13-sub-agent.md) | 任务分发、通信协议、结果聚合 |
| Day 14 | [第二周回顾 + 项目实践](week-02/day-14-week2-review.md) | 添加完整 Tool 系统 + Context 管理 |

### 第三周：进阶功能（Advanced）

| 天数 | 主题 | 核心内容 |
|------|------|----------|
| Day 15 | [任务图与状态机](week-03/day-15-task-graph.md) | 父子关系、回收机制、可视化 |
| Day 16 | [后台任务系统](week-03/day-16-background-tasks.md) | Cron 调度、Dream Agent、异步处理 |
| Day 17 | [Skill 与 MCP](week-03/day-17-skill-mcp.md) | Prompt 模板、外部服务集成 |
| Day 18 | [安全审计](week-03/day-18-security-audit.md) | OWASP Top 10、权限控制、日志监控 |
| Day 19 | [性能优化](week-03/day-19-performance.md) | 并发控制、缓存策略、内存管理 |
| Day 20 | [测试与调试](week-03/day-20-testing-debugging.md) | 单元测试、集成测试、调试技巧 |
| Day 21 | [Capstone 项目](week-03/day-21-capstone.md) | 构建完整的个人 AI Assistant |

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
https://your-username.github.io/claude-code-learning/
```

### 本地学习

克隆仓库并在编辑器中阅读：
```bash
git clone https://github.com/your-username/claude-code-learning.git
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

- **问题讨论**：[GitHub Issues](https://github.com/your-username/claude-code-learning/issues)
- **学习笔记分享**：[GitHub Discussions](https://github.com/your-username/claude-code-learning/discussions)
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
