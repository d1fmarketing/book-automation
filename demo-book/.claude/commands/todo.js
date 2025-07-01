module.exports = {
    name: 'todo',
    description: 'Manage tasks and todo lists',
    aliases: ['t', 'task'],
    
    async execute(args, cli) {
        const subcommand = args[0] || 'list';
        
        const subcommands = {
            list: this.list,
            add: this.add,
            done: this.done,
            remove: this.remove,
            clear: this.clear,
            stats: this.stats
        };
        
        const handler = subcommands[subcommand];
        
        if (!handler) {
            cli.error(`Unknown todo subcommand: ${subcommand}`);
            cli.log('\nAvailable subcommands:');
            cli.log('  todo list    - Show all tasks');
            cli.log('  todo add     - Add a new task');
            cli.log('  todo done    - Mark task as completed');
            cli.log('  todo remove  - Remove a task');
            cli.log('  todo clear   - Clear all completed tasks');
            cli.log('  todo stats   - Show task statistics');
            return;
        }
        
        try {
            await handler.call(this, args.slice(1), cli);
        } catch (error) {
            cli.error(`Todo command failed: ${error.message}`);
            throw error;
        }
    },
    
    async loadTodos(cli) {
        const todoPath = '.claude/todos.json';
        
        if (!await cli.exists(todoPath)) {
            return { tasks: [], lastId: 0 };
        }
        
        return await cli.readJSON(todoPath);
    },
    
    async saveTodos(cli, todos) {
        const todoPath = '.claude/todos.json';
        await cli.writeJSON(todoPath, todos);
    },
    
    async list(args, cli) {
        const todos = await this.loadTodos(cli);
        
        if (todos.tasks.length === 0) {
            cli.info('No tasks found. Use "claude /todo add <task>" to create one.');
            return;
        }
        
        cli.log('\n📋 Task List\n');
        
        // Group by status
        const pending = todos.tasks.filter(t => t.status === 'pending');
        const inProgress = todos.tasks.filter(t => t.status === 'in_progress');
        const completed = todos.tasks.filter(t => t.status === 'completed');
        
        if (inProgress.length > 0) {
            cli.log('🔄 In Progress:');
            inProgress.forEach(task => {
                cli.log(`  [${task.id}] ${task.content} (${task.priority})`);
            });
            cli.log('');
        }
        
        if (pending.length > 0) {
            cli.log('📌 Pending:');
            pending.forEach(task => {
                const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
                cli.log(`  [${task.id}] ${priority} ${task.content}`);
            });
            cli.log('');
        }
        
        if (completed.length > 0) {
            cli.log('✅ Completed:');
            completed.forEach(task => {
                cli.log(`  [${task.id}] ${task.content}`);
            });
        }
        
        // Stats
        cli.log(`\n📊 Total: ${todos.tasks.length} | Pending: ${pending.length} | In Progress: ${inProgress.length} | Completed: ${completed.length}`);
    },
    
    async add(args, cli) {
        if (args.length === 0) {
            cli.error('Please provide a task description');
            cli.log('Usage: claude /todo add <task description> [priority]');
            return;
        }
        
        const todos = await this.loadTodos(cli);
        
        // Parse priority from last argument if it matches
        let priority = 'medium';
        let taskWords = args;
        
        const lastWord = args[args.length - 1].toLowerCase();
        if (['high', 'medium', 'low'].includes(lastWord)) {
            priority = lastWord;
            taskWords = args.slice(0, -1);
        }
        
        const content = taskWords.join(' ');
        
        const newTask = {
            id: String(++todos.lastId),
            content,
            status: 'pending',
            priority,
            created: new Date().toISOString()
        };
        
        todos.tasks.push(newTask);
        await this.saveTodos(cli, todos);
        
        cli.success(`Added task [${newTask.id}]: ${content} (${priority} priority)`);
    },
    
    async done(args, cli) {
        if (args.length === 0) {
            cli.error('Please provide a task ID');
            cli.log('Usage: claude /todo done <id>');
            return;
        }
        
        const taskId = args[0];
        const todos = await this.loadTodos(cli);
        
        const task = todos.tasks.find(t => t.id === taskId);
        
        if (!task) {
            cli.error(`Task [${taskId}] not found`);
            return;
        }
        
        if (task.status === 'completed') {
            cli.warn(`Task [${taskId}] is already completed`);
            return;
        }
        
        task.status = 'completed';
        task.completed = new Date().toISOString();
        
        await this.saveTodos(cli, todos);
        cli.success(`Completed task [${taskId}]: ${task.content}`);
    },
    
    async remove(args, cli) {
        if (args.length === 0) {
            cli.error('Please provide a task ID');
            cli.log('Usage: claude /todo remove <id>');
            return;
        }
        
        const taskId = args[0];
        const todos = await this.loadTodos(cli);
        
        const taskIndex = todos.tasks.findIndex(t => t.id === taskId);
        
        if (taskIndex === -1) {
            cli.error(`Task [${taskId}] not found`);
            return;
        }
        
        const [removed] = todos.tasks.splice(taskIndex, 1);
        await this.saveTodos(cli, todos);
        
        cli.success(`Removed task [${taskId}]: ${removed.content}`);
    },
    
    async clear(args, cli) {
        const todos = await this.loadTodos(cli);
        
        const completedCount = todos.tasks.filter(t => t.status === 'completed').length;
        
        if (completedCount === 0) {
            cli.info('No completed tasks to clear');
            return;
        }
        
        todos.tasks = todos.tasks.filter(t => t.status !== 'completed');
        await this.saveTodos(cli, todos);
        
        cli.success(`Cleared ${completedCount} completed task${completedCount > 1 ? 's' : ''}`);
    },
    
    async stats(args, cli) {
        const todos = await this.loadTodos(cli);
        
        cli.log('\n📊 Task Statistics\n');
        
        const stats = {
            total: todos.tasks.length,
            pending: todos.tasks.filter(t => t.status === 'pending').length,
            inProgress: todos.tasks.filter(t => t.status === 'in_progress').length,
            completed: todos.tasks.filter(t => t.status === 'completed').length,
            high: todos.tasks.filter(t => t.priority === 'high').length,
            medium: todos.tasks.filter(t => t.priority === 'medium').length,
            low: todos.tasks.filter(t => t.priority === 'low').length
        };
        
        // Status breakdown
        cli.log('📌 Status Breakdown:');
        cli.log(`  Pending:     ${stats.pending} (${this.percentage(stats.pending, stats.total)})`);
        cli.log(`  In Progress: ${stats.inProgress} (${this.percentage(stats.inProgress, stats.total)})`);
        cli.log(`  Completed:   ${stats.completed} (${this.percentage(stats.completed, stats.total)})`);
        
        cli.log('\n🎯 Priority Distribution:');
        cli.log(`  High:   ${stats.high} (${this.percentage(stats.high, stats.total)})`);
        cli.log(`  Medium: ${stats.medium} (${this.percentage(stats.medium, stats.total)})`);
        cli.log(`  Low:    ${stats.low} (${this.percentage(stats.low, stats.total)})`);
        
        // Completion rate
        const completionRate = stats.total > 0 ? (stats.completed / stats.total * 100).toFixed(1) : 0;
        cli.log(`\n🏆 Completion Rate: ${completionRate}%`);
        
        // Recent tasks
        const recent = todos.tasks
            .filter(t => t.status === 'completed')
            .sort((a, b) => new Date(b.completed) - new Date(a.completed))
            .slice(0, 3);
            
        if (recent.length > 0) {
            cli.log('\n🕒 Recently Completed:');
            recent.forEach(task => {
                const date = new Date(task.completed).toLocaleDateString();
                cli.log(`  • ${task.content} (${date})`);
            });
        }
    },
    
    percentage(value, total) {
        if (total === 0) return '0%';
        return `${(value / total * 100).toFixed(1)}%`;
    }
};