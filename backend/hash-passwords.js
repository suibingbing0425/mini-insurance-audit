// 一次性脚本：把 user 表里的明文密码加密成 bcrypt 哈希（登录接口要求密码是哈希）
const bcrypt = require('bcryptjs')
const { sequelize, User } = require('./src/models')

async function main() {
  try {
    const users = await User.findAll()
    for (const u of users) {
      if (u.password && !u.password.startsWith('$2')) {
        u.password = bcrypt.hashSync(u.password, 10)
        await u.save()
        console.log('已加密：', u.username)
      } else {
        console.log('跳过（已是哈希）：', u.username)
      }
    }
    console.log('密码加密完成！')
  } catch (e) {
    console.error('失败：', e.message)
  } finally {
    process.exit()
  }
}
main()
