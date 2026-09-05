const express = require('express')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
require('dotenv').config()

const authRoutes = require('./routes/auth.routes')
const userRoutes = require('./routes/user.routes')
const departmentRoutes = require('./routes/department.routes')
const patientRoutes = require('./routes/patient.routes')
const drugRoutes = require('./routes/drug.routes')
const orderRoutes = require('./routes/order.routes')
const ruleRoutes = require('./routes/rule.routes')
const auditRoutes = require('./routes/audit.routes')
const statsRoutes = require('./routes/stats.routes')
const libraryRoutes = require('./routes/library.routes')
const knowledgeRoutes = require('./routes/knowledge.routes')
const errorHandler = require('./middlewares/errorHandler')
const { sequelize } = require('./models')

// 跨域：限定来源，避免任何域名都能调用 API（生产用 CORS_ORIGIN 注入，多个用逗号分隔）
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173']

// 全局限流：单 IP 15 分钟内最多 200 次请求，防止接口被刷
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '请求过于频繁，请稍后再试' }
})

const app = express()
app.use(cors({ origin: allowedOrigins, credentials: true }))
app.use(express.json({ limit: '25mb' }))  // 解析 JSON body（放宽上限以支持 Excel 导入的 base64 内容）
app.use(globalLimiter)

// 登录接口严格限流：15 分钟内同一 IP 最多 20 次，缓解暴力破解
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '登录尝试过于频繁，请 15 分钟后再试' }
})

// 挂载路由
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/departments', departmentRoutes)
app.use('/api/patients', patientRoutes)
app.use('/api/drugs', drugRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/rules', ruleRoutes)
app.use('/api/audits', auditRoutes)
app.use('/api/stats', statsRoutes)
app.use('/api/rules-library', libraryRoutes)
app.use('/api/knowledge', knowledgeRoutes)

// 404 兜底
app.use((req, res) => res.status(404).json({ code: 404, message: '接口不存在' }))

// 统一错误处理（Express 5 会把 async 抛出的异常自动送到这里）
app.use(errorHandler)

const PORT = process.env.PORT || 3000
if (require.main === module) {
  // 数据表结构由迁移管理（npm run migrate / docker 启动脚本执行 db:migrate），此处不再自动 sync
  app.listen(PORT, () => console.log(`服务器已启动: http://localhost:${PORT}`))
}
