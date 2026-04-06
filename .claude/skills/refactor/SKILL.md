---
trigger: "refactor"
description: "Safely refactor code with test verification"
---

# Refactor Skill

When asked to refactor code:

1. **Read** — Read all target files and understand the current structure
2. **Baseline** — Run the existing test suite and confirm all tests pass
3. **Change** — Make the requested refactoring changes
4. **Verify** — Re-run the test suite and confirm all tests still pass
5. **Clean up** — Remove any dead code created by the refactoring (unused imports, variables, functions)

If tests fail after changes, fix the issue or revert. Never leave the codebase in a broken state.
