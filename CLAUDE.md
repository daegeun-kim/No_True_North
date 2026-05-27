# CLAUDE.md

## Role

Claude is used only as a coding assistant for this repository.

Claude may help write, edit, refactor, debug, and explain project code. Claude must not manage Git, deployment, system settings, accounts, credentials, or files outside this repository.

## Repository Boundary

Claude must operate only inside the repository root.

Claude must not read, edit, create, move, or delete files outside this repository.

If a task requires access outside the repository, Claude must stop and ask the user to handle that action manually.

## Allowed Actions

Claude may:

- Read files inside the repository
- Create source files inside the repository
- Edit source files inside the repository
- Refactor existing project code
- Add or update project documentation
- Write small local test scripts inside the repository
- Explain errors and propose fixes
- Suggest terminal commands for the user to run manually
- Update project configuration files only when directly required for coding

## Disallowed Actions

Claude must not:

- Run Git commands
- Commit changes
- Push changes
- Pull changes
- Merge branches
- Rebase branches
- Create branches
- Delete branches
- Change remote repository settings
- Modify `.git` files
- Deploy the project
- Publish packages
- Upload files to external services
- Install global packages
- Change system settings
- Access files outside the repository
- Read or modify private files, keys, tokens, passwords, browser data, SSH files, or cloud credentials

## Git Rule

All Git actions are manual.

Claude must not execute any command beginning with:

```bash
git
```

Claude may only suggest Git commands as text when the user specifically asks.

## Python Rule

If Python execution is required, Claude must use the Anaconda environment named:

```bash
geospatial
```

Claude must not create a new Python environment unless the user explicitly asks.

Claude must not use the base Conda environment.

Claude must not install Python packages unless the user explicitly approves.

When suggesting Python commands, Claude should use one of the following forms:

```bash
conda activate geospatial
python script_name.py
```

or:

```bash
conda run -n geospatial python script_name.py
```

## Package Management Rule

Claude must not install, update, or remove dependencies automatically.

Claude may edit dependency files only when the user asks or when the code change clearly requires it.

Examples of dependency files include:

- `package.json`
- `package-lock.json`
- `pnpm-lock.yaml`
- `yarn.lock`
- `requirements.txt`
- `environment.yml`
- `pyproject.toml`

If a new package is needed, Claude must explain why and ask the user to install it manually.

## Terminal Command Rule

Claude should avoid running terminal commands unless they are necessary for coding or debugging.

Before suggesting or running any command, Claude must check that it:

1. Operates only inside the repository
2. Does not modify Git state
3. Does not access credentials or private files
4. Does not install, remove, or update software without approval
5. Uses the `geospatial` Conda environment for Python tasks

## File Safety Rule

Claude must not delete files unless the user explicitly asks.

Claude must not overwrite large files or generated assets without explaining the change first.

Claude must not edit files that appear to contain secrets, credentials, or private configuration.

Files that should be treated as sensitive include:

- `.env`
- `.env.local`
- `.env.production`
- `.npmrc`
- `.pypirc`
- SSH keys
- API key files
- credential JSON files
- cloud provider config files

## Web and External Access Rule

Claude must not open external URLs, call external APIs, scrape websites, or send project data outside the local repository unless the user explicitly asks.

Claude must not paste code, data, logs, or file contents into external services.

## Coding Style

Claude should:

- Make minimal changes required to complete the requested coding task
- Preserve the existing project structure
- Preserve existing naming conventions
- Avoid unnecessary abstractions
- Avoid adding comments unless the user asks
- Avoid changing unrelated files
- Explain what changed after editing
- Mention any files modified

## Frontend Project Notes

This project is an interactive frontend web map visualization project for custom world map projections with redefined poles.

Core project focus:

- Natural Earth world geometry
- User-selected north pole
- Automatically derived south pole
- Projection selection
- Globe-to-map transformation animation
- Horizontally scrollable east-west map
- Projection-first implementation before adding unrelated features

Claude should keep the project focused on the projection-generation workflow unless the user asks to expand scope.

## Behavior When Unsure

If Claude is unsure whether an action is allowed, Claude must stop and ask the user.

Claude must prefer suggesting commands for the user to run manually rather than executing risky commands.

## Important Warning

The user may run Claude with:

```bash
claude --dangerously-skip-permissions
```

Even in that mode, Claude must follow this file strictly and treat these rules as mandatory project instructions.
