# Contributing to Smart School ERP

## Code of Conduct

Be respectful, inclusive, and professional in all interactions.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Submit a pull request

## Development Setup

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env.local

# Start development server
pnpm run dev
```

## Code Standards

### TypeScript

- Strict mode enabled
- No `any` types without justification
- Proper error handling

### Formatting

```bash
pnpm run format
```

### Linting

```bash
pnpm run lint
```

### Type Checking

```bash
pnpm run type-check
```

## Pull Request Process

1. Update documentation
2. Add tests if applicable
3. Run all checks locally
4. Submit PR with detailed description
5. Address review feedback
6. Get approval from maintainers
7. Merge to main

## Reporting Issues

1. Check if issue already exists
2. Provide detailed reproduction steps
3. Include screenshots if applicable
4. Specify environment (OS, browser, versions)

## Feature Requests

1. Describe the feature clearly
2. Explain the use case
3. Suggest implementation approach
4. Discuss with maintainers before implementing
