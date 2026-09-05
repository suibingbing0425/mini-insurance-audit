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

// 50 种常用药（name, code, category, specification, max_dose 单次剂量上限mg, unit）
const drugs = [
  ['阿莫西林', 'YB001', '抗生素', '250mg/粒', 500], ['克林霉素', 'YB002', '抗生素', '150mg/粒', 600],
  ['头孢氨苄', 'YB003', '抗生素', '250mg/粒', 500], ['阿奇霉素', 'YB004', '抗生素', '250mg/片', 500],
  ['左氧氟沙星', 'YB005', '抗生素', '100mg/片', 400], ['甲硝唑', 'YB006', '抗生素', '200mg/片', 600],
  ['红霉素', 'YB007', '抗生素', '250mg/片', 500], ['青霉素V钾', 'YB008', '抗生素', '250mg/片', 500],
  ['头孢克肟', 'YB009', '抗生素', '100mg/粒', 200], ['诺氟沙星', 'YB010', '抗生素', '100mg/粒', 400],
  ['布洛芬', 'YB011', '解热镇痛', '100mg/粒', 400], ['对乙酰氨基酚', 'YB012', '解热镇痛', '500mg/片', 1000],
  ['阿司匹林', 'YB013', '解热镇痛', '100mg/片', 300], ['双氯芬酸', 'YB014', '解热镇痛', '25mg/片', 75],
  ['洛索洛芬', 'YB015', '解热镇痛', '60mg/片', 120], ['塞来昔布', 'YB016', '解热镇痛', '200mg/粒', 400],
  ['美洛昔康', 'YB017', '解热镇痛', '7.5mg/片', 15], ['吲哚美辛', 'YB018', '解热镇痛', '25mg/粒', 75],
  ['依托考昔', 'YB019', '解热镇痛', '60mg/片', 120], ['酮咯酸', 'YB020', '解热镇痛', '10mg/片', 30],
  ['感冒灵颗粒', 'YB021', '感冒', '10g/袋', 20], ['复方氨酚烷胺', 'YB022', '感冒', '250mg/片', 500],
  ['氨溴索', 'YB023', '祛痰', '30mg/片', 60], ['右美沙芬', 'YB024', '镇咳', '15mg/片', 30],
  ['氯雷他定', 'YB025', '抗过敏', '10mg/片', 10], ['孟鲁司特', 'YB026', '平喘', '10mg/片', 10],
  ['沙丁胺醇气雾剂', 'YB027', '平喘', '100ug/喷', 200], ['布地奈德', 'YB028', '平喘', '200ug/吸', 800],
  ['连花清瘟胶囊', 'YB029', '中成药', '400mg/粒', 1200], ['板蓝根颗粒', 'YB030', '中成药', '10g/袋', 20],
  ['奥美拉唑', 'YB031', '消化', '20mg/粒', 40], ['雷贝拉唑', 'YB032', '消化', '10mg/粒', 20],
  ['多潘立酮', 'YB033', '消化', '10mg/片', 30], ['蒙脱石散', 'YB034', '消化', '3g/袋', 9],
  ['铝碳酸镁', 'YB035', '消化', '500mg/片', 1500], ['乳果糖', 'YB036', '消化', '10g/袋', 30],
  ['双歧杆菌三联活菌', 'YB037', '消化', '210mg/粒', 420], ['枸橼酸铋钾', 'YB038', '消化', '110mg/粒', 330],
  ['氨氯地平', 'YB039', '降压', '5mg/片', 10], ['硝苯地平', 'YB040', '降压', '10mg/片', 30],
  ['美托洛尔', 'YB041', '降压', '25mg/片', 100], ['厄贝沙坦', 'YB042', '降压', '150mg/片', 300],
  ['阿托伐他汀', 'YB043', '降脂', '20mg/片', 40], ['瑞舒伐他汀', 'YB044', '降脂', '10mg/片', 20],
  ['辛伐他汀', 'YB045', '降脂', '20mg/片', 40], ['二甲双胍', 'YB046', '降糖', '500mg/片', 1000],
  ['阿卡波糖', 'YB047', '降糖', '50mg/片', 100], ['格列美脲', 'YB048', '降糖', '2mg/片', 4],
  ['维生素C', 'YB049', '维生素', '100mg/片', 300], ['碳酸钙D3', 'YB050', '钙剂', '600mg/片', 1200],
  // 新增用于演示性别/年龄禁忌的药品（seed 后追加）
  ['己烯雌酚', 'YB051', '激素类', '1mg/片', 1],
  ['庆大霉素', 'YB052', '抗生素', '80mg/片', 240],
  // 妊娠期禁用药（官方第73条）
  ['甲氨蝶呤', 'YB053', '抗肿瘤', '2.5mg/片', 10],
  ['沙利度胺', 'YB054', '免疫调节', '25mg/片', 100],
  ['华法林', 'YB055', '抗凝药', '3mg/片', 5],
  // 限医保类型/限医院级别药品
  ['阿达木单抗', 'YB056', '生物制剂', '40mg/支', 40],
  ['注射用紫杉醇', 'YB057', '抗肿瘤', '30mg/支', 175],
  // 一键演示药品（名称与可执行规则中的精确全名一致，否则规则匹配不到）
  // ① 妊娠禁忌(EXE-PREG)：阿苯达唑片  ② 儿童禁用(EXE-AGE66,18岁以下)：安乃近片
  ['阿苯达唑片', 'YB058', '驱虫类', '200mg/片', 400],
  ['安乃近片', 'YB059', '解热镇痛', '500mg/片', 1000],
  // ③ 超疗程(EXE-COURSE68,≤7天)：阿莫西林分散片  ④ 限女性(GENDER-F)：艾附暖宫丸
  ['阿莫西林分散片', 'YB060', '抗生素', '250mg/片', 1000],
  ['艾附暖宫丸', 'YB061', '妇科中成药', '9g/丸', 9000],
  // ⑤ 限工伤保险(EXE-INS)：疤痕止痒软化膏
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