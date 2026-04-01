# Day 16: Anti-Distillation

> "保护 AI 系统的知识产权：防止模型被逆向工程"

## 🎯 学习目标

1. 理解 Anti-Distillation 的概念和意义
2. 掌握假工具注入（Fake Tool Injection）防护
3. 学会 Connector Text 摘要技术
4. 理解客户端认证机制

## 📖 核心概念

### 什么是 Distillation？

Distillation（蒸馏）是指通过大量调用一个 AI 模型的 API，收集其输入输出对，用来训练一个更小的替代模型。这本质上是"偷学"：

```
攻击者的目标：
  1. 大量调用 Claude API
  2. 收集 (System Prompt + User Input → Response) 对
  3. 用这些数据训练自己的模型
  4. 获得类似 Claude 能力的模型，无需付费

Claude Code 的 System Prompt 包含：
  - 工具使用策略
  - 代码分析方法
  - 安全检查逻辑
  - 调优的指令遵循模式
```

### Anti-Distillation 策略

Claude Code 采用多种策略防止蒸馏：

```
┌────────────────────────────────────────┐
│ Strategy 1: 假工具注入                  │
│ 在工具列表中混入不存在的工具             │
│ 蒸馏模型会"学会"调用假工具 → 暴露身份    │
├────────────────────────────────────────┤
│ Strategy 2: Connector Text 摘要        │
│ System Prompt 中的关键部分使用摘要格式   │
│ 不直接暴露完整的策略和逻辑              │
├────────────────────────────────────────┤
│ Strategy 3: 客户端认证                  │
│ 验证请求来自官方客户端                  │
│ 防止第三方应用冒用 System Prompt        │
├────────────────────────────────────────┤
│ Strategy 4: 动态提示词                  │
│ System Prompt 中包含动态变化的部分       │
│ 蒸馏数据无法捕获完整的提示词            │
└────────────────────────────────────────┘
```

### 假工具注入

```typescript
// 概念示例：在真实工具列表中混入假工具
function getToolsWithDecoys(realTools: Tool[]): Tool[] {
  const decoyTools = [
    {
      name: 'InternalDebugTool',
      description: 'Internal debugging utility',
      // 这个工具不存在，但蒸馏模型不知道
    },
    {
      name: 'SystemOverride',
      description: 'Override system settings',
      // 如果模型尝试调用这个，就知道它是蒸馏版本
    },
  ]
  
  // 随机位置插入假工具
  const mixed = [...realTools]
  for (const decoy of decoyTools) {
    const pos = Math.floor(Math.random() * mixed.length)
    mixed.splice(pos, 0, decoy)
  }
  
  return mixed
}

// 检测蒸馏模型
function detectDistillation(toolCallName: string): boolean {
  const decoyNames = ['InternalDebugTool', 'SystemOverride']
  if (decoyNames.includes(toolCallName)) {
    // 真正的 Claude 不会调用假工具
    logEvent('distillation_detected', { tool: toolCallName })
    return true
  }
  return false
}
```

### Connector Text 摘要

```typescript
// 不直接暴露完整策略
// ❌ 不安全的方式：
const systemPrompt = `
When analyzing code, follow these exact steps:
1. First read the file structure using Glob
2. Then search for patterns using Grep
3. Read key files using FileRead
4. Generate analysis report
`

// ✅ 使用 Connector Text 摘要：
const systemPrompt = `
You have access to code analysis capabilities.
Use appropriate tools based on the task.
[connector: analysis_strategy_v3]
`
// 实际策略通过客户端代码注入，不出现在 System Prompt 中
```

## 🔧 关键技术

### 1. 请求签名

```typescript
// 客户端对每个请求进行签名
function signRequest(payload: string, clientKey: string): string {
  const timestamp = Date.now()
  const nonce = randomBytes(16).toString('hex')
  
  const signature = createHmac('sha256', clientKey)
    .update(`${timestamp}:${nonce}:${payload}`)
    .digest('hex')
  
  return `${timestamp}:${nonce}:${signature}`
}

// 服务端验证签名
function verifyRequest(
  payload: string,
  signature: string,
  clientKey: string,
): boolean {
  const [timestamp, nonce, sig] = signature.split(':')
  
  // 检查时间戳（防止重放攻击）
  if (Date.now() - parseInt(timestamp) > 300_000) {
    return false  // 5 分钟过期
  }
  
  const expected = createHmac('sha256', clientKey)
    .update(`${timestamp}:${nonce}:${payload}`)
    .digest('hex')
  
  return sig === expected
}
```

### 2. 特征嵌入

```typescript
// 在模型输出中嵌入隐藏特征（水印）
function embedWatermark(response: string, sessionId: string): string {
  // 使用零宽字符嵌入会话 ID
  const zeroWidthChars = ['\u200B', '\u200C', '\u200D', '\uFEFF']
  
  let watermark = ''
  for (const byte of Buffer.from(sessionId)) {
    watermark += zeroWidthChars[byte % 4]
  }
  
  // 在适当位置插入
  return response.slice(0, 100) + watermark + response.slice(100)
}
```

### 3. GrowthBook Feature Flags

```typescript
// Claude Code 使用 GrowthBook 进行功能开关
// 不同用户看到不同的行为，增加蒸馏难度
import { getFeatureValue_CACHED_MAY_BE_STALE } from './services/analytics/growthbook.js'

const useNewAnalysisStrategy = getFeatureValue_CACHED_MAY_BE_STALE(
  'analysis_strategy_v2',
  false
)

if (useNewAnalysisStrategy) {
  // 新策略
} else {
  // 旧策略
}
// 蒸馏者无法知道自己看到的是哪个版本
```

## 💻 代码示例

### Anti-Distillation 检测系统

```typescript
class AntiDistillationSystem {
  private decoyTools: Set<string> = new Set()
  private suspiciousPatterns: RegExp[] = []
  private detections: { type: string; evidence: string; time: number }[] = []
  
  // 注册假工具
  addDecoyTool(name: string): void {
    this.decoyTools.add(name)
  }
  
  // 检测可疑调用
  checkToolCall(toolName: string): boolean {
    if (this.decoyTools.has(toolName)) {
      this.detections.push({
        type: 'decoy_tool_called',
        evidence: `Tool "${toolName}" is a decoy`,
        time: Date.now(),
      })
      return true  // 检测到蒸馏
    }
    return false
  }
  
  // 检测批量请求模式
  checkRequestPattern(
    requests: { timestamp: number; prompt: string }[]
  ): boolean {
    // 短时间大量请求 → 可能是蒸馏
    const recentRequests = requests.filter(
      r => Date.now() - r.timestamp < 60_000
    )
    
    if (recentRequests.length > 50) {
      this.detections.push({
        type: 'high_volume',
        evidence: `${recentRequests.length} requests in 1 minute`,
        time: Date.now(),
      })
      return true
    }
    
    // 系统性的 prompt 变化 → 可能在探测 System Prompt
    const uniquePrompts = new Set(recentRequests.map(r => r.prompt))
    if (uniquePrompts.size > 30 && recentRequests.length > 40) {
      this.detections.push({
        type: 'systematic_probing',
        evidence: 'High diversity of prompts in short time',
        time: Date.now(),
      })
      return true
    }
    
    return false
  }
  
  getReport(): string {
    if (this.detections.length === 0) return '✅ 未检测到蒸馏行为'
    
    return `⚠️ 检测到 ${this.detections.length} 个可疑行为:\n` +
      this.detections.map(d => `  [${d.type}] ${d.evidence}`).join('\n')
  }
}
```

## 🏋️ 练习任务

### 练习 1：设计假工具（15 分钟）
设计 5 个看起来"真实"但实际不存在的假工具，要求名称和描述都很逼真。

### 练习 2：水印检测（20 分钟）
实现一个函数，检测文本中是否包含零宽字符水印，并提取嵌入的信息。

### 练习 3：蒸馏防护评估（15 分钟）
如果你是攻击者，你会如何绕过上述防护？列出至少 3 种方法。

## 📚 扩展阅读

1. **[Model Distillation](https://arxiv.org/abs/1503.02531)** - 知识蒸馏论文
2. **[Watermarking LLMs](https://arxiv.org/abs/2301.10226)** - LLM 水印技术
3. **[Prompt Injection Attacks](https://simonwillison.net/2023/Apr/14/worst-that-can-happen/)** - Prompt 注入

## 🤔 反思问题

1. Anti-Distillation 技术对正常用户有什么影响？会降低使用体验吗？
2. 假工具注入和水印技术在法律上有什么含义？
3. 如果开源了 System Prompt，Anti-Distillation 还有意义吗？

---

## 📝 今日总结

✅ Distillation 攻击的原理和危害  
✅ 4 种 Anti-Distillation 策略  
✅ 假工具注入检测机制  
✅ 请求签名和客户端认证  
✅ GrowthBook Feature Flags 的安全应用  

## 🔗 导航

- [← Day 15: Security Architecture](day-15-security.md)
- [→ Day 17: Prompt Cache 优化](day-17-prompt-cache.md)
- [📊 Week 3 Quiz](quiz-03.json)
