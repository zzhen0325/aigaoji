# 部署到 Cloudflare Pages

## 1) 关联仓库
- 在 Cloudflare Dashboard → Pages → Create a project
- 选择本仓库

## 2) 构建设置
- Framework preset: Vite
- Build command: `pnpm run build`
- Build output directory: `dist`
- Node version: `20`

如果 Cloudflare 没有自动识别 pnpm：
- Build command 改为：`corepack enable && pnpm install --frozen-lockfile && pnpm run build`

## 3) Pages Functions（后端 /api 代理）
本仓库已增加 `functions/` 目录，Cloudflare 会自动部署为 Pages Functions。

支持的接口：
- `/api/fund/*` → `https://fund.eastmoney.com/*`
- `/api/fundgz/*` → `https://fundgz.1234567.com.cn/*`
- `/api/fund-search/*` → `https://fundsuggest.eastmoney.com/*`
- `/api/fund-holdings/*` → `https://fundmobapi.eastmoney.com/*`
- `/api/fundf10/*` → `https://fundf10.eastmoney.com/*`
- `/api/stock-trends/*` → `https://push2his.eastmoney.com/*`
- `/api/stock/*` → `http://hq.sinajs.cn/*`
- `/api/local-users`、`/api/local-portfolios`：返回空数据（serverless 无持久化）

## 4) SPA 路由（React Router）
已添加 `public/_redirects`，用于把所有非文件路径回落到 `/index.html`，避免刷新 404。

