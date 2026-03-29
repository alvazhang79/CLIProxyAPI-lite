#!/usr/bin/env bash
# CLIProxyAPI Lite — Local Development Setup Script
# Usage: ./scripts/dev.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🦐 CLIProxyAPI Lite — Dev Setup"
echo "================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js required"; exit 1; }
command -v wrangler >/dev/null 2>&1 || { echo "⚠️  Wrangler not found. Install: npm install -g wrangler"; }

echo -e "${GREEN}✓${NC} Prerequisites OK"

# Install workers deps
echo ""
echo "📦 Installing Workers dependencies..."
cd "$PROJECT_ROOT/workers" && npm install

# Install pages deps
echo ""
echo "📦 Installing Pages dependencies..."
cd "$PROJECT_ROOT/pages" && npm install

# Create .dev.vars for local dev
if [ ! -f "$PROJECT_ROOT/workers/.dev.vars" ]; then
  echo ""
  echo -e "${YELLOW}⚠️  Creating .dev.vars template...${NC}"
  cat > "$PROJECT_ROOT/workers/.dev.vars" << 'EOF'
ADMIN_TOKEN=dev_admin_token_change_me
ENCRYPTION_KEY=your-32-byte-base64-key-here==
EOF
  echo -e "${GREEN}✓${NC} Created workers/.dev.vars — edit it with your values"
else
  echo -e "${GREEN}✓${NC} .dev.vars already exists"
fi

# Copy env example for pages
if [ ! -f "$PROJECT_ROOT/pages/.env.local" ]; then
  cp "$PROJECT_ROOT/pages/.env.example" "$PROJECT_ROOT/pages/.env.local"
  echo -e "${GREEN}✓${NC} Created pages/.env.local"
fi

echo ""
echo ""
echo "✅ Setup complete! Next steps:"
echo ""
echo "  1. Edit workers/.dev.vars:"
echo "     - ADMIN_TOKEN: your local admin token"
echo "     - ENCRYPTION_KEY: openssl rand -base64 32"
echo ""
echo "  2. Edit pages/.env.local:"
echo "     - VITE_WORKERS_API_URL=http://localhost:8787"
echo ""
echo "  3. Start Workers (terminal 1):"
echo "     cd workers && wrangler dev"
echo ""
echo "  4. Start Pages (terminal 2):"
echo "     cd pages && npm run dev"
echo ""
echo "  5. Admin dashboard:"
echo "     http://localhost:5173"
echo ""
echo "  6. API base URL:"
echo "     http://localhost:8787"
echo ""
