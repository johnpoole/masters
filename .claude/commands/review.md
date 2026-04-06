Review the current git diff for issues.

Run `git diff` to get all staged and unstaged changes, then review for:

1. **Bugs** — logic errors, off-by-ones, null/undefined access, wrong variable usage
2. **Silent failures** — swallowed exceptions, warn-and-continue, unchecked return values
3. **Dead code** — imports, variables, or functions made unused by the changes
4. **Missing error handling** — external calls without error checks, broad try/catch blocks
5. **Security** — injection risks, hardcoded secrets, unsafe deserialization

Summarize findings as a checklist. For each issue, reference the file and line. If the diff is clean, say so.
