// 模型验证脚本：验证"代码写数据 → 进数据库" + 关联查询
const { sequelize, Department, User } = require('./src/models')

async function main() {
  try {
    // 清理上次测试数据（保证脚本能重复运行）
    await User.destroy({ where: { username: 'dr_wang' } })
    await Department.destroy({ where: { code: 'NK001' } })

    // 1. 写一个科室
    const dept = await Department.create({ name: '内科', code: 'NK001' })
    console.log('1) 科室写入成功，id =', dept.id)

    // 2. 写一个医生，挂到这个科室
    const doctor = await User.create({
      username: 'dr_wang',
      password: '123456',   // 后面登录接口会改成 bcrypt 加密，这里先占位
      name: '王医生',
      role: 'doctor',
      dept_id: dept.id
    })
    console.log('2) 医生写入成功，id =', doctor.id)

    // 3. 关联查询：把医生和他的科室名一起查出来（验证关联配置正确）
    const result = await User.findByPk(doctor.id, {
      include: [{ model: Department }]
    })
    console.log('3) 关联查询成功：', result.name, '→ 科室:', result.Department.name)

    console.log('模型验证全部通过！去 Navicat 刷新 department 和 user 表看看')
  } catch (e) {
    console.error('模型验证失败：', e.message)
  } finally {
    process.exit()
  }
}

main()
