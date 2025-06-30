# Initialize Claude Elite Project

Initialize a new project with Claude Elite capabilities while preserving any existing setup.

## Steps:

1. **Check if project already exists**
   - Look for existing `package.json`, `Makefile`, or `.git`
   - If exists, add Elite features without overwriting

2. **Create Elite structure**
   ```bash
   mkdir -p .claude/{commands,mcp-configs,scripts,templates}
   ```

3. **Run environment verification**
   ```bash
   .claude/scripts/verify-env.sh
   ```

4. **Initialize git if needed**
   ```bash
   if [ ! -d .git ]; then
     git init
     echo "# Project initialized with Claude Elite" > README.md
     git add README.md
     git commit -m "feat: initial commit with Claude Elite"
   fi
   ```

5. **Create basic claude.md if missing**
   ```bash
   if [ ! -f claude.md ] && [ ! -f CLAUDE.md ]; then
     echo "# Project Configuration for Claude
     
     ## Overview
     [Project description]
     
     ## Conventions
     - Commit style: conventional commits
     - Test coverage: 90%+
     - Code style: [Define your style]
     " > claude.md
   fi
   ```

6. **Create CLAUDE-ELITE.md**
   - Copy Elite template with project-specific modifications

7. **Install dependencies if package.json exists**
   ```bash
   if [ -f package.json ]; then
     npm install
   fi
   ```

8. **Report status**
   - List what was created
   - List what was preserved
   - Show next steps

## Usage:
```
claude /init
```

## Notes:
- This command is safe to run multiple times
- It never overwrites existing files
- It enhances but doesn't replace existing setup