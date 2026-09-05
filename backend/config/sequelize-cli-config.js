// sequelize-cli 使用的数据库配置（替代 models 里的 dotenv 直读）
// 与 src/config/db.js 保持一致的 env 变量来源：DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASS
require('dotenv').config()

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql'
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql'
  }
}
