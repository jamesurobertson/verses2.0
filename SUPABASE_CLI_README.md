# Supabase CLI Complete Guide (2025)

The Supabase CLI is a powerful command-line interface that enables local development, database management, and deployment for Supabase projects. This guide covers all essential features and commands.

## Table of Contents
- [Installation](#installation)
- [Core Concepts](#core-concepts)
- [Project Setup](#project-setup)
- [Local Development](#local-development)
- [Database Management](#database-management)
- [Edge Functions](#edge-functions)
- [Authentication & Security](#authentication--security)
- [Deployment & Production](#deployment--production)
- [Advanced Features](#advanced-features)
- [Troubleshooting](#troubleshooting)

## Installation

### Prerequisites
- Docker (required for local development)
- Node.js 16+ (for TypeScript type generation)

### Install Methods

**Homebrew (macOS/Linux):**
```bash
brew install supabase/tap/supabase
```

**NPM:**
```bash
npm install -g supabase
```

**Direct Download:**
Download from [GitHub Releases](https://github.com/supabase/cli/releases)

**Verify Installation:**
```bash
supabase --version
```

## Core Concepts

### Project Structure
```
your-project/
├── supabase/
│   ├── config.toml          # Project configuration
│   ├── seed.sql             # Database seed data
│   ├── migrations/          # Database migrations
│   ├── functions/           # Edge functions
│   └── tests/              # Database tests
└── your-app-code/
```

### Global Flags
- `--debug`: Enable debug logging
- `--experimental`: Enable experimental features
- `--workdir <path>`: Specify project directory
- `--help`: Show help information

## Project Setup

### Initialize New Project
```bash
# Create new project directory
mkdir my-supabase-project
cd my-supabase-project

# Initialize Supabase project
supabase init

# Login to Supabase (for remote operations)
supabase login
```

### Link to Remote Project
```bash
# Link to existing Supabase project
supabase link --project-ref your-project-ref

# Or create new remote project
supabase projects create "My Project"
```

## Local Development

### Start Local Environment
```bash
# Start all services (PostGres, Auth, Realtime, Storage, Edge Functions)
supabase start

# Start with specific services only
supabase start --exclude gotrue,realtime

# Check status of services
supabase status
```

### Stop Local Environment
```bash
# Stop all services
supabase stop

# Stop and remove all data
supabase stop --no-backup
```

### Access Local Services
After `supabase start`, you'll get URLs like:
- **API URL**: http://localhost:54321
- **GraphQL URL**: http://localhost:54321/graphql/v1
- **DB URL**: postgresql://postgres:postgres@localhost:54322/postgres
- **Studio URL**: http://localhost:54323
- **Inbucket URL**: http://localhost:54324 (for email testing)
- **JWT secret**: your-super-secret-jwt-token-with-at-least-32-characters-long
- **anon key**: your-anon-key
- **service_role key**: your-service-role-key

## Database Management

### Migrations
```bash
# Create new migration
supabase migration new create_todos_table

# Apply migrations locally
supabase db reset

# Apply specific migration
supabase migration repair <timestamp>

# List migrations
supabase migration list
```

### Schema Management
```bash
# Pull remote schema to local
supabase db pull

# Push local schema to remote
supabase db push

# Generate diff between local and remote
supabase db diff

# Generate diff for specific schema
supabase db diff --schema public,auth
```

### Type Generation
```bash
# Generate TypeScript types
supabase gen types typescript --local > types/supabase.ts

# Generate from remote project
supabase gen types typescript --project-id your-project-ref > types/supabase.ts

# Generate for specific schemas
supabase gen types typescript --schema public,auth
```

### Database Utilities
```bash
# Reset database (applies all migrations)
supabase db reset

# Seed database with data
supabase db reset --with-seed

# Backup database
supabase db dump -f backup.sql

# Restore database
psql -h localhost -p 54322 -U postgres -d postgres -f backup.sql
```

## Edge Functions

### Function Management
```bash
# Create new edge function
supabase functions new my-function

# Deploy single function
supabase functions deploy my-function

# Deploy all functions
supabase functions deploy

# Delete function
supabase functions delete my-function

# Download function
supabase functions download my-function
```

### Local Function Development
```bash
# Serve functions locally
supabase functions serve

# Serve specific function
supabase functions serve my-function --env-file .env

# Test function locally
curl -i --location --request POST 'http://localhost:54321/functions/v1/my-function' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"name":"World"}'
```

### Function Secrets
```bash
# Set secrets for functions
supabase secrets set MY_SECRET=value

# List secrets
supabase secrets list

# Remove secret
supabase secrets unset MY_SECRET
```

## Authentication & Security

### SSO Management
```bash
# Add SAML provider
supabase sso add

# List SSO providers
supabase sso list

# Remove SSO provider
supabase sso remove <provider-id>

# Update SSO provider
supabase sso update <provider-id>
```

### Network Security
```bash
# List network restrictions
supabase network-restrictions get

# Update network restrictions
supabase network-restrictions update --bypass-cidr-checks --allowed-cidrs 192.168.1.0/24
```

### Custom Domains
```bash
# Create custom domain
supabase domains create example.com

# List domains
supabase domains get

# Delete domain
supabase domains delete <domain-id>
```

## Deployment & Production

### Project Management
```bash
# List projects
supabase projects list

# Create project
supabase projects create "My New Project" --org-id your-org-id

# Delete project
supabase projects delete your-project-ref

# Get project API settings
supabase projects api-keys --project-ref your-project-ref
```

### Organizations
```bash
# List organizations
supabase orgs list

# Create organization
supabase orgs create "My Org"
```

### Environment Management
```bash
# Get remote config
supabase projects api-keys

# Set environment variables
echo "MY_VAR=value" > .env.local
supabase functions deploy --env-file .env.local
```

## Advanced Features

### Testing
```bash
# Run database tests
supabase test db

# Run specific test file
supabase test db tests/my_test.sql
```

### Branching (Preview)
```bash
# Create branch
supabase branches create feature-branch

# List branches
supabase branches list

# Delete branch
supabase branches delete feature-branch
```

### Storage Management
```bash
# Create storage bucket
supabase storage create my-bucket

# List buckets
supabase storage list

# Upload file
supabase storage upload my-bucket/file.txt ./local-file.txt
```

### Experimental Features
```bash
# Enable OrioleDB (experimental storage engine)
supabase start --experimental

# Use specific Postgres version
supabase start --postgres-version 15
```

## Configuration File (config.toml)

Example `supabase/config.toml`:
```toml
project_id = "your-project-ref"

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 15

[studio]
enabled = true
port = 54323
api_url = "http://localhost:54321"

[inbucket]
enabled = true
port = 54324
smtp_port = 54325
pop3_port = 54326

[storage]
enabled = true
file_size_limit = "50MiB"
buckets = [
  { name = "avatars", public = false },
  { name = "images", public = true }
]

[auth]
enabled = true
site_url = "http://localhost:3000"
additional_redirect_urls = ["https://localhost:3000"]
jwt_expiry = 3600
enable_signup = true

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false

[functions]
enabled = true
verify_jwt = false

[realtime]
enabled = true
ip_version = "ipv4"
```

## Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check Docker is running
docker ps

# Clean up Docker containers
supabase stop --no-backup
docker system prune -f

# Restart with fresh state
supabase start
```

**Port conflicts:**
```bash
# Check what's using the port
lsof -i :54321

# Kill process using port
kill -9 $(lsof -t -i:54321)
```

**Migration issues:**
```bash
# Check migration status
supabase migration list

# Fix migration timestamps
supabase migration repair 20240101000000

# Reset to clean state
supabase db reset
```

**Type generation fails:**
```bash
# Generate with debug info
supabase gen types typescript --debug

# Check local database connection
supabase status
```

### Useful Commands for Debugging

```bash
# Show detailed logs
supabase start --debug

# Check service health
supabase status

# View logs for specific service
docker logs supabase_db_project-name

# Inspect database directly
psql postgresql://postgres:postgres@localhost:54322/postgres
```

### Environment Variables

```bash
# Set Supabase URL and keys in your app
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Best Practices

1. **Version Control**: Always commit your `supabase/` directory
2. **Environment Separation**: Use different projects for dev/staging/production
3. **Migration Safety**: Test migrations locally before pushing to production
4. **Type Safety**: Regenerate types after schema changes
5. **Secret Management**: Never commit secrets to version control
6. **Testing**: Write database tests for critical functions
7. **Backup Strategy**: Regular backups of production data

## Useful Workflows

### Daily Development
```bash
# Start working
supabase start
supabase status

# Make schema changes
supabase migration new add_new_column
# Edit the migration file
supabase db reset

# Generate new types
supabase gen types typescript --local > types/supabase.ts

# Deploy when ready
supabase db push
supabase functions deploy
```

### CI/CD Pipeline
```yaml
# Example GitHub Action
- name: Setup Supabase CLI
  uses: supabase/setup-cli@v1
  with:
    version: latest

- name: Start Supabase
  run: supabase start

- name: Run tests
  run: supabase test db

- name: Deploy
  run: |
    supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
    supabase db push
    supabase functions deploy
```

## Real-World Lessons Learned

### Production Deployment Issues

**Password Authentication:**
```bash
# Use --password flag for non-interactive deployments
supabase link --project-ref your-ref --password "your-password"
supabase db push --password "your-password"

# Or use environment variable
export SUPABASE_DB_PASSWORD="your-password"
```

**Migration History Conflicts:**
```bash
# When remote and local migration history don't match
supabase migration list --password "your-password"

# Repair migration state
supabase migration repair --status applied 20250101000000 --password "your-password"

# Then push changes
supabase db push --password "your-password"
```

**Edge Function Deployment:**
```bash
# Deploy functions individually to avoid timeouts
supabase functions deploy esv-bible-api --project-ref your-ref
supabase functions deploy verse-operations --project-ref your-ref

# Functions can call each other
# Example: verse-operations calls esv-bible-api
```

**Database Function Management:**
```bash
# For database functions that need immediate deployment:
# 1. Add to migration file for future resets
# 2. Run directly on production for immediate effect

# Direct PostgreSQL connection
psql "postgresql://postgres.project-ref:password@host:port/postgres" -f functions.sql
```

**Local Development Challenges:**
- Local services may fail to start due to Docker container conflicts
- Analytics service often causes startup issues - disable with `enabled = false` in config.toml
- Use `supabase stop --no-backup && docker system prune -f` to clean up

**Configuration Management:**
```toml
# Disable problematic services for local development
[analytics]
enabled = false

# Function configuration
[functions.my-function]
enabled = true
verify_jwt = true
import_map = "./functions/my-function/deno.json"
entrypoint = "./functions/my-function/index.ts"
```

### Security Best Practices Learned

**RLS Policy Deployment:**
- Always test RLS policies locally before production
- Use `SECURITY DEFINER` functions for server-side operations
- Grant permissions explicitly: `GRANT EXECUTE ON FUNCTION func_name TO service_role`

**Edge Function Security:**
- Use service role key for database operations within functions
- Validate all inputs in edge functions
- Implement proper CORS headers for production

**Environment Variables:**
- Set secrets in Supabase Dashboard under Edge Functions
- Never commit API keys to version control
- Use `env(VARIABLE_NAME)` syntax in config.toml

### Type Generation Issues

**Common Problems:**
```bash
# Type generation requires database password
supabase gen types typescript --linked --password "your-password" > types/database.ts

# For local development
supabase gen types typescript --local > types/database.ts

# Permission issues may require database connection
```

### Production Workflow

**Complete Deployment Process:**
```bash
# 1. Deploy functions first (no DB connection needed)
supabase functions deploy --project-ref your-ref

# 2. Link to project with password
supabase link --project-ref your-ref --password "your-password"

# 3. Push database changes
supabase db push --password "your-password"

# 4. Set environment variables in Dashboard
# Go to: https://supabase.com/dashboard/project/your-ref/functions

# 5. Test endpoints
curl -X POST "https://your-ref.supabase.co/functions/v1/your-function" \
  -H "Authorization: Bearer your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**Drop and Recreate Workflow (Pre-Launch):**
```bash
# For projects still in development where you can drop/recreate DB
# 1. Update master migration file with all changes
vim supabase/migrations/20250101000000_initial_schema.sql

# 2. Reset and apply (drops entire database and recreates)
supabase db reset  # Local
supabase db push --password "password"   # Remote

# Single source of truth approach - one master migration file
# Safe until you have production users
```

**Greenfield Production Database Commands:**
```bash
# Fast iteration workflow for projects with no users
# Edit master migration file directly, then deploy:

# 1. Edit the single master migration file
supabase/migrations/20250101000000_initial_schema.sql

# 2. Deploy to production (drops/recreates entire database)
supabase db push --password "password"

# 3. Update TypeScript types
supabase gen types typescript --linked > src/types/database.ts

# 4. Deploy edge functions if needed
supabase functions deploy function-name --project-ref your-ref

# This approach is perfect for greenfield projects where you can safely
# drop/recreate the production database since no users exist yet.
# Much faster than local development setup for rapid iteration.
```

This guide covers the essential Supabase CLI features for 2025, including real-world deployment challenges and solutions. The CLI is actively developed, so check the [official documentation](https://supabase.com/docs/reference/cli) for the latest updates and features.