# Day 20: Production Patterns

> "能跑起来只是开始，能稳定运行才是工程"

## 🎯 学习目标

1. 理解 Claude Code 的错误处理架构
2. 掌握日志系统和诊断追踪
3. 学会 GrowthBook Feature Flags 的使用
4. 理解监控和告警模式

## 📖 核心概念

### 错误处理层次

```
┌─────────────────────────────────────┐
│ Layer 4: 全局异常处理               │
│ process.on('uncaughtException')     │
├─────────────────────────────────────┤
│ Layer 3: API 错误处理               │
│ 重试、降级、用户提示                │
├─────────────────────────────────────┤
│ Layer 2: 工具错误处理               │
│ validateInput、try/catch、降级输出  │
├─────────────────────────────────────┤
│ Layer 1: 操作错误处理               │
│ 文件不存在、权限不足、网络超时      │
└─────────────────────────────────────┘
```

### 错误分类

```typescript
// src/utils/errors.ts

// 文件系统错误
export function isENOENT(error: any): boolean {
  return error?.code === 'ENOENT'  // 文件不存在
}

// Shell 错误
export class ShellError extends Error {
  constructor(
    public command: string,
    public exitCode: number,
    public stderr: string,
  ) {
    super(`Command failed: ${command} (exit ${exitCode})`)
  }
}

// API 错误分类
export function categorizeError(error: Error): {
  category: 'network' | 'auth' | 'rate_limit' | 'server' | 'client'
  retryable: boolean
  userMessage: string
} {
  if (error.message.includes('ECONNREFUSED')) {
    return {
      category: 'network',
      retryable: true,
      userMessage: '网络连接失败，正在重试...',
    }
  }
  
  if ((error as any).status === 401) {
    return {
      category: 'auth',
      retryable: false,
      userMessage: 'API 密钥无效，请检查配置',
    }
  }
  
  if ((error as any).status === 429) {
    return {
      category: 'rate_limit',
      retryable: true,
      userMessage: '请求过于频繁，等待后重试...',
    }
  }
  
  return {
    category: 'client',
    retryable: false,
    userMessage: `发生错误: ${error.message}`,
  }
}
```

### 日志系统

```typescript
// src/utils/log.ts
export function logError(error: Error, context?: string): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message: error.message,
    stack: error.stack,
    context,
  }
  
  // 写入日志文件
  appendFileSync(getLogPath(), JSON.stringify(entry) + '\n')
  
  // 内存中保留最近的错误
  inMemoryErrors.push(entry)
  if (inMemoryErrors.length > 100) {
    inMemoryErrors.shift()
  }
}

// 诊断日志（不包含 PII）
export function logForDiagnosticsNoPII(
  level: string,
  event: string,
  data?: Record<string, unknown>,
): void {
  // 安全的诊断信息，不包含用户数据
  logEvent('diagnostic', {
    level,
    event,
    ...sanitizeData(data),
  })
}
```

### GrowthBook Feature Flags

```typescript
// src/services/analytics/growthbook.ts
// Claude Code 使用 GrowthBook 进行 A/B 测试和功能开关

export function getFeatureValue_CACHED_MAY_BE_STALE<T>(
  featureKey: string,
  defaultValue: T,
): T {
  // 从缓存获取（可能稍有延迟）
  const cached = featureCache.get(featureKey)
  if (cached !== undefined) return cached as T
  
  // 从 GrowthBook 获取
  const value = growthbook.getFeatureValue(featureKey, defaultValue)
  featureCache.set(featureKey, value)
  
  return value
}

// 使用示例
const useNewDiffAlgorithm = getFeatureValue_CACHED_MAY_BE_STALE(
  'new_diff_algorithm',
  false,
)

const maxConcurrentTools = getFeatureValue_CACHED_MAY_BE_STALE(
  'max_concurrent_tools',
  5,
)

// 分析事件
logEvent('tool_execution', {
  tool: 'BashTool',
  duration_ms: 1234,
  success: true,
  feature_flags: {
    new_diff: useNewDiffAlgorithm,
    max_concurrent: maxConcurrentTools,
  },
})
```

### 分析事件追踪

```typescript
// src/services/analytics/index.ts
export function logEvent(
  eventName: string,
  metadata: AnalyticsMetadata,
): void {
  // 事件类型示例：
  // - tool_execution: 工具执行
  // - api_request: API 调用
  // - permission_decision: 权限决策
  // - session_start/end: 会话开始/结束
  // - error: 错误发生
  // - distillation_detected: 检测到蒸馏
  
  const event = {
    name: eventName,
    timestamp: Date.now(),
    sessionId: getSessionId(),
    ...metadata,
  }
  
  // 批量发送到分析服务
  eventBuffer.push(event)
  if (eventBuffer.length >= BATCH_SIZE) {
    flushEvents()
  }
}
```

## 🔧 关键技术

### 1. 优雅降级

```typescript
// 当主要功能失败时，提供降级方案
async function readFileWithFallback(path: string): Promise<string> {
  try {
    // 首选：使用自定义的读取函数（支持编码检测）
    return await readFileWithEncoding(path)
  } catch {
    try {
      // 降级 1：标准 UTF-8 读取
      return readFileSync(path, 'utf-8')
    } catch {
      try {
        // 降级 2：二进制读取 + 手动转换
        const buffer = readFileSync(path)
        return buffer.toString('latin1')
      } catch (finalError) {
        // 最终降级：返回错误信息
        return `[Unable to read file: ${(finalError as Error).message}]`
      }
    }
  }
}
```

### 2. 会话恢复

```typescript
// 从崩溃中恢复
class SessionRecovery {
  private checkpointPath: string
  
  async saveCheckpoint(state: SessionState): Promise<void> {
    const checkpoint = {
      messages: state.messages,
      cwd: state.cwd,
      totalCost: state.totalCost,
      timestamp: Date.now(),
    }
    
    await writeFile(this.checkpointPath, JSON.stringify(checkpoint))
  }
  
  async recover(): Promise<SessionState | null> {
    try {
      const data = await readFile(this.checkpointPath, 'utf-8')
      const checkpoint = JSON.parse(data)
      
      // 检查是否过期（超过 1 小时不恢复）
      if (Date.now() - checkpoint.timestamp > 3600_000) {
        return null
      }
      
      console.log('🔄 从上次崩溃恢复会话...')
      return checkpoint
    } catch {
      return null
    }
  }
}
```

### 3. 健康检查

```typescript
class HealthChecker {
  async check(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: { name: string; ok: boolean; message: string }[]
  }> {
    const checks = await Promise.all([
      this.checkAPI(),
      this.checkFileSystem(),
      this.checkMemory(),
      this.checkMCPServers(),
    ])
    
    const failedCount = checks.filter(c => !c.ok).length
    
    return {
      status: failedCount === 0 ? 'healthy' :
              failedCount <= 1 ? 'degraded' : 'unhealthy',
      checks,
    }
  }
  
  private async checkAPI() {
    try {
      // 轻量级 API 调用
      await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return { name: 'API', ok: true, message: 'Connected' }
    } catch (e) {
      return { name: 'API', ok: false, message: (e as Error).message }
    }
  }
  
  private async checkMemory() {
    const usage = process.memoryUsage()
    const heapUsed = usage.heapUsed / 1024 / 1024
    return {
      name: 'Memory',
      ok: heapUsed < 500,
      message: `Heap: ${heapUsed.toFixed(0)}MB`,
    }
  }
}
```

## 💻 代码示例

### 生产级错误处理器

```typescript
class ProductionErrorHandler {
  private retryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
  }
  
  async withRetry<T>(
    fn: () => Promise<T>,
    context: string,
  ): Promise<T> {
    let lastError: Error
    
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        const { retryable } = categorizeError(lastError)
        
        if (!retryable || attempt === this.retryConfig.maxRetries) {
          logError(lastError, context)
          throw lastError
        }
        
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt),
          this.retryConfig.maxDelay,
        )
        
        console.log(`⏳ ${context}: 重试 ${attempt + 1}/${this.retryConfig.maxRetries} (${delay}ms后)`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
    
    throw lastError!
  }
}
```

## 🏋️ 练习任务

### 练习 1：错误恢复（20 分钟）
实现 `withRetry` 函数，支持指数退避、最大重试次数、错误分类。

### 练习 2：Feature Flag 系统（20 分钟）
实现一个简单的 Feature Flag 管理器，支持布尔值和百分比灰度发布。

### 练习 3：监控仪表板（20 分钟）
设计一个监控方案，追踪：API 延迟、错误率、工具执行时间、内存使用。

## 📚 扩展阅读

1. **[GrowthBook 文档](https://docs.growthbook.io/)** - Feature Flag 平台
2. **[Circuit Breaker Pattern](https://martinfowler.com/bliki/CircuitBreaker.html)** - 熔断器模式
3. **[12-Factor App](https://12factor.net/)** - 现代应用设计原则

## 🤔 反思问题

1. Feature Flag 的"缓存可能过期"（`CACHED_MAY_BE_STALE`）设计有什么风险？
2. 日志中为什么要避免 PII（个人身份信息）？
3. 会话恢复的 1 小时过期时间是否合理？

---

## 📝 今日总结

✅ 4 层错误处理架构  
✅ 错误分类和重试策略  
✅ 日志系统和诊断追踪  
✅ GrowthBook Feature Flags  
✅ 会话恢复和健康检查  

## 🔗 导航

- [← Day 19: MCP Integration](day-19-mcp.md)
- [→ Day 21: Capstone Project](day-21-capstone.md)
- [📊 Week 3 Quiz](quiz-03.json)
