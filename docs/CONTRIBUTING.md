# Contributing to FIRST E-BOOK Pipeline

Thank you for your interest in contributing to the FIRST E-BOOK automation pipeline! This document provides guidelines and information for contributors.

## 🏗️ Project Structure

```
src/ebook_pipeline/
├── agents/          # AI agents for content generation
├── generators/      # Image and PDF generators  
├── context/         # Context management tools
└── utils/           # Utility functions
```

## 🚀 Getting Started

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/yourusername/first-ebook.git
   cd first-ebook
   ```
3. **Install dependencies**:
   ```bash
   make init
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📝 Development Guidelines

### Code Style

- **Python**: Follow PEP 8
- **JavaScript**: Use ESLint configuration
- **Markdown**: Follow markdownlint rules

### Python Guidelines

- Use type hints for all functions
- Write docstrings for all public functions
- Keep functions focused and small
- Use meaningful variable names

Example:
```python
def generate_image_prompt(description: str, emotion: str = "neutral") -> dict:
    """
    Generate an optimized prompt for image generation.
    
    Args:
        description: The scene description
        emotion: The emotional tone (default: "neutral")
        
    Returns:
        dict: Prompt data with emotion metadata
    """
    # Implementation here
```

### Testing

- Write tests for all new features
- Maintain test coverage above 80%
- Place tests in appropriate subdirectories:
  - `tests/unit/` for unit tests
  - `tests/integration/` for integration tests

Run tests:
```bash
pytest
pytest --cov=ebook_pipeline  # with coverage
```

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

Examples:
```
feat(agents): add emotion detection to image prompts

fix(generator): handle missing API key gracefully

docs: update README with Sora configuration
```

## 🔄 Pull Request Process

1. **Update documentation** for any new features
2. **Add tests** for new functionality
3. **Run all tests** and ensure they pass:
   ```bash
   make test
   ```
4. **Update the README** if needed
5. **Ensure your branch is up to date** with main:
   ```bash
   git pull origin main
   ```
6. **Create a pull request** with:
   - Clear title and description
   - Reference to any related issues
   - List of changes made
   - Screenshots if UI changes

### PR Checklist

- [ ] Tests pass locally
- [ ] Code follows project style
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] No merge conflicts
- [ ] Changes are focused and atomic

## 🐛 Reporting Issues

When reporting issues, please include:

1. **Description** of the problem
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Environment details**:
   - OS version
   - Python version
   - Node.js version
   - Relevant package versions

## 💡 Feature Requests

We welcome feature requests! Please:

1. **Check existing issues** first
2. **Provide clear use case**
3. **Explain the benefit**
4. **Consider implementation approach**

## 🏷️ Code Review

All submissions require review. We use GitHub pull requests for this purpose.

Reviewers will look for:
- Code quality and style
- Test coverage
- Documentation
- Performance implications
- Security considerations

## 📋 Development Tasks

### Adding a New Image Provider

1. Create provider class in `src/ebook_pipeline/providers/`
2. Implement the `ImageProvider` interface
3. Add configuration in `config/`
4. Update `IMAGE_PROVIDER` handling
5. Add tests in `tests/unit/test_providers/`
6. Update documentation

### Adding Context Tools

1. Create tool in `src/ebook_pipeline/context/`
2. Add command to Makefile
3. Update CLAUDE.md with usage
4. Add tests
5. Document in README

## 🔒 Security

- Never commit API keys or secrets
- Use environment variables for sensitive data
- Validate all user input
- Follow OWASP guidelines

## 📞 Getting Help

- Check the [documentation](../README.md)
- Look at existing code examples
- Ask questions in issues
- Join our discussions

## 🙏 Recognition

Contributors will be recognized in:
- The README acknowledgments
- Release notes
- Project documentation

Thank you for contributing to FIRST E-BOOK!