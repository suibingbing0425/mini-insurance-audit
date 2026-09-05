const { DataTypes } = require('sequelize')
const sequelize = require('../config/db')

// 9 个模型，全部显式指定 tableName（防止 Sequelize 自动复数化，尤其 user 表）
// timestamps: false + 显式声明 created_at —— 数据库 DEFAULT CURRENT_TIMESTAMP 填充，Sequelize 只查询不管理

// 科室
const Department = sequelize.define('Department', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(50), allowNull: false },
  code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  created_at: { type: DataTypes.DATE },
}, { tableName: 'department', timestamps: false })

// 用户（角色：doctor/admin）
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(100), allowNull: false },
  name: { type: DataTypes.STRING(50), allowNull: false },
  role: { type: DataTypes.ENUM('doctor', 'admin'), allowNull: false, defaultValue: 'doctor' },
  dept_id: DataTypes.INTEGER,
  created_at: { type: DataTypes.DATE },
}, { tableName: 'user', timestamps: false })

// 患者
const Patient = sequelize.define('Patient', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(50), allowNull: false },
  gender: { type: DataTypes.ENUM('男', '女'), allowNull: false },
  age: DataTypes.INTEGER,
  id_card: DataTypes.STRING(20),
  phone: DataTypes.STRING(20),
  pregnancy_status: { type: DataTypes.TINYINT, defaultValue: 0 },
  insurance_type: { type: DataTypes.STRING(20), defaultValue: '居民医保' },
  created_at: { type: DataTypes.DATE },
}, { tableName: 'patient', timestamps: false })

// 药品目录
const Drug = sequelize.define('Drug', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  category: DataTypes.STRING(50),
  specification: DataTypes.STRING(100),
  max_dose: DataTypes.DECIMAL(10, 2),
  unit: DataTypes.STRING(20),
  created_at: { type: DataTypes.DATE },
}, { tableName: 'drug', timestamps: false })

// 医嘱
const MedicalOrder = sequelize.define('MedicalOrder', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  patient_id: { type: DataTypes.INTEGER, allowNull: false },
  doctor_id: { type: DataTypes.INTEGER, allowNull: false },
  order_type: { type: DataTypes.ENUM('药品', '检查', '治疗'), allowNull: false, defaultValue: '药品' },
  diagnosis: DataTypes.STRING(255),
  content: DataTypes.STRING(500),
  status: { type: DataTypes.ENUM('draft', 'submitted', 'audited', 'rejected'), defaultValue: 'draft' },
  visit_type: { type: DataTypes.STRING(20), defaultValue: '门急诊' },
  hospital_level: { type: DataTypes.STRING(20), defaultValue: '二级' },
  order_no: { type: DataTypes.STRING(32) },
  created_at: { type: DataTypes.DATE },
}, { tableName: 'medical_order', timestamps: false })

// 处方明细
const Prescription = sequelize.define('Prescription', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_id: { type: DataTypes.INTEGER, allowNull: false },
  drug_id: { type: DataTypes.INTEGER, allowNull: false },
  quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  frequency: DataTypes.STRING(50),
  days: { type: DataTypes.INTEGER, defaultValue: 1 },
  single_dose: DataTypes.DECIMAL(10, 2),
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'prescription', timestamps: false })

// 审核规则
const AuditRule = sequelize.define('AuditRule', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  type: { type: DataTypes.STRING(50), allowNull: false },
  expression: { type: DataTypes.JSON, allowNull: false },
  legal_basis: { type: DataTypes.STRING(255) },
  reason_template: { type: DataTypes.STRING(500) },
  suggestion: { type: DataTypes.STRING(500) },
  category: { type: DataTypes.STRING(50) },
  severity: { type: DataTypes.ENUM('warn', 'reject'), defaultValue: 'warn' },
  priority: { type: DataTypes.INTEGER, defaultValue: 10 },
  enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  created_at: { type: DataTypes.DATE },
}, { tableName: 'audit_rule', timestamps: false })

// 审核记录
const AuditRecord = sequelize.define('AuditRecord', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  order_id: { type: DataTypes.INTEGER, allowNull: false },
  rule_id: DataTypes.INTEGER,
  category: DataTypes.STRING(50),
  checked_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM('pass', 'warn', 'reject'), allowNull: false },
  message: DataTypes.STRING(500),
  details: DataTypes.JSON,
  feedback: DataTypes.STRING(500),
  auditor_id: DataTypes.INTEGER,
  audit_no: { type: DataTypes.STRING(32) },
  created_at: { type: DataTypes.DATE },
}, { tableName: 'audit_record', timestamps: false })

// 操作日志
const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  record_id: DataTypes.INTEGER,
  order_id: { type: DataTypes.INTEGER, allowNull: false },
  action: { type: DataTypes.ENUM('submit', 'pass', 'audit', 'feedback', 'reject', 'review'), allowNull: false },
  operator_id: DataTypes.INTEGER,
  content: DataTypes.STRING(500),
  created_at: { type: DataTypes.DATE },
}, { tableName: 'audit_log', timestamps: false })

// 规则知识库（医保政策条文参考，前端可检索查阅，不参与审核引擎）
// knowledge 为不规则结构对象数组（key 为「序号/药品通用名/检出逻辑/逻辑依据…」），用 JSON 列整体存储
const AuditKnowledge = sequelize.define('AuditKnowledge', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  seq: DataTypes.INTEGER,
  category1: DataTypes.STRING(50),
  category2: DataTypes.STRING(100),
  name: { type: DataTypes.STRING(200), allowNull: false },
  hasDetail: { type: DataTypes.BOOLEAN, defaultValue: false },
  knowledge: { type: DataTypes.JSON },
  created_at: { type: DataTypes.DATE },
}, { tableName: 'rule_knowledge', timestamps: false })

// ========== 关联（统一小写 as 别名） ==========
Department.hasMany(User, { foreignKey: 'dept_id', as: 'users' })
User.belongsTo(Department, { foreignKey: 'dept_id', as: 'department' })

User.hasMany(MedicalOrder, { foreignKey: 'doctor_id', as: 'orders' })
MedicalOrder.belongsTo(User, { foreignKey: 'doctor_id', as: 'doctor' })

Patient.hasMany(MedicalOrder, { foreignKey: 'patient_id', as: 'orders' })
MedicalOrder.belongsTo(Patient, { foreignKey: 'patient_id', as: 'patient' })

MedicalOrder.hasMany(Prescription, { foreignKey: 'order_id', as: 'prescriptions' })
Prescription.belongsTo(MedicalOrder, { foreignKey: 'order_id', as: 'order' })

Drug.hasMany(Prescription, { foreignKey: 'drug_id', as: 'prescriptions' })
Prescription.belongsTo(Drug, { foreignKey: 'drug_id', as: 'drug' })

MedicalOrder.hasMany(AuditRecord, { foreignKey: 'order_id', as: 'auditRecords' })
AuditRecord.belongsTo(MedicalOrder, { foreignKey: 'order_id', as: 'order' })

AuditRule.hasMany(AuditRecord, { foreignKey: 'rule_id', as: 'auditRecords' })
AuditRecord.belongsTo(AuditRule, { foreignKey: 'rule_id', as: 'rule' })

AuditRecord.hasMany(AuditLog, { foreignKey: 'record_id', as: 'logs' })
AuditLog.belongsTo(AuditRecord, { foreignKey: 'record_id', as: 'record' })

// 操作人关联（管理员可能不止一人，需留痕）
AuditRecord.belongsTo(User, { foreignKey: 'auditor_id', as: 'auditor' })
AuditLog.belongsTo(User, { foreignKey: 'operator_id', as: 'operator' })
// 日志关联医嘱（用于审核日志页按患者/医生/编号筛选）
AuditLog.belongsTo(MedicalOrder, { foreignKey: 'order_id', as: 'order' })

// 业务编号：新建时自动生成「前缀-年份-5位序号」，仅填充、不改动历史数据
// 注意：save 必须继承外层 create 的 transaction，否则在事务内会出现锁等待/超时
MedicalOrder.addHook('afterCreate', (o, options) => {
  if (!o.order_no) {
    const y = new Date(o.created_at || Date.now()).getFullYear()
    o.order_no = `YZ-${y}-${String(o.id).padStart(5, '0')}`
    return o.save({ fields: ['order_no'], hooks: false, transaction: options && options.transaction })
  }
})
AuditRecord.addHook('afterCreate', (o, options) => {
  if (!o.audit_no) {
    const y = new Date(o.created_at || Date.now()).getFullYear()
    o.audit_no = `SH-${y}-${String(o.id).padStart(5, '0')}`
    return o.save({ fields: ['audit_no'], hooks: false, transaction: options && options.transaction })
  }
})

module.exports = { sequelize, Department, User, Patient, Drug, MedicalOrder, Prescription, AuditRule, AuditRecord, AuditLog, AuditKnowledge }
