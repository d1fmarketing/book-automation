# Todo Management Command

Manage tasks and track progress for the current project.

## Usage

```bash
claude /todo [action] [args]
```bash

## Actions

### List all todos

```bash
claude /todo
claude /todo list
```bash

Shows all todos with their status and priority.

### Add a new todo

```bash
claude /todo add "Task description" [priority]
```bash

Priority: high, medium, low (default: medium)

Examples:

```bash
claude /todo add "Implement user authentication" high
claude /todo add "Update documentation"
```bash

### Update todo status

```bash
claude /todo update [id] [status]
```bash

Status: pending, in_progress, completed

Example:

```bash
claude /todo update 1 in_progress
```bash

### Remove a todo

```bash
claude /todo remove [id]
```bash

### Clear completed todos

```bash
claude /todo clear-completed
```bash

### Show statistics

```bash
claude /todo stats
```bash

Shows:

- Total tasks
- Completed percentage
- Tasks by priority
- Tasks by status

## Workflow Integration

When starting work on an issue:

1. `claude /todo add "Issue #123: [description]" high`
2. `claude /todo update [id] in_progress`
3. Work on the task
4. `claude /todo update [id] completed`

## Format

Todos are displayed as:

```bash
[ID] [Status] [Priority] Description
[1] ⏳ HIGH: Implement user authentication
[2] ✅ MEDIUM: Update documentation
[3] 📋 LOW: Refactor helper functions
```bash

Status icons:

- 📋 pending
- ⏳ in_progress
- ✅ completed

## Best Practices

1. Keep todos atomic and specific
2. Link to GitHub issues when applicable
3. Update status in real-time
4. Review todos at start/end of session
5. Clear completed todos weekly
