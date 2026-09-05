# 医保智能审核系统（mini-insurance-audit）

> 面向医保基金智能监管的**全栈演示系统**：事前开方提醒 → 事中审核 → 事后复审反馈 的闭环。
> 数据来源真实：规则与知识点全部来自《2025版医疗保障基金智能监管规则库》，非模拟数据。

---

## 一、项目简介

系统模拟"医保审核员 + 开方医生"双角色场景：医生开处方时**事前实时提醒**潜在违规，提交后进入**事中审核队列**由管理员复核，支持复审、反馈、留痕。核心是一个**可扩展的规则审核引擎**，把 88 条真实监管规则中"算法可判定"的部分自动抽取为 **1172 条可执行规则**，逐条跑真实校验逻辑。

**技术栈**：Vue3 + Element Plus + Vite（前端）｜ Node.js + Express + Sequelize（后端）｜ MySQL 8（数据库）｜ vitest（单测）｜ Docker Compose（部署）｜ GitHub Actions（CI）

## 二、功能与亮点

| 模块 | 说明 |
|---|---|
| 审核引擎 | 策略模式：`checkers`（校验逻辑）与 `audit_rule`（规则配置）分离，`type` 字段桥接；覆盖 **8 类校验维度**：配伍禁忌 / 妊娠期用药 / 性别用药 / 年龄用药 / 医保类型限制 / 医疗机构级别 / 用药疗程 / 重复开药 |
| 真实规则数据 | ① 知识库 88 条国家规则 + 知识点（官方 Excel 全量灌入）；② 可执行规则 **1172 条**由脚本从真实数据自动抽取，带源表溯源 + 校验脚本保证与源表逐条一致，零编造 |
| 审核业务闭环 | 事前提醒（预审）→ 事中审核（提交）→ 事后处理（pass/audit/feedback/review + 操作留痕）；幂等防重复（处方签名 5 分钟重查） |
| 角色权限 | `doctor` 医生开方（可看知识库）；`admin` 管理员（审核队列 + 规则配置 + 知识库维护） |
| Excel 导入导出 | 管理员后台上传《规则库 Excel》批量导入/更新规则+知识点（完整库 / 单条明细两种模式，幂等）；审核记录一键导出 xlsx |
| 工程化 | sequelize-cli **migration** 建表（版本化、可回滚）；**GitHub Actions CI**（单测 + 前端构建 + 真实 MySQL 迁移三道门禁）；**Docker Compose** 一键起 MySQL+后端+前端；后端 24 个 vitest 单测 |

## 三、快速开始

### 方式 A：Docker 一键启动（推荐，无需本机装 MySQL/Node）

1. 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/) 并启动
2. 准备环境变量（复制模板再改数据库密码/密钥）：
   ```bash
   cp backend/.env.example backend/.env
   # 编辑 backend/.env：改 DB_PASS 与 JWT_SECRET（至少 32 位随机串）
   ```
3. 启动（首次会自动构建镜像 + 建表 + 灌种子数据，需几分钟）：
   ```bash
   docker compose up -d
   ```
4. 浏览器访问 **http://localhost:8080**

### 方式 B：本地开发模式（手动）

1. 本地装 MySQL 8，创建库并准备 `backend/.env`（同上）
2. 后端启动（自动执行 migration 建表）：
   ```bash
   cd backend
   npm install
   npm run migrate    # 建表
   npm run seed       # 灌入种子数据（含 88 条知识库 + 1172 条可执行规则）
   npm run dev        # http://localhost:3000
   ```
3. 前端启动：
   ```bash
   cd frontend
   npm install
   npm run dev        # http://localhost:5173（/api 自动代理到 3000）
   ```

> 测试账号：`dr_wang / 123456`（医生）｜ `admin_zheng / 123456`（管理员）
> 演示患者：张小明（男 8 岁）、李小红（女 28 岁·妊娠）、张大壮（男 65 岁）、王秀英（女 70 岁）——覆盖性别/年龄/妊娠禁忌演示

## 四、环境变量说明

复制 `backend/.env.example → backend/.env` 后填写：

| 变量 | 说明 |
|---|---|
| `DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASS` | 数据库连接（Docker 部署时 compose 自动覆盖 `DB_HOST=db`） |
| `JWT_SECRET` | 登录签名密钥，**必须改成随机长串**（勿用示例值） |
| `CORS_ORIGIN` | 允许跨域的前端来源（本地开发 5173；Docker 前端 8080） |

## 五、规则数据怎么来的（溯源）

```
2025年医疗保障基金智能监管规则库（官方 Excel）
   ├─ 第一个 sheet：88 条规则列表（分类 / 规则名 / 是否有明细）
   └─ 其余 sheet：每条规则的知识点明细（按"规则名 ∈ sheet名"匹配）
        ↓ 解析
rule-library.json（backend/data）
   ├─ migrate-rule-knowledge.js → rule_knowledge 表（88 条 + 知识点，知识库）
   └─ executableRuleFactory.js  → audit_rule 表（1172 条可执行规则，仅"算法可判定"维度）
        ↓ 引擎
auditEngine.js：按 type 找到对应 checker → 逐条跑校验 → 生成违规记录
```

- 校验脚本：`node backend/scripts/verify-executable-rules.js`（type 合法 / code 唯一 / 分类与源表一致 / 药名真实存在于源知识点）
- 批量导入（后台按钮）：解析逻辑同 `backend/src/services/ruleLibraryParser.js`

## 六、测试与 CI

```bash
cd backend && npm test        # vitest：24 个用例（引擎全部 checker + 聚合排序 + 依赖注入可测性）
```

CI（`.github/workflows/ci.yml`）每次 push / PR 自动跑：
1. `backend-test`：后端单测（无需 DB）
2. `frontend-build`：前端打包
3. `migration-check`：用真实 MySQL 容器执行 `db:migrate`，验证迁移可建表

## 七、目录结构

```
├─ docker-compose.yml        # 一键编排 mysql + backend + frontend
├─ .github/workflows/ci.yml  # CI 门禁
├─ backend/
│  ├─ src/
│  │  ├─ services/auditEngine.js        # 规则引擎（10 个 checker）
│  │  ├─ services/executableRuleFactory.js  # 真实规则自动抽取
│  │  ├─ services/ruleLibraryParser.js # Excel 批量导入解析
│  │  ├─ routes/                        # 7 组 REST API
│  │  ├─ models/                        # Sequelize 模型（9 表）
│  │  ├─ seeders/seed.js                # 种子数据
│  │  └─ app.js
│  ├─ migrations/                       # sequelize-cli 迁移（建表可版本化）
│  ├─ scripts/                          # 导入/校验/清理脚本
│  ├─ data/rule-library.json            # 88 条规则源数据
│  ├─ Dockerfile / .env.example
└─ frontend/
   ├─ src/views/                        # 9 个页面
   ├─ src/api/                          # axios 统一封装
   ├─ Dockerfile / nginx.conf
```

## 八、免责声明

演示/学习项目。规则来源于公开的《2025版医疗保障基金智能监管规则库》，仅用于技术演示，不构成任何医疗/医保审核结论。
