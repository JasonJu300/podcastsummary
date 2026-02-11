## 部署步骤

### 1. 修复安全问题（可选但建议）

* 将 PodcastIndex API Key 从代码移到环境变量

### 2. 执行部署脚本

```bash
cd /Users/bytedance/Documents/Trae/podcast_cloudfare
sh deploy.sh
```

脚本会自动：

* 检查 Cloudflare 登录状态

* 创建/获取 D1 数据库

* 更新 wrangler.toml

* 构建前端

* 部署 Worker + Assets

### 3. 配置生产环境 Secrets

部署完成后，需要手动设置：

```bash
cd worker
npx wrangler secret put VOLC_APP_ID
npx wrangler secret put VOLC_ACCESS_TOKEN
npx wrangler secret put VOLC_SECRET_KEY
npx wrangler secret put ARK_API_KEY
npx wrangler secret put JWT_SECRET
npx wrangler secret put INIT_SECRET
```

### 4. 初始化数据库

```bash
npx wrangler d1 execute podcast-summarizer-db --remote --file=./schema.sql
```

### 5. 创建默认用户

```bash
curl "https://your-worker-url.workers.dev/api/init?secret=podcast-init-secret-2026"
```

请确认后我将开始执行部署。
