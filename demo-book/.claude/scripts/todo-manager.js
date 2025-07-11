#!/usr/bin/env node

/**
 * Todo Manager for Claude Elite
 * Manages tasks using a JSON file for persistence
 */

const fs = require('fs').promises;
const path = require('path');
// Simple color codes instead of chalk
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  gray: (text) => `\x1b[90m${text}\x1b[0m`,
  white: (text) => `\x1b[37m${text}\x1b[0m`
};
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

const TODO_FILE = path.join(process.cwd(), '.claude', 'todos.json');

// Ensure .claude directory exists
async function ensureDir() {
  await fs.mkdir(path.dirname(TODO_FILE), { recursive: true });
}

// Load todos from file
async function loadTodos() {
  try {
    const data = await fs.readFile(TODO_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist, return empty array
    return [];
  }
}

// Save todos to file
async function saveTodos(todos) {
  await ensureDir();
  await fs.writeFile(TODO_FILE, JSON.stringify(todos, null, 2));
}

// Display todos in a nice format
function displayTodos(todos, filter = null) {
  if (todos.length === 0) {
    console.log(colors.yellow('No todos found. Add one with: claude /todo add "Task description"'));
    return;
  }
  
  const filtered = filter 
    ? todos.filter(todo => todo.status === filter)
    : todos;
  
  if (filtered.length === 0) {
    console.log(colors.yellow(`No todos with status: ${filter}`));
    return;
  }
  
  console.log(colors.blue('\n📋 Todo List\n'));
  
  // Group by status
  const grouped = {
    pending: filtered.filter(t => t.status === 'pending'),
    in_progress: filtered.filter(t => t.status === 'in_progress'),
    completed: filtered.filter(t => t.status === 'completed')
  };
  
  // Display each group
  Object.entries(grouped).forEach(([status, items]) => {
    if (items.length === 0) return;
    
    const statusEmoji = {
      pending: '⏳',
      in_progress: '🔄',
      completed: '✅'
    }[status];
    
    const statusColor = {
      pending: 'yellow',
      in_progress: 'blue',
      completed: 'green'
    }[status];
    
    console.log(colors[statusColor](`\n${statusEmoji} ${status.toUpperCase()}`));
    
    items.forEach(todo => {
      const priority = {
        high: colors.red('●'),
        medium: colors.yellow('●'),
        low: colors.gray('●')
      }[todo.priority];
      
      console.log(`  ${priority} [${todo.id.slice(0, 8)}] ${todo.content}`);
    });
  });
  
  // Summary
  console.log(colors.gray(`\nTotal: ${filtered.length} tasks`));
}

// Command handlers
const commands = {
  async list(args) {
    const todos = await loadTodos();
    const filter = args[0]; // optional status filter
    displayTodos(todos, filter);
  },
  
  async add(args) {
    if (args.length === 0) {
      console.error(colors.red('Please provide a task description'));
      process.exit(1);
    }
    
    const content = args[0];
    const priority = args[1] || 'medium';
    
    if (!['high', 'medium', 'low'].includes(priority)) {
      console.error(colors.red('Priority must be: high, medium, or low'));
      process.exit(1);
    }
    
    const todos = await loadTodos();
    const newTodo = {
      id: uuidv4(),
      content,
      status: 'pending',
      priority,
      created: new Date().toISOString()
    };
    
    todos.push(newTodo);
    await saveTodos(todos);
    
    console.log(colors.green('✅ Todo added:'));
    console.log(`  ID: ${newTodo.id}`);
    console.log(`  Task: ${content}`);
    console.log(`  Priority: ${priority}`);
  },
  
  async update(args) {
    const [id, field, value] = args;
    
    if (!id || !field || !value) {
      console.error(colors.red('Usage: claude /todo update <id> <field> <value>'));
      console.error(colors.gray('Fields: status, priority, content'));
      console.error(colors.gray('Status: pending, in_progress, completed'));
      process.exit(1);
    }
    
    const todos = await loadTodos();
    const todo = todos.find(t => t.id.startsWith(id));
    
    if (!todo) {
      console.error(colors.red(`Todo not found: ${id}`));
      process.exit(1);
    }
    
    // Validate field
    if (!['status', 'priority', 'content'].includes(field)) {
      console.error(colors.red(`Invalid field: ${field}`));
      process.exit(1);
    }
    
    // Validate values
    if (field === 'status' && !['pending', 'in_progress', 'completed'].includes(value)) {
      console.error(colors.red('Status must be: pending, in_progress, or completed'));
      process.exit(1);
    }
    
    if (field === 'priority' && !['high', 'medium', 'low'].includes(value)) {
      console.error(colors.red('Priority must be: high, medium, or low'));
      process.exit(1);
    }
    
    // Update todo
    todo[field] = value;
    todo.updated = new Date().toISOString();
    
    await saveTodos(todos);
    
    console.log(colors.green('✅ Todo updated:'));
    console.log(`  ID: ${todo.id}`);
    console.log(`  ${field}: ${value}`);
  },
  
  async complete(args) {
    const id = args[0];
    
    if (!id) {
      console.error(colors.red('Please provide a todo ID'));
      process.exit(1);
    }
    
    await commands.update([id, 'status', 'completed']);
  },
  
  async delete(args) {
    const id = args[0];
    
    if (!id) {
      console.error(colors.red('Please provide a todo ID'));
      process.exit(1);
    }
    
    const todos = await loadTodos();
    const index = todos.findIndex(t => t.id.startsWith(id));
    
    if (index === -1) {
      console.error(colors.red(`Todo not found: ${id}`));
      process.exit(1);
    }
    
    const deleted = todos.splice(index, 1)[0];
    await saveTodos(todos);
    
    console.log(colors.green('✅ Todo deleted:'));
    console.log(`  ${deleted.content}`);
  },
  
  async stats(args) {
    const todos = await loadTodos();
    
    const stats = {
      total: todos.length,
      pending: todos.filter(t => t.status === 'pending').length,
      in_progress: todos.filter(t => t.status === 'in_progress').length,
      completed: todos.filter(t => t.status === 'completed').length,
      high: todos.filter(t => t.priority === 'high').length,
      medium: todos.filter(t => t.priority === 'medium').length,
      low: todos.filter(t => t.priority === 'low').length
    };
    
    console.log(colors.blue('\n📊 Todo Statistics\n'));
    
    // Status breakdown
    console.log(colors.white('By Status:'));
    console.log(`  ⏳ Pending:     ${stats.pending}`);
    console.log(`  🔄 In Progress: ${stats.in_progress}`);
    console.log(`  ✅ Completed:   ${stats.completed}`);
    
    // Priority breakdown
    console.log(colors.white('\nBy Priority:'));
    console.log(`  ${colors.red('●')} High:   ${stats.high}`);
    console.log(`  ${colors.yellow('●')} Medium: ${stats.medium}`);
    console.log(`  ${colors.gray('●')} Low:    ${stats.low}`);
    
    // Completion rate
    const completionRate = stats.total > 0 
      ? Math.round((stats.completed / stats.total) * 100)
      : 0;
    
    console.log(colors.white(`\nCompletion Rate: ${completionRate}%`));
    
    // Progress bar
    const barLength = 20;
    const filled = Math.round((completionRate / 100) * barLength);
    const empty = barLength - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    console.log(`[${bar}]`);
  }
};

// Show help
function showHelp() {
  console.log(colors.blue('📋 Todo Manager\n'));
  console.log('Usage: claude /todo <action> [args]\n');
  console.log('Actions:');
  console.log('  list [status]              List all todos (optionally filter by status)');
  console.log('  add "task" [priority]      Add a new todo');
  console.log('  update <id> <field> <val>  Update a todo field');
  console.log('  complete <id>              Mark todo as completed');
  console.log('  delete <id>                Delete a todo');
  console.log('  stats                      Show statistics');
  console.log('\nExamples:');
  console.log('  claude /todo add "Implement caching" high');
  console.log('  claude /todo list pending');
  console.log('  claude /todo update abc123 status in_progress');
  console.log('  claude /todo complete abc123');
}

// Main
async function main() {
  const args = process.argv.slice(2);
  const action = args[0] || 'list';
  const actionArgs = args.slice(1);
  
  if (action === '--help' || action === '-h') {
    showHelp();
    process.exit(0);
  }
  
  if (!commands[action]) {
    console.error(colors.red(`Unknown action: ${action}`));
    showHelp();
    process.exit(1);
  }
  
  try {
    await commands[action](actionArgs);
  } catch (error) {
    console.error(colors.red('Error:'), error.message);
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  main();
}

module.exports = { loadTodos, saveTodos };