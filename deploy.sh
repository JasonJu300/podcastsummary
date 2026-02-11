#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 开始 Podcast Summarizer 一键部署流程...${NC}"

# 1. Check Wrangler Login
echo -e "\n${YELLOW}1. 检查 Cloudflare 登录状态...${NC}"
if ! npx wrangler whoami > /dev/null 2>&1; then
  echo -e "${RED}❌ 未检测到 Cloudflare 登录信息。${NC}"
  echo "请先运行 'npx wrangler login' 进行登录，然后重新运行此脚本。"
  exit 1
fi
echo -e "${GREEN}✅ 已登录 Cloudflare${NC}"

# 2. Check/Create Production Database
DB_NAME="podcast-summarizer-db"
echo -e "\n${YELLOW}2. 检查 D1 数据库 (${DB_NAME})...${NC}"

# Try to find existing DB ID
# Using node to parse JSON safely
DB_ID=$(npx wrangler d1 list --json | node -e "console.log(JSON.parse(require('fs').readFileSync(0, 'utf-8')).find(d => d.name === '${DB_NAME}')?.uuid || '')")

if [ -z "$DB_ID" ]; then
  echo -e "${YELLOW}⚠️ 未找到数据库，正在创建...${NC}"
  npx wrangler d1 create "$DB_NAME" || true
  # Fetch ID again
  DB_ID=$(npx wrangler d1 list --json | node -e "console.log(JSON.parse(require('fs').readFileSync(0, 'utf-8')).find(d => d.name === '${DB_NAME}')?.uuid || '')")
fi

if [ -z "$DB_ID" ]; then
  echo -e "${RED}❌ 无法获取数据库 ID。请检查 'npx wrangler d1 list' 输出。${NC}"
  exit 1
fi

echo -e "${GREEN}✅ 数据库 ID: ${DB_ID}${NC}"

# 3. Update wrangler.toml with DB ID
echo -e "\n${YELLOW}3. 更新 worker/wrangler.toml 配置...${NC}"
# MacOS compatible sed
sed -i '' "s/your-production-database-id/$DB_ID/g" worker/wrangler.toml
echo -e "${GREEN}✅ 配置文件已更新${NC}"

# 4. Build Frontend
echo -e "\n${YELLOW}4. 构建前端资源 (Client)...${NC}"
# Use npm install to ensure dependencies
npm install
npm run build
echo -e "${GREEN}✅ 前端构建完成 (dist/)${NC}"

# 5. Deploy Worker + Assets
echo -e "\n${YELLOW}5. 部署 Worker & Assets...${NC}"
cd worker
npm install
# Deploy to production environment (using [env.production] config)
npx wrangler deploy --env production
echo -e "${GREEN}✅ Worker 部署完成${NC}"

# 6. Initialize DB Schema (Remote)
echo -e "\n${YELLOW}6. 初始化生产数据库 Schema...${NC}"
echo "输入 'y' 确认初始化 (如果已初始化过请跳过): "
read -r response
if [[ "$response" =~ ^([yY][eE][sS]|[yY])+$ ]]; then
    npx wrangler d1 execute podcast-summarizer-db --remote --file=./schema.sql
    echo -e "${GREEN}✅ 数据库 Schema 初始化完成${NC}"
else
    echo "跳过数据库初始化。"
fi

echo -e "\n${GREEN}🎉 部署全部完成！${NC}"
echo -e "${YELLOW}⚠️ 重要提示：${NC} 请确保您已配置生产环境 Secrets！"
echo "运行以下命令配置 Secrets:"
echo "cd worker"
echo "npx wrangler secret put VOLC_APP_ID"
echo "npx wrangler secret put VOLC_ACCESS_TOKEN"
echo "npx wrangler secret put VOLC_SECRET_KEY"
echo "npx wrangler secret put ARK_API_KEY"
echo "npx wrangler secret put JWT_SECRET"
echo "npx wrangler secret put INIT_SECRET"
