# Todo Management Command

Manage tasks and track progress for the current project.

## Usage:
```
claude /todo [action] [args]
```

## Actions:

### List all todos
```
claude /todo
claude /todo list
```
Shows all todos with their status and priority.

### Add a new todo
```
claude /todo add "Task description" [priority]
```
Priority: high, medium, low (default: medium)

Examples:
```
claude /todo add "Implement user authentication" high
claude /todo add "Update documentation"
```

### Update todo status
```
claude /todo update [id] [status]
```
Status: pending, in_progress, completed

Example:
```
claude /todo update 1 in_progress
```

### Remove a todo
```
claude /todo remove [id]
```

### Clear completed todos
```
claude /todo clear-completed
```

### Show statistics
```
claude /todo stats
```
Shows:
- Total tasks
- Completed percentage
- Tasks by priority
- Tasks by status

## Workflow Integration:

When starting work on an issue:
1. `claude /todo add "Issue #123: [description]" high`
2. `claude /todo update [id] in_progress`
3. Work on the task
4. `claude /todo update [id] completed`

## Format:

Todos are displayed as:
```
[ID] [Status] [Priority] Description
[1] ⏳ HIGH: Implement user authentication
[2] ✅ MEDIUM: Update documentation
[3] 📋 LOW: Refactor helper functions
```

Status icons:
- 📋 pending
- ⏳ in_progress
- ✅ completed

## Best Practices:

1. Keep todos atomic and specific
2. Link to GitHub issues when applicable
3. Update status in real-time
4. Review todos at start/end of session
5. Clear completed todos weekly