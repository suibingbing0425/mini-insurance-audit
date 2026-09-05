// 数据库升级脚本（幂等）：加字段 + 改 type 为 VARCHAR
// 重复跑不会报错（已存在则跳过）
const db = require('./src/config/db')

async function tryAlter(sql, label) {
  try {
    await db.query(sql)
    console.log('OK:', label)
  } catch (e) {
    if (/Duplicate column name|check that column exists/i.test(e.message)) {
      console.log('SKIP (已存在):', label)
    } else {
      throw e
    }
  }
}

async function main() {
  try {
    await tryAlter(`ALTER TABLE audit_rule
      ADD COLUMN code VARCHAR(50) UNIQUE AFTER id,
      ADD COLUMN legal_basis VARCHAR(255) AFTER code,
      ADD COLUMN reason_template VARCHAR(500) AFTER legal_basis,
      ADD COLUMN suggestion VARCHAR(500) AFTER reason_template,
      ADD COLUMN category VARCHAR(50) AFTER suggestion,
      ADD COLUMN priority INT DEFAULT 10 AFTER category`, 'audit_rule 加富字段')

    await tryAlter(`ALTER TABLE audit_rule MODIFY COLUMN type VARCHAR(50) NOT NULL`, 'audit_rule.type 改 VARCHAR')

    await tryAlter(`ALTER TABLE audit_record
      ADD COLUMN category VARCHAR(50) AFTER rule_id,
      ADD COLUMN checked_count INT DEFAULT 0 AFTER category`, 'audit_record 加 category + checked_count')

    // 患者表加：妊娠状态 + 医保类型
    await tryAlter(`ALTER TABLE patient
      ADD COLUMN pregnancy_status TINYINT DEFAULT 0 COMMENT '妊娠状态 0否 1是',
      ADD COLUMN insurance_type VARCHAR(20) DEFAULT '居民医保' COMMENT '医保类型'`, 'patient 加 pregnancy_status + insurance_type')

    // 医嘱表加：就诊类型 + 医疗机构级别
    await tryAlter(`ALTER TABLE medical_order
      ADD COLUMN visit_type VARCHAR(20) DEFAULT '门急诊' COMMENT '就诊类型',
      ADD COLUMN hospital_level VARCHAR(20) DEFAULT '二级' COMMENT '医疗机构级别'`, 'medical_order 加 visit_type + hospital_level')
  } catch (e) {
    console.error('失败:', e.message)
    process.exit(1)
  } finally {
    await db.close()
    process.exit()
  }
}
main()