#!/usr/bin/env python3
"""
Run tests for ebook pipeline agents
"""
import subprocess
import sys
import os

# Set PYTHONPATH to include src directory
env = os.environ.copy()
src_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')
if 'PYTHONPATH' in env:
    env['PYTHONPATH'] = f"{src_path}:{env['PYTHONPATH']}"
else:
    env['PYTHONPATH'] = src_path

# Run tests
cmd = [sys.executable, '-m', 'pytest', 'tests/unit/test_agents/', '-v']
if len(sys.argv) > 1:
    cmd.extend(sys.argv[1:])

result = subprocess.run(cmd, env=env)
sys.exit(result.returncode)