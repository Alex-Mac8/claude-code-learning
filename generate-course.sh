#!/bin/bash
# Course generation automation script

# Array of remaining days with topics
declare -A days=(
  ["week-01/day-03-ink-advanced"]="Ink 高级特性"
  ["week-01/day-04-tool-system"]="Tool 系统设计"
  ["week-01/day-05-sandbox-security"]="沙箱与安全"
  ["week-01/day-06-state-management"]="State 管理"
  ["week-01/day-07-week1-review"]="第一周回顾 + 项目实践"
  ["week-02/day-08-file-tools"]="工具实现：文件操作"
  ["week-02/day-09-shell-tools"]="工具实现：Shell 执行"
  ["week-02/day-10-context-management"]="上下文管理"
  ["week-02/day-11-memory-system"]="Memory 系统"
  ["week-02/day-12-system-prompt"]="System Prompt 工程"
  ["week-02/day-13-sub-agent"]="子 Agent 协调"
  ["week-02/day-14-week2-review"]="第二周回顾 + 项目实践"
  ["week-03/day-15-task-graph"]="任务图与状态机"
  ["week-03/day-16-background-tasks"]="后台任务系统"
  ["week-03/day-17-skill-mcp"]="Skill 与 MCP"
  ["week-03/day-18-security-audit"]="安全审计"
  ["week-03/day-19-performance"]="性能优化"
  ["week-03/day-20-testing-debugging"]="测试与调试"
  ["week-03/day-21-capstone"]="Capstone 项目"
)

echo "Course structure ready for generation."
echo "Total remaining: ${#days[@]} days"

