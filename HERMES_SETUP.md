# Hermes Setup for Separate Repositories

## The problem

Hermes is currently configured to work in `/home/dorian/seo-app-dev` with:
- Terminal working directory set to that repo
- MCP codebase index server pointed at that repo's index DB

When working in `/home/dorian/coffee-apps/`, we need Hermes to:
- Use that directory as its working directory
- Index THAT repo's code (separate from seo-app-dev)
- Still have access to the seo-app-dev repo when needed

## Solution: separate Hermes profile for coffee-apps

Hermes supports multiple profiles. We create a new profile that switches the
working directory and MCP server to the coffee-apps repo.

### Step 1: Create the coffee-apps profile

```bash
hermes profile create coffee-apps
```

This creates `/home/dorian/.hermes/profiles/coffee-apps/config.yaml`.

### Step 2: Edit the profile config

Open `/home/dorian/.hermes/profiles/coffee-apps/config.yaml` and set:

```yaml
model:
  provider: zai
  default: glm-5.2
  context_length: 1000000
  base_url: https://api.z.ai/api/coding/paas/v4

terminal:
  backend: local
  cwd: /home/dorian/coffee-apps

mcp_servers:
  codebase:
    command: /home/dorian/.hermes/hermes-agent/venv/bin/python3
    args:
      - /home/dorian/coffee-apps/tools/codebase_index/mcp_server.py
    enabled: true
```

Key differences from the planner profile:
- `terminal.cwd` points to `/home/dorian/coffee-apps`
- `mcp_servers.codebase.args` points to the coffee-apps MCP server (which
  indexes the coffee-apps repo, not seo-app-dev)

### Step 3: Build the codebase index for coffee-apps

```bash
cd /home/dorian/coffee-apps
python3 tools/codebase_index/indexer.py --build
```

This creates `/home/dorian/coffee-apps/data/codebase_index.db` — a separate
index from seo-app-dev's.

### Step 4: Start Hermes with the coffee-apps profile

```bash
# From the coffee-apps directory:
cd /home/dorian/coffee-apps
hermes -p coffee-apps

# Or from anywhere:
hermes -p coffee-apps
```

The terminal tool will default to `/home/dorian/coffee-apps/`, and the MCP
codebase tools (search_code, find_symbol, etc.) will search the coffee-apps
index.

### Step 5: Switching between repos

```bash
# Work on the SEO maintenance codebase:
hermes -p planner

# Work on the app codebase:
hermes -p coffee-apps
```

Each profile has its own:
- Working directory
- MCP server (indexing different repos)
- Memory
- Session history
- Config

### Step 5b: Quick switch without a new profile

If you don't want a separate profile, you can just change directory:

```bash
cd /home/dorian/coffee-apps
hermes
```

The terminal tool will use whatever directory you start Hermes from. The MCP
server will still index seo-app-dev (since that's what the planner profile
configures), but you can run terminal commands in the coffee-apps directory.

**Limitation:** the MCP codebase search tools (search_code, find_symbol, etc.)
will search seo-app-dev's index, not coffee-apps'. This is fine as long as
coffee-apps is small — the assistant can use `search_files` and `read_file`
directly instead.

### Step 6: When you need BOTH repos in one session

Sometimes you need to:
- Run the export script in seo-app-dev
- Copy the JSON to coffee-apps
- Work on the app code

Two approaches:

**Approach A: absolute paths in terminal commands**
```bash
# From any Hermes session, reference both repos by absolute path:
python3 /home/dorian/seo-app-dev/scripts/export_dictionary.py
cp /home/dorian/coffee-apps/data/terms.json /home/dorian/coffee-apps/data/
```

**Approach B: work from coffee-apps with absolute paths to seo-app-dev**
```bash
cd /home/dorian/coffee-apps
# Edit app code with relative paths
# Reference seo-app-dev with absolute paths when needed
```

The export script (`export_dictionary.py`) already uses absolute paths for both
the source DB and the output directory, so it works from anywhere.

## What's already been set up

1. `/home/dorian/coffee-apps/` — new repo, initialized with git
2. `/home/dorian/coffee-apps/data/terms.json` — 308 terms exported from registry
3. `/home/dorian/coffee-apps/data/relationships.json` — 118 relationships exported
4. `/home/dorian/coffee-apps/data/export-manifest.json` — export metadata
5. `/home/dorian/coffee-apps/tools/codebase_index/` — MCP server copied and adapted
6. `/home/dorian/seo-app-dev/scripts/export_dictionary.py` — one-way export bridge

## Remaining steps (require user action)

1. **Build the coffee-apps codebase index:**
   ```bash
   cd /home/dorian/coffee-apps
   python3 tools/codebase_index/indexer.py --build
   ```

2. **Create the coffee-apps Hermes profile:**
   ```bash
   hermes profile create coffee-apps
   # Then edit the config as shown in Step 2 above
   ```

3. **Create a GitHub repo and connect Vercel:**
   ```bash
   cd /home/dorian/coffee-apps
   gh repo create coffee-apps --private --source=. --push
   # Then connect the repo to Vercel via vercel.com
   ```

4. **Set up DNS for subdomains:**
   - `terms.how-to-brew.coffee` → Vercel (Dictionary app)
   - `facts.how-to-brew.coffee` → Vercel (Facts app)
   - Configure in your DNS provider (point CNAMEs to Vercel)
