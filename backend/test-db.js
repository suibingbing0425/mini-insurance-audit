const sequelize = require('./src/config/db')
async function main() {
  try {
    await sequelize.authenticate()
    console.log('数据库连接成功！')
  } catch (e) {
    console.error('连接失败：', e.message)
  } finally {
    process.exit()
  }
}
main()
