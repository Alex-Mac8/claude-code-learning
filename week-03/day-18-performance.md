# Day 18: Performance 优化

> "性能不是可选的附加功能，是用户体验的核心"

## 🎯 学习目标

1. 理解 Ink 渲染优化和 ASCII Pool
2. 掌握 Patch Optimizer 的差异计算优化
3. 学会 Line-width Cache 的实现
4. 识别和解决常见的性能瓶颈

## 📖 核心概念

### Ink 渲染性能

Ink 使用 React Virtual DOM + Yoga 布局引擎。每次状态更新都会触发：

```
setState() → Virtual DOM Diff → Yoga Layout → ANSI 输出

性能瓶颈：
1. 频繁的 setState 导致过多渲染
2. Yoga 布局计算（Flexbox）开销
3. ANSI 转义序列的字符串拼接
4. Terminal 重绘闪烁
```

### Static 组件优化

```typescript
// 问题：聊天历史每次更新都重新渲染所有消息
function BadChatHistory({ messages }) {
  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => (
        <Text key={i}>{msg.content}</Text>  // 每次都重渲染！
      ))}
    </Box>
  )
}

// 解决：使用 Static 组件冻结已有内容
function GoodChatHistory({ messages }) {
  return (
    <Static items={messages}>
      {(msg, i) => (
        <Text key={i}>{msg.content}</Text>  // 只渲染新增的！
      )}
    </Static>
  )
}
```

### ASCII Pool：字符串复用

Claude Code 需要频繁生成 ANSI 转义序列（颜色、样式、位置），这些字符串有大量重复：

```typescript
// 问题：每次都创建新字符串
function colorize(text: string, color: string): string {
  return `\x1b[${colorCode(color)}m${text}\x1b[0m`  // 每次都分配新内存
}

// 优化：ASCII Pool 缓存常用序列
class ASCIIPool {
  private cache: Map<string, string> = new Map()
  
  get(colorCode: number): string {
    const key = `\x1b[${colorCode}m`
    let cached = this.cache.get(key)
    if (!cached) {
      cached = key
      this.cache.set(key, cached)
    }
    return cached
  }
  
  reset(): string {
    return this.get(0)  // \x1b[0m 复用同一个字符串
  }
}

const pool = new ASCIIPool()
// 所有 \x1b[32m（绿色）引用同一个对象，减少 GC 压力
```

### Patch Optimizer

Diff 计算在大文件上可能很慢。Patch Optimizer 优化差异计算：

```typescript
// 标准 diff：O(n*m) 复杂度
function naiveDiff(old: string[], new_: string[]): Patch {
  // 对于 10000 行的文件，可能需要 100M 次比较
  return fullDiff(old, new_)
}

// 优化的 diff：先找到不变的前缀和后缀
function optimizedDiff(old: string[], new_: string[]): Patch {
  // 1. 跳过相同的前缀
  let prefixLen = 0
  while (prefixLen < old.length && prefixLen < new_.length
    && old[prefixLen] === new_[prefixLen]) {
    prefixLen++
  }
  
  // 2. 跳过相同的后缀
  let suffixLen = 0
  while (suffixLen < old.length - prefixLen 
    && suffixLen < new_.length - prefixLen
    && old[old.length - 1 - suffixLen] === new_[new_.length - 1 - suffixLen]) {
    suffixLen++
  }
  
  // 3. 只对变化部分做 diff
  const oldMiddle = old.slice(prefixLen, old.length - suffixLen)
  const newMiddle = new_.slice(prefixLen, new_.length - suffixLen)
  
  // 对于单处修改（最常见场景），这把 O(n*m) 降到 O(k*k)
  // k << n, k << m
  return fullDiff(oldMiddle, newMiddle)
}
```

### Line-width Cache

Terminal UI 需要频繁计算字符串的显示宽度（中文字符占 2 个位置，emoji 占 2 个位置）：

```typescript
// 问题：每次渲染都重新计算宽度
function getWidth(text: string): number {
  let width = 0
  for (const char of text) {
    // Unicode 宽度判断很慢
    width += isWideChar(char) ? 2 : 1
  }
  return width  // 每帧都计算，浪费！
}

// 优化：缓存计算结果
class LineWidthCache {
  private cache: Map<string, number> = new Map()
  private maxSize = 10000
  
  getWidth(text: string): number {
    let width = this.cache.get(text)
    if (width !== undefined) return width
    
    width = 0
    for (const char of text) {
      width += isFullWidth(char) ? 2 : 1
    }
    
    // LRU 淘汰
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    
    this.cache.set(text, width)
    return width
  }
  
  invalidate(): void {
    this.cache.clear()
  }
}
```

## 🔧 关键技术

### 1. 渲染节流

```typescript
// 限制渲染频率，避免 Terminal 闪烁
function useThrottledRender(value: any, intervalMs = 100) {
  const [rendered, setRendered] = useState(value)
  const lastUpdate = useRef(0)
  
  useEffect(() => {
    const now = Date.now()
    if (now - lastUpdate.current >= intervalMs) {
      setRendered(value)
      lastUpdate.current = now
    } else {
      const timer = setTimeout(() => {
        setRendered(value)
        lastUpdate.current = Date.now()
      }, intervalMs - (now - lastUpdate.current))
      return () => clearTimeout(timer)
    }
  }, [value])
  
  return rendered
}
```

### 2. 懒加载模块

```typescript
// Claude Code 使用懒加载减少启动时间
// 不在顶层 import，而是在需要时才加载
const messageSelector = (): typeof import('./MessageSelector.js') =>
  require('./MessageSelector.js')

// 条件编译
const getCoordinatorMode = feature('COORDINATOR_MODE')
  ? require('./coordinator/coordinatorMode.js')
  : () => ({})
```

### 3. 内存管理

```typescript
// 避免内存泄漏的模式
class ResourceManager {
  private cleanups: (() => void)[] = []
  
  register(cleanup: () => void): void {
    this.cleanups.push(cleanup)
  }
  
  dispose(): void {
    for (const cleanup of this.cleanups) {
      cleanup()
    }
    this.cleanups = []
  }
}

// 使用
const resources = new ResourceManager()
const watcher = watchFile(path, callback)
resources.register(() => watcher.close())

// 会话结束时
resources.dispose()
```

## 💻 代码示例

### 性能监控工具

```typescript
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map()
  
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now()
    const result = fn()
    const duration = performance.now() - start
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(duration)
    
    return result
  }
  
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now()
    const result = await fn()
    const duration = performance.now() - start
    
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(duration)
    
    return result
  }
  
  report(): void {
    console.log('\n⏱️ 性能报告')
    console.log('─'.repeat(60))
    
    for (const [name, durations] of this.metrics) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length
      const max = Math.max(...durations)
      const p95 = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)]
      
      console.log(`${name}:`)
      console.log(`  调用次数: ${durations.length}`)
      console.log(`  平均: ${avg.toFixed(2)}ms`)
      console.log(`  P95:  ${p95?.toFixed(2) || 'N/A'}ms`)
      console.log(`  最大: ${max.toFixed(2)}ms`)
    }
  }
}
```

## 🏋️ 练习任务

### 练习 1：渲染优化（20 分钟）
实现一个 Ink 组件，显示实时日志流（每秒 100+ 行），确保不卡顿。

### 练习 2：Diff 性能测试（15 分钟）
对比 naiveDiff 和 optimizedDiff 在不同大小文件上的性能。

### 练习 3：内存分析（15 分钟）
用 `process.memoryUsage()` 监控一个长时间运行的 Agent 的内存增长。

## 📚 扩展阅读

1. **[React 性能优化](https://react.dev/reference/react/memo)** - memo 和 useMemo
2. **[V8 内存管理](https://v8.dev/blog/trash-talk)** - JavaScript 垃圾回收
3. **[Terminal 渲染优化](https://jvns.ca/blog/2024/10/01/terminal-colours/)** - 终端颜色和性能

## 🤔 反思问题

1. Static 组件是否适用于所有场景？什么时候不应该用？
2. Line-width Cache 的 LRU 大小设为 10000 是否合理？
3. 渲染节流 100ms 对用户体验有影响吗？

---

## 📝 今日总结

✅ Ink 渲染优化（Static、节流）  
✅ ASCII Pool 字符串复用  
✅ Patch Optimizer 差异计算优化  
✅ Line-width Cache 宽度缓存  
✅ 内存管理和懒加载模式  

## 🔗 导航

- [← Day 17: Prompt Cache](day-17-prompt-cache.md)
- [→ Day 19: MCP Integration](day-19-mcp.md)
- [📊 Week 3 Quiz](quiz-03.json)
