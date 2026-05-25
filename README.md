# OpenAI 兼容聊天

这是一个基于 Next.js 和 AI SDK 的 AI 聊天应用，重点支持 OpenAI-compatible 接口。项目可以连接公司内部兼容 OpenAI 协议的模型服务，也可以连接本地 Ollama 服务，用于快速搭建和调试多模型聊天体验。

## 功能特点

- 基于 Next.js App Router、React 19 和 TypeScript 构建
- 使用 AI SDK 接入 OpenAI-compatible 模型提供方
- 支持通过 `ai-models.json` 配置模型列表、默认模型和模型能力
- 支持公司内部模型服务与本地 Ollama 两类提供方
- 集成 Auth.js、Postgres、Redis 和 Blob 存储能力
- 使用 Tailwind CSS、Radix UI 和 shadcn/ui 风格组件构建界面
- 内置 Playwright 测试配置

## 技术栈

- Next.js 16
- React 19
- AI SDK 6
- TypeScript
- Drizzle ORM
- Postgres
- Redis
- Tailwind CSS
- Playwright
- pnpm

## 环境要求

- Node.js 22 或更高版本
- pnpm 10.32.1 或兼容版本
- 可用的 Postgres 数据库
- 可用的 Redis 服务
- 至少一个 OpenAI-compatible 模型接口

## 本地运行

1. 安装依赖：

```bash
pnpm install
```

2. 复制环境变量模板：

```bash
cp .env.example .env.local
```

3. 按实际环境修改 `.env.local`。

4. 执行数据库迁移：

```bash
pnpm db:migrate
```

5. 启动开发服务：

```bash
pnpm dev
```

应用默认运行在 `http://localhost:3000`。

## 环境变量

项目所需变量见 `.env.example`：

| 变量 | 说明 |
| --- | --- |
| `AUTH_SECRET` | Auth.js 使用的加密密钥 |
| `COMPANY_AI_BASE_URL` | 公司内部 OpenAI-compatible 接口地址 |
| `COMPANY_AI_API_KEY` | 公司内部模型接口密钥 |
| `OLLAMA_BASE_URL` | 本地 Ollama OpenAI-compatible 接口地址 |
| `OLLAMA_API_KEY` | Ollama 接口密钥占位值 |
| `AI_MODEL` | 服务端默认模型 ID |
| `NEXT_PUBLIC_AI_MODEL` | 前端默认模型 ID |
| `BLOB_READ_WRITE_TOKEN` | Blob 存储读写令牌 |
| `POSTGRES_URL` | Postgres 连接地址 |
| `REDIS_URL` | Redis 连接地址 |

不要提交 `.env.local` 或其他包含真实密钥的环境变量文件。

## 模型配置

模型配置位于 `ai-models.json`。

当前包含两个提供方：

- `company`：公司内部 OpenAI-compatible 模型服务
- `ollama`：本地 Ollama 模型服务

默认模型为：

```text
company/gemini-3.1-pro-preview:latest
```

添加新模型时，需要在 `models` 数组中补充模型 ID、提供方、原始模型名称、展示名称、描述和能力信息。

## 常用脚本

```bash
pnpm dev          # 启动开发服务
pnpm build        # 数据库迁移并构建生产包
pnpm start        # 启动生产服务
pnpm check        # 运行代码检查
pnpm fix          # 自动修复格式和 lint 问题
pnpm db:generate  # 生成 Drizzle 迁移
pnpm db:migrate   # 执行数据库迁移
pnpm db:studio    # 打开 Drizzle Studio
pnpm test         # 运行 Playwright 测试
```

## 项目结构

```text
app/          Next.js App Router 页面和布局
components/   通用 UI 组件
hooks/        React Hooks
lib/          核心业务逻辑、数据库、AI、工具函数
artifacts/    聊天产物相关逻辑
public/       静态资源
tests/        Playwright 测试
```

## 部署说明

部署时请根据目标平台自行配置 Node.js 运行环境、构建命令、启动命令和环境变量。

推荐命令：

```bash
pnpm install
pnpm build
pnpm start
```
