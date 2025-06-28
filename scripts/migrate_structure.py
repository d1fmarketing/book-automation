#!/usr/bin/env python3
"""
Migration script to reorganize repository structure
Reads file_map.csv and moves files to new locations
"""
import os
import csv
import shutil
from pathlib import Path
import subprocess
import re

class StructureMigration:
    def __init__(self, dry_run=False):
        self.dry_run = dry_run
        self.moves = []
        self.import_updates = []
        
    def load_file_map(self):
        """Load the file mapping from CSV"""
        with open('refactor/file_map.csv', 'r') as f:
            reader = csv.DictReader(f)
            return list(reader)
    
    def create_directories(self):
        """Create the new directory structure"""
        new_dirs = [
            'src/ebook_pipeline',
            'src/ebook_pipeline/agents',
            'src/ebook_pipeline/generators', 
            'src/ebook_pipeline/context',
            'src/ebook_pipeline/utils',
            'tests/unit/test_agents',
            'tests/unit/test_generators',
            'tests/unit/test_utils',
            'tests/integration',
            'tests/fixtures/sample_chapters',
            'config',
            'docs/sora',
        ]
        
        for dir_path in new_dirs:
            if not self.dry_run:
                Path(dir_path).mkdir(parents=True, exist_ok=True)
            print(f"📁 Creating directory: {dir_path}")
    
    def move_files(self, file_map):
        """Move files according to the mapping"""
        for row in file_map:
            if row['Keep'] == 'N':
                continue
                
            old_path = row['Path']
            new_path = row['New-Path']
            
            if new_path and old_path != new_path:
                self.moves.append((old_path, new_path))
                
                if not self.dry_run:
                    # Create parent directory if needed
                    Path(new_path).parent.mkdir(parents=True, exist_ok=True)
                    
                    # Use git mv to preserve history
                    try:
                        subprocess.run(['git', 'mv', old_path, new_path], check=True)
                        print(f"✅ Moved: {old_path} → {new_path}")
                    except subprocess.CalledProcessError:
                        # Fall back to regular move if not in git
                        shutil.move(old_path, new_path)
                        print(f"✅ Moved: {old_path} → {new_path}")
                else:
                    print(f"🔄 Would move: {old_path} → {new_path}")
    
    def create_init_files(self):
        """Create __init__.py files for Python packages"""
        init_files = [
            'src/ebook_pipeline/__init__.py',
            'src/ebook_pipeline/agents/__init__.py',
            'src/ebook_pipeline/generators/__init__.py',
            'src/ebook_pipeline/context/__init__.py',
            'src/ebook_pipeline/utils/__init__.py',
            'tests/__init__.py',
            'tests/unit/__init__.py',
            'tests/unit/test_agents/__init__.py',
            'tests/unit/test_generators/__init__.py',
            'tests/unit/test_utils/__init__.py',
            'tests/integration/__init__.py',
        ]
        
        for init_file in init_files:
            if not self.dry_run:
                Path(init_file).touch(exist_ok=True)
            print(f"📄 Creating: {init_file}")
    
    def update_imports(self):
        """Update Python imports after moving files"""
        # Mapping of old imports to new imports
        import_map = {
            'from agents.image_prompt_agent': 'from ebook_pipeline.agents.image_prompt_agent',
            'import agents.image_prompt_agent': 'import ebook_pipeline.agents.image_prompt_agent',
            'from agents.emotion_palette_engine': 'from ebook_pipeline.agents.emotion_palette',
            'from scripts.wordcount': 'from ebook_pipeline.utils.wordcount',
            'from scripts.continuity-check': 'from ebook_pipeline.context.continuity_checker',
            'from scripts.analyze-chapters': 'from ebook_pipeline.context.analyzer',
            'from scripts.character-tracker': 'from ebook_pipeline.context.character_tracker',
            'from scripts.find-references': 'from ebook_pipeline.context.reference_finder',
            'from scripts.generate-context': 'from ebook_pipeline.utils.context_generator',
        }
        
        # Find all Python files in new structure
        python_files = []
        for root, dirs, files in os.walk('src'):
            for file in files:
                if file.endswith('.py'):
                    python_files.append(os.path.join(root, file))
        
        for root, dirs, files in os.walk('tests'):
            for file in files:
                if file.endswith('.py'):
                    python_files.append(os.path.join(root, file))
        
        # Update imports in each file
        for py_file in python_files:
            if not os.path.exists(py_file):
                continue
                
            with open(py_file, 'r') as f:
                content = f.read()
            
            updated = False
            for old_import, new_import in import_map.items():
                if old_import in content:
                    content = content.replace(old_import, new_import)
                    updated = True
                    self.import_updates.append((py_file, old_import, new_import))
            
            if updated and not self.dry_run:
                with open(py_file, 'w') as f:
                    f.write(content)
                print(f"📝 Updated imports in: {py_file}")
    
    def update_scripts(self):
        """Update shell scripts and Makefile with new paths"""
        files_to_update = ['Makefile', 'scripts/generate-images.py']
        
        path_updates = {
            'scripts/wordcount.py': 'python -m ebook_pipeline.utils.wordcount',
            'scripts/continuity-check.py': 'python -m ebook_pipeline.context.continuity_checker',
            'scripts/analyze-chapters.py': 'python -m ebook_pipeline.context.analyzer',
            'scripts/character-tracker.py': 'python -m ebook_pipeline.context.character_tracker',
            'scripts/find-references.py': 'python -m ebook_pipeline.context.reference_finder',
            'scripts/generate-context.py': 'python -m ebook_pipeline.utils.context_generator',
            'agents/image_prompt_agent': 'ebook_pipeline.agents.image_prompt_agent',
        }
        
        for file_path in files_to_update:
            if not os.path.exists(file_path):
                continue
                
            with open(file_path, 'r') as f:
                content = f.read()
            
            updated = False
            for old_path, new_path in path_updates.items():
                if old_path in content:
                    content = content.replace(old_path, new_path)
                    updated = True
            
            if updated and not self.dry_run:
                with open(file_path, 'w') as f:
                    f.write(content)
                print(f"📝 Updated paths in: {file_path}")
    
    def create_setup_py(self):
        """Create setup.py for the package"""
        setup_content = '''#!/usr/bin/env python3
"""Setup configuration for ebook_pipeline package"""
from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="ebook-pipeline",
    version="0.10.0",
    author="Your Name",
    author_email="your.email@example.com",
    description="Professional eBook automation pipeline",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/ebook-pipeline",
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Topic :: Text Processing :: Markup",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.11",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "ebook-pipeline=ebook_pipeline.cli:main",
        ],
    },
)
'''
        if not self.dry_run:
            with open('setup.py', 'w') as f:
                f.write(setup_content)
        print("📄 Created setup.py")
    
    def create_pyproject_toml(self):
        """Create pyproject.toml for modern Python packaging"""
        content = '''[build-system]
requires = ["setuptools>=61.0", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "ebook-pipeline"
version = "0.10.0"
description = "Professional eBook automation pipeline"
readme = "README.md"
requires-python = ">=3.11"
license = {text = "MIT"}
authors = [
    {name = "Your Name", email = "your.email@example.com"},
]
classifiers = [
    "Development Status :: 4 - Beta",
    "Intended Audience :: Developers",
    "Topic :: Text Processing :: Markup",
    "License :: OSI Approved :: MIT License",
    "Programming Language :: Python :: 3",
]

[project.scripts]
ebook-pipeline = "ebook_pipeline.cli:main"

[tool.pytest]
testpaths = ["tests"]
python_files = "test_*.py"
python_classes = "Test*"
python_functions = "test_*"

[tool.black]
line-length = 100
target-version = ['py311']

[tool.isort]
profile = "black"
line_length = 100

[tool.ruff]
line-length = 100
select = ["E", "F", "W", "C90", "I", "N", "B", "S"]
ignore = ["E501"]

[tool.mypy]
python_version = "3.11"
warn_return_any = true
warn_unused_configs = true
disallow_untyped_defs = true
'''
        if not self.dry_run:
            with open('pyproject.toml', 'w') as f:
                f.write(content)
        print("📄 Created pyproject.toml")
    
    def run(self):
        """Execute the migration"""
        print("🚀 Starting repository structure migration...")
        
        # Load file mapping
        file_map = self.load_file_map()
        
        # Create new directories
        print("\n📁 Creating directory structure...")
        self.create_directories()
        
        # Move files
        print("\n📦 Moving files...")
        self.move_files(file_map)
        
        # Create __init__.py files
        print("\n📄 Creating package files...")
        self.create_init_files()
        
        # Create setup files
        self.create_setup_py()
        self.create_pyproject_toml()
        
        # Update imports
        print("\n🔧 Updating imports...")
        self.update_imports()
        
        # Update scripts
        print("\n📝 Updating scripts...")
        self.update_scripts()
        
        # Summary
        print(f"\n✅ Migration complete!")
        print(f"   - Moved {len(self.moves)} files")
        print(f"   - Updated {len(self.import_updates)} imports")
        
        if self.dry_run:
            print("\n⚠️  This was a dry run. Use --execute to perform the migration.")
        else:
            print("\n📌 Next steps:")
            print("   1. Run: pip install -e .")
            print("   2. Run: pytest")
            print("   3. Test image generation with both providers")
            print("   4. Verify PDF build matches baseline")

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Migrate repository structure")
    parser.add_argument('--execute', action='store_true', help="Execute the migration (default is dry-run)")
    args = parser.parse_args()
    
    migration = StructureMigration(dry_run=not args.execute)
    migration.run()

if __name__ == '__main__':
    main()