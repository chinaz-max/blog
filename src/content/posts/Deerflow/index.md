---
title: DeerFlow 本地部署与进阶使用指南：从 Docker 启动到 Super Agent 原理
published: 2026-08-11
description: 在 Windows + Docker Desktop 环境中部署 DeerFlow，配置 OpenAI 兼容模型，并掌握基础使用、Skills、MCP、子代理、记忆与运维方法
tags: [DeerFlow, AI Agent, Docker, 大语言模型, 本地部署]
image: ./cover.jpg
category: AI Agents
draft: false
---

## 1. 项目背景与 DeerFlow 概述

DeerFlow 是一个基于 **LangGraph + LangChain** 构建的开源 Super Agent Harness。它不只是一个“把问题发给模型、得到回答”的聊天界面，而是为 Agent 提供了一套可执行任务的运行环境：模型可以规划任务、调用工具、读写工作区文件、在需要时委派子代理，并把过程和结果持久化到线程中。

可以将 DeerFlow 理解为下面这条链路：

```text
用户目标
   ↓
大模型负责理解、规划与决策
   ↓
工具 / 文件 / Web / MCP / 子代理负责执行
   ↓
模型根据执行结果继续决策
   ↓
输出答案、报告、代码或工作区交付物
```

相较于普通聊天产品，DeerFlow 的优势不在于“单次回答更长”，而在于它能把一个复杂目标拆成多轮可验证的动作。例如：调研竞品、整理多个文件、生成报告、调用企业内部工具、按计划重复执行任务等。

本文以 Windows 本地 Docker 部署为例，完整介绍 DeerFlow 的部署流程、基础与进阶玩法，以及其内部实现原理。

## 2. 本地部署目标与环境准备

本次部署目标是将 DeerFlow 运行在 Windows 本机，浏览器通过 `http://localhost:2026` 访问。服务默认只绑定本机回环地址，不直接暴露给局域网或公网。

### 2.1 推荐环境

| 项目 | 建议 |
|------|------|
| 操作系统 | Windows 10/11 + WSL2 |
| 容器运行时 | Docker Desktop（Linux containers） |
| CPU / 内存 | 最低 2 核 / 4 GB；推荐 4 核 / 8 GB 以上 |
| 模型 | 支持 OpenAI Chat Completions 的模型或中转服务 |
| 网络 | 首次拉取镜像和构建时需要能访问 Docker Hub、PyPI、npm 等资源 |

Docker Desktop 安装并启动后，先执行：

```powershell
docker info
```

如果输出同时包含 `Client` 与 `Server`，且 `Operating System` 为 Docker Desktop，说明 Docker 引擎已就绪。

### 2.2 获取源码与初始化配置

```powershell
git clone https://github.com/bytedance/deer-flow.git DeerFlow
cd DeerFlow
python scripts\configure.py
```

初始化后，根目录会生成三个本地配置文件：

```text
DeerFlow/
|-- config.yaml              # Agent、模型、工具、记忆等主配置
|-- .env                     # API Key、端口、代理等敏感环境变量
|-- frontend/.env            # 前端运行环境变量
|-- extensions_config.json   # MCP 与 Skills 的运行时配置（首次部署可自动生成）
```

其中 `.env` 与 `config.yaml` 已被 Git 忽略。API Key 应始终写入 `.env`，不要硬编码到 `config.yaml`，更不要提交到仓库。

## 3. 模型配置：兼容 OpenAI API 即可接入

DeerFlow 使用模型工厂适配不同供应商。对于 OpenAI、OpenRouter，以及绝大多数 OpenAI 兼容中转站，最简单的配置方式是 `langchain_openai:ChatOpenAI` 加 `base_url`。

在 `.env` 中配置密钥：

```env
OPENAI_API_KEY=替换为你的真实密钥
```

在 `config.yaml` 的 `models:` 下配置模型：

```yaml
models:
  - name: my-default-model
    display_name: 我的默认模型
    use: langchain_openai:ChatOpenAI
    model: 你的模型名称
    api_key: $OPENAI_API_KEY
    base_url: https://你的兼容接口/v1
    request_timeout: 600.0
    max_retries: 2
    max_tokens: 4096
    supports_thinking: false
    supports_vision: false
```

注意事项：

* `base_url` 应填写接口根路径，通常以 `/v1` 结尾；不要误用某些供应商专属的 `api_base` 字段。
* “Token 不限量”通常指套餐额度，不代表模型上下文窗口无限。未知上下文长度时，不要随意填写 `context_window`。
* 中转站至少应支持 Chat Completions、流式返回和工具调用；否则多轮工具任务可能在中途报错。
* 优先使用 HTTPS。HTTP 地址会明文传输密钥、对话内容与工具结果，不适合敏感数据。

## 4. Docker 部署流程与网络排错

### 4.1 一键构建并启动

Windows 下可以通过项目自带的 Git Bash 包装器启动生产容器：

```powershell
.\scripts\run-with-git-bash.cmd .\scripts\deploy.sh
```

该命令会完成以下事情：

1. 检查并读取 `config.yaml`、`.env`；
2. 自动生成 Better Auth 会话密钥和内部 Gateway 通信令牌；
3. 构建 Gateway 与前端镜像；
4. 拉起 Redis、Gateway、Frontend、Nginx；
5. 将 Nginx 的 `2026` 端口绑定到 `127.0.0.1`。

成功后访问：

```text
http://localhost:2026
```

### 4.2 常见问题：Docker Hub 拉取超时

在部分网络环境中，首次构建可能出现：

```text
failed to fetch oauth token: Post "https://auth.docker.io/token": connectex timeout
```

这不是 DeerFlow 代码错误，而是 Docker Desktop 无法访问 Docker Hub。可按下面顺序处理：

1. 确认 VPN/代理已经连接，并重启 Docker Desktop；
2. 先手动验证镜像拉取：

```powershell
docker pull nginx:alpine
docker pull redis:7-alpine
docker pull node:22-alpine
docker pull python:3.12-slim-bookworm
docker pull docker:cli
docker pull ghcr.io/astral-sh/uv:0.7.20
```

3. 基础镜像都成功拉取后，再重新执行 `deploy.sh`；构建会优先使用本地镜像缓存。

如果使用本地 HTTP 代理，可在 Docker Desktop 的 `Settings → Resources → Proxies` 中同时设置 HTTP 与 HTTPS 代理，例如：

```text
http://host.docker.internal:7890
```

没有代理时，可以使用组织提供的镜像仓库；使用公共第三方镜像站前应确认其可信度。

### 4.3 启动、停止与查看日志

镜像已经构建完成后，后续启动无需重新构建：

```powershell
.\scripts\run-with-git-bash.cmd .\scripts\deploy.sh start
```

停止并移除容器：

```powershell
.\scripts\run-with-git-bash.cmd .\scripts\deploy.sh down
```

查看状态和 Gateway 日志：

```powershell
docker compose --env-file .env -p deer-flow -f docker/docker-compose.yaml ps
docker compose --env-file .env -p deer-flow -f docker/docker-compose.yaml logs -f gateway
```

项目根目录还可以放置一个 `Start-DeerFlow.bat`。它的职责是检查 Docker 引擎、必要时启动 Docker Desktop、等待引擎就绪，然后执行 `deploy.sh start` 并打开浏览器，适合日常双击使用。

## 5. 基础使用方法

### 5.1 从对话开始

打开网页后，注册或登录本地账号，创建一个新会话并选择已配置的模型。推荐将目标、范围、限制和输出格式一次说清：

```text
请先给出执行计划，等我确认后再开始。
调研三个 AI Agent 框架，输出 Markdown 对比表，包含定位、部署难度、扩展能力、风险与推荐结论。
```

相比“帮我研究一下”，明确的边界可以减少无效搜索、子任务和 Token 消耗。

### 5.2 文件、工作区与交付物

上传的文件会进入当前线程的工作区。Agent 可以读取文件、提取内容、在工作区生成 Markdown、CSV、代码或其他输出。典型任务包括：

* 多份报价单的金额核对与汇总；
* PDF/Word 资料摘要与问答；
* CSV、Excel 数据清洗和可视化建议；
* 将需求文档拆成开发计划、测试清单与验收标准；
* 根据资料生成报告初稿。

Docker 部署默认不会让 Agent 自动访问整台电脑。需要处理本机文件时，优先通过网页上传；不要上传密钥、私钥、密码库或未经授权的敏感数据。

### 5.3 规划、澄清与停止

对于复杂任务，可以先要求它“只规划、不执行”。当任务目标、权限或输出格式不清楚时，DeerFlow 可以发起结构化澄清问题。对话过程中应检查工具调用和生成文件；发现方向错误时及时停止并补充约束，而不是等长任务结束后再返工。

## 6. 进阶玩法

### 6.1 Skills：把经验固化成可复用工作流

Skill 是一个以 `SKILL.md` 为核心的能力包，里面可以包含操作步骤、最佳实践、脚本和参考资料。DeerFlow 内置研究、数据分析、报告、网页、图像等技能，也支持自定义技能。

显式调用技能的形式如下：

```text
/data-analysis 分析我上传的 sales.csv，找出同比异常并生成图表说明
```

Skills 按需加载，而非每轮对话全量注入，能减少上下文占用。自定义技能通常放在：

```text
skills/custom/你的技能名/SKILL.md
```

### 6.2 子代理：用并行分工处理复杂目标

主代理可以创建多个拥有独立上下文的子代理。例如在竞品研究中，可以分别派出“市场调研”“技术架构”“价格策略”子任务，最后由主代理汇总。

子代理并非越多越好：每个子代理都会增加模型调用与上下文成本。对于个人使用，建议将 `subagents.max_total_per_run` 设置为 1–2；只有多个任务确实互不依赖时才启用并行。

### 6.3 MCP：连接外部系统

Model Context Protocol（MCP）让 DeerFlow 接入外部工具，例如：

* GitHub、GitLab、代码仓库；
* 数据库与内部业务 API；
* 知识库、文档系统、浏览器自动化服务；
* 企业协作平台和自定义工具。

MCP 服务与技能的启用状态保存在 `extensions_config.json`。接入 MCP 前要明确其权限范围：只读查询、写入数据、发送消息和执行命令的风险完全不同。

### 6.4 长期记忆、目标与上下文压缩

DeerFlow 可以将稳定的用户偏好和事实保存在本地记忆中，例如“我偏好中文输出”“项目使用 TypeScript”。一次性任务指令不应当写进长期记忆。

对于很长的会话，可使用目标管理和上下文压缩：保留当前约束与关键结论，压缩过时的工具细节，避免上下文不断膨胀。这样适合持续数天的项目分析或迭代写作。

### 6.5 浏览器、定时任务与可观测性

以下能力需要额外配置，默认不一定开启：

| 能力 | 用途 | 关键前提 |
|------|------|------|
| Agentic Browser | 点击、输入、操作动态网页 | 安装 Playwright 与 Chromium，开启 browser 工具组 |
| 定时任务 | 一次性或 Cron 定时执行 | `scheduler.enabled: true` |
| LangSmith / Langfuse | 查看模型、工具与链路追踪 | 配置对应 API Key |
| 飞书/Lark 等渠道 | 在 IM 中使用 Agent | 配置应用凭据与技能包 |
| 自定义 Agent | 为不同角色限制工具/技能 | 配置 Agent 与授权策略 |

浏览器自动化和外部系统写入尤其容易受提示注入影响。涉及登录、付款、删除、发送消息时，应将人工确认保留在关键步骤。

## 7. 核心实现原理

### 7.1 服务架构

生产 Docker 栈由以下服务组成：

```text
浏览器
  |
  v
Nginx :2026  ------------------- 统一入口、静态页面与 API 反向代理
  |                              
  +--> Frontend :3000 ----------- Next.js 对话界面
  |
  +--> Gateway :8001 ------------ FastAPI + LangGraph Agent Runtime
          |  |  |
          |  |  +--> 模型 API（OpenAI 兼容接口等）
          |  +-----> Skills / MCP / 工具 / 文件工作区
          +--------> Redis 流式事件桥接、线程状态与持久化数据
```

Nginx 是唯一对外入口。网页请求由前端处理，`/api/*` 请求转发到 Gateway；外部浏览器不需要直接访问 Gateway 的 `8001` 端口。

### 7.2 Agent 的执行循环

一次任务不是“一次模型调用”，而是一个受状态机控制的循环：

```text
读取消息、历史、记忆与可用工具
          ↓
模型决定：回答 / 调工具 / 读技能 / 创建子代理 / 请求澄清
          ↓
执行工具并收集结果
          ↓
把结果送回模型，继续判断下一步
          ↓
得到最终答案、文件或可恢复的任务状态
```

LangGraph 用图状态与检查点管理这条循环。每一轮工具调用、子代理进度和模型消息可以通过 SSE 实时推送到前端；中断、刷新或重连时，系统可从线程状态和事件记录恢复。

### 7.3 为什么能完成长任务

DeerFlow 通过四种机制控制复杂度：

1. **渐进式 Skills 加载**：只在任务需要时把技能完整说明放入上下文；
2. **子代理上下文隔离**：调研细节留在子任务中，主代理只接收结构化结论；
3. **上下文压缩与文件卸载**：旧过程被总结，长内容写入工作区文件而非永久塞进聊天记录；
4. **持久化记忆与检查点**：用户偏好、线程历史和任务状态可跨刷新、跨会话复用。

### 7.4 模型兼容层与安全边界

模型配置层负责把统一的消息、工具调用定义转换为各供应商 API 请求。OpenAI 兼容服务通常只需要替换模型名、密钥与 `base_url`，因此更换供应商的成本较低。

安全边界则来自多个层面：Docker 容器、每线程工作区、工具启用策略、MCP 权限、可选授权策略，以及默认仅监听 `127.0.0.1`。需要注意的是，Agent 能执行工具不等于它天然安全：不可信网页、文档和 MCP 返回内容都可能携带提示注入指令，应限制高风险工具并保持人工审核。

## 8. Token、成本与运维建议

DeerFlow 的消耗通常高于普通聊天，因为一次目标可能包含规划、工具调用、文件分析、重试和子代理。简单任务可能只消耗数千到数万 Token；深度研究或并行任务可能达到十万 Token 以上。

建议在 `config.yaml` 启用预算保护：

```yaml
token_budget:
  enabled: true
  max_tokens: 50000
  max_input_tokens: 40000
  max_output_tokens: 10000
  warn_threshold: 0.8
  hard_stop_threshold: 1.0
```

初期可使用 50,000 Token 作为单任务上限，观察实际任务质量与成本后再调整。若供应商返回准确 usage，也可以为模型配置 `pricing`，在控制台查看费用估算。

日常运维建议：

* 保留 Docker Desktop 的自动启动或使用一键启动脚本；
* 更新 DeerFlow 前备份 `.env`、`config.yaml` 与 `backend/.deer-flow/`；
* 更换模型后重新执行部署命令，使容器读取新环境变量；
* 只在需要时开启浏览器自动化、MCP 写权限和宿主机命令执行；
* 不要把 `BIND_HOST` 改为 `0.0.0.0` 后直接裸露到公网；如需公网访问，应增加 HTTPS、认证、访问控制和反向代理。

## 9. 总结

DeerFlow 将模型、工具、文件工作区、技能、记忆、子代理和持久化状态放入同一条 Agent 执行链路中。对于个人用户，它可以作为本地的研究、资料处理与报告生成助手；对于开发者和团队，它还能通过 Skills、MCP、Custom Agent 与可观测性能力逐步扩展为面向具体业务的自动化工作台。

最适合的上手路径是：先配置一个可靠模型 → 用简单对话和上传文件验证基础链路 → 再引入 Skills 与 MCP → 最后才启用子代理、浏览器自动化、定时任务和外部写操作。这样既能控制成本，也能把安全边界保持在可理解、可审查的范围内。
