# 播客摘要 - 小宇宙播客智能摘要工具

基于 Cloudflare Workers + React 的播客转录和摘要生成工具。

## 🚀 一键部署

本项目提供自动化部署脚本，协助您将应用发布到 Cloudflare (Workers + Pages/Assets)。

###前提条件
1. 已安装 `Node.js` (v18+) 和 `npm`
2. 拥有 Cloudflare 账号并已登录 (`npx wrangler login`)

### 部署步骤

1. **运行部署脚本**：
   ```bash
   # 在项目根目录下运行
   sh deploy.sh
   ```
   脚本将自动完成：
   - 检查/创建 D1 数据库
   - 更新配置文件
   - 构建前端代码
   - 部署 Worker 和静态资源

2. **配置生产环境密钥**（重要）：
   部署完成后，请务必设置生产环境的 API 密钥。您可以直接运行以下命令：
   
   ```bash
   cd worker
   npx wrangler secret put VOLC_APP_ID
   npx wrangler secret put VOLC_ACCESS_TOKEN
   npx wrangler secret put VOLC_SECRET_KEY
   npx wrangler secret put ARK_API_KEY
   npx wrangler secret put JWT_SECRET
   npx wrangler secret put INIT_SECRET
   ```

3. **初始化数据库**：
   脚本运行过程中会询问是否初始化数据库。如果跳过，您也可以手动运行：
   ```bash
   cd worker
   npx wrangler d1 execute podcast-summarizer-db --remote --file=./schema.sql
   ```

4. **访问应用**：
   部署完成后，Wrangler 会输出您的 Worker URL（例如 `https://podcast-summarizer.your-subdomain.workers.dev`）。直接访问该网址即可使用。

---

## ☁️ GitHub Actions 自动部署

本项目已配置 CI/CD 工作流。将代码推送到 GitHub 后，可实现自动部署。

### 配置指南

1. **Push 代码**：将项目推送到您的 GitHub 仓库 `main` 分支。
2. **设置 Secrets**：在 GitHub 仓库 -> Settings -> Secrets and variables -> Actions 中添加：
   - `CLOUDFLARE_API_TOKEN`: 您的 Cloudflare API 令牌（需有 Workers 编辑权限）
   - `CLOUDFLARE_ACCOUNT_ID`: 您的 Cloudflare 账户 ID（可在 `npx wrangler whoami` 输出中找到）
3. **自动化触发**：每次推送到 `main` 分支时，GitHub Actions 将自动运行测试、构建前端并部署到 Cloudflare。

---

## 🌟 功能特性

- **分步处理架构**：解决 Workers 30秒/100毫秒超时限制，支持长时间任务自动分片执行
- **全链路 AI 驱动**：
  - 自动解析小宇宙播客（支持 PodcastIndex API 降级）
  - 火山引擎音频转写（长录音自动分段）
  - 火山方舟大模型智能摘要（结构化 Markdown 输出）
- **现代化 UI/UX**：
  - 精致的 Glassmorphism 设计风格
  - 实时任务进度反馈
  - 响应式移动端适配
  - Markdown 渲染与交互式阅读体验
- **安全加固**：
  - PBKDF2 密码哈希
  - API 密钥环境变量隔离
  - Database 初始化保护

## 🛠️ 技术栈

- **Frontend**: React 19, TypeScript, Tailwind CSS 4, React Markdown
- **Backend**: Cloudflare Workers, Hono, D1 Database
- **AI Services**: Volcengine ASR & ARK LLM

## 📦 本地开发

### 1. 安装依赖

```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd worker
npm install
```

### 2. 配置环境变量

后端密钥已迁移至 `worker/.dev.vars`（本地开发自动加载）。

### 3. 初始化数据库 (本地)

```bash
cd worker
npx wrangler d1 execute podcast-summarizer-dev --local --file=./schema.sql
# 初始化默认用户 (admin/admin123)
curl "http://localhost:8787/api/init?secret=podcast-init-secret-2026"
```

### 4. 启动开发服务器

```bash
# 终端 1：启动 Worker
cd worker
npm run dev

# 终端 2：启动前端
npm run dev
```

## 🔒 账号管理

默认管理员账号：
- 用户名: `admin`
- 密码: `admin123`

请登录后在控制台从 D1 数据库修改密码哈希。

## ⚠️ 注意事项

1. **环境权限**：macOS 用户如遇 `npm install` 权限问题，请授予终端完全磁盘访问权限或使用 `sudo` 修复目录权限。
2. **Worker 限制**：免费版 Workers 有 CPU 时间限制，本项目已通过分步架构优化，但在高并发转录长音频时仍需留意用量。
