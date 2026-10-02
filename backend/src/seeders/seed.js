// 种子数据脚本：科室 + 用户 + 测试患者 + 药品 + 规则
// 运行：node src/seeders/seed.js           （默认幂等：只补不删，绝不碰手开医嘱/审核记录）
//       node src/seeders/seed.js --reset   （清空所有表后重建，用于彻底重置演示环境）
const bcrypt = require('bcryptjs')
const {
  sequelize, Department, User, Drug, AuditRule,
  MedicalOrder, Prescription, AuditRecord, AuditLog, Patient
} = require('../models')
const { generateExecutableRules } = require('../services/executableRuleFactory')

const departments = [
  { name: '内科', code: 'NK001' },
  { name: '外科', code: 'WK001' },
  { name: '儿科', code: 'EK001' },
]

const users = [
  { username: 'dr_wang', password: '123456', name: '王医生', role: 'doctor', dept: '内科' },
  { username: 'admin_zheng', password: '123456', name: '郑管理员', role: 'admin', dept: null },
]

// 测试患者（含不同性别/年龄/妊娠/医保类型，用于演示各种禁忌规则）
const patients = [
  { name: '张小明', gender: '男', age: 8, id_card: '110101201801010001', phone: '13800000001', pregnancy_status: 0, insurance_type: '居民医保' },
  { name: '李小红', gender: '女', age: 28, id_card: '110101199801010002', phone: '13800000002', pregnancy_status: 1, insurance_type: '职工医保' },
  { name: '张大壮', gender: '男', age: 65, id_card: '110101196001010003', phone: '13800000003', pregnancy_status: 0, insurance_type: '职工医保' },
  { name: '王秀英', gender: '女', age: 70, id_card: '110101195501010004', phone: '13800000004', pregnancy_status: 0, insurance_type: '居民医保' },
  { name: '陈小雨', gender: '女', age: 32, id_card: '110101199401010005', phone: '13800000005', pregnancy_status: 1, insurance_type: '居民医保' }
]

// 演示药房种子：只保留可触发真实规则的药（其余由 scripts/seed-rule-drugs.js 自动补充）
const drugs = [
  ['板蓝根颗粒', 'YB030', '中成药', '10g/袋', 20],
  ['阿苯达唑片', 'YB058', '驱虫类', '200mg/片', 400],
  ['安乃近片', 'YB059', '解热镇痛', '500mg/片', 1000],
  ['阿莫西林分散片', 'YB060', '抗生素', '250mg/片', 1000],
  ['艾附暖宫丸', 'YB061', '妇科中成药', '9g/丸', 9000],
  ['疤痕止痒软化膏', 'YB062', '皮肤科外用药', '20g/支', 20000],
]

// 8 条内置规则（带富字段），基于 2025 版医保监管规则库的典型场景
// 8 条内置规则 —— 法律依据/定义/逻辑全部引用《2025版医保监管规则库》官方框架
// code 用国家规则序号（GJ2025-XX），legal_basis 含官方条目+依据+结果类型+监管环节
const rules = generateExecutableRules()

const RESET = process.argv.includes('--reset')

async function main() {
  try {
    if (RESET) {
      console.log('⚠️ --reset 模式：将清空所有表（含手开医嘱/审核记录）后重建')
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0')
      const tables = ['audit_log', 'audit_record', 'prescription', 'medical_order',
        'audit_rule', 'drug', 'patient', 'user', 'department']
      for (const t of tables) await sequelize.query(`TRUNCATE TABLE ${t}`)
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1')
    } else {
      console.log('幂等模式：只补充缺失的基础数据，不会清空手开医嘱/审核记录')
    }

    // 基础数据：缺失才创建（findOrCreate），已存在则原样保留，绝不删除任何业务数据
    // 1. 科室
    for (const d of departments) await Department.findOrCreate({ where: { name: d.name }, defaults: d })
    const deptMap = {}
    for (const d of await Department.findAll()) deptMap[d.name] = d.id

    // 2. 用户
    for (const u of users) {
      await User.findOrCreate({
        where: { username: u.username },
        defaults: {
          username: u.username, password: bcrypt.hashSync(u.password, 10),
          name: u.name, role: u.role, dept_id: u.dept ? deptMap[u.dept] : null
        }
      })
    }

    // 3. 测试患者（按身份证号去重，避免重复）
    for (const p of patients) await Patient.findOrCreate({ where: { id_card: p.id_card }, defaults: p })

    // 4. 药品（按编码去重）
    for (const [name, code, category, specification, max_dose] of drugs) {
      await Drug.findOrCreate({ where: { code }, defaults: { name, code, category, specification, max_dose, unit: 'mg' } })
    }

    // 5. 规则：清理旧版手写示例（GJ2025-*，被审计记录引用则跳过），再按真实生成结果同步
    //    （存在则刷新字段、缺失则创建，使可执行规则始终严格跟随 rule-library.json 源表）
    try { await sequelize.query("DELETE FROM audit_rule WHERE code LIKE 'GJ2025%'") }
    catch (e) { console.warn('旧版示例规则清理跳过（被审计记录引用）：', e.message) }
    for (const r of rules) {
      delete r._srcSeq // 内部溯源标记（来自 88 条源表哪一条），不落库
      const exist = await AuditRule.findOne({ where: { code: r.code } })
      if (exist) await exist.update({ ...r, enabled: 1 })
      else await AuditRule.create({ ...r, enabled: 1 })
    }

    console.log(`种子完成（${RESET ? 'reset' : 'upsert'}）：科室/用户/患者/药品/规则已确保存在；手开医嘱与审核记录不受影响`)
    console.log('账号：dr_wang/123456(医生)  admin_zheng/123456(管理员)')
    console.log('测试患者：张小明男8岁、李小红女28岁(妊娠)、张大壮男65岁、王秀英女70岁（用于演示性别/年龄/妊娠禁忌）')
  } catch (e) {
    console.error('种子失败：', e.message)
  } finally {
    await sequelize.close()
    process.exit()
  }
}
main()