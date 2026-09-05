'use strict'

// 初始迁移：一次性创建全部 10 张业务表，结构与 src/models/index.js 中的 define 完全对应。
// 关键设计：带「幂等保护」——先用 showAllTables 检查，已存在的表跳过 createTable。
// 这样无论是空库首次 migrate，还是之前用 sequelize.sync() 建过表的旧库，都能安全重复执行，
// 不会因「表已存在」而报错（后续若要改表结构，新增 incremental 迁移即可，不要改本文件）。
module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = await queryInterface.showAllTables()
    const has = (t) => existing.includes(t)

    if (!has('department')) {
      await queryInterface.createTable('department', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: Sequelize.STRING(50), allowNull: false },
        code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        created_at: { type: Sequelize.DATE, allowNull: true }
      })
    }

    if (!has('user')) {
      await queryInterface.createTable('user', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        username: { type: Sequelize.STRING(50), allowNull: false, unique: true },
        password: { type: Sequelize.STRING(100), allowNull: false },
        name: { type: Sequelize.STRING(50), allowNull: false },
        role: { type: Sequelize.ENUM('doctor', 'admin'), allowNull: false, defaultValue: 'doctor' },
        dept_id: { type: Sequelize.INTEGER, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: true }
      })
    }

    if (!has('patient')) {
      await queryInterface.createTable('patient', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: Sequelize.STRING(50), allowNull: false },
        gender: { type: Sequelize.ENUM('男', '女'), allowNull: false },
        age: { type: Sequelize.INTEGER, allowNull: true },
        id_card: { type: Sequelize.STRING(20), allowNull: true },
        phone: { type: Sequelize.STRING(20), allowNull: true },
        pregnancy_status: { type: Sequelize.TINYINT, defaultValue: 0 },
        insurance_type: { type: Sequelize.STRING(20), defaultValue: '居民医保' },
        created_at: { type: Sequelize.DATE, allowNull: true }
      })
    }

    if (!has('drug')) {
      await queryInterface.createTable('drug', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: Sequelize.STRING(100), allowNull: false },
        code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
        category: { type: Sequelize.STRING(50), allowNull: true },
        specification: { type: Sequelize.STRING(100), allowNull: true },
        max_dose: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        unit: { type: Sequelize.STRING(20), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: true }
      })
    }

    if (!has('medical_order')) {
      await queryInterface.createTable('medical_order', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        patient_id: { type: Sequelize.INTEGER, allowNull: false },
        doctor_id: { type: Sequelize.INTEGER, allowNull: false },
        order_type: { type: Sequelize.ENUM('药品', '检查', '治疗'), defaultValue: '药品' },
        diagnosis: { type: Sequelize.STRING(255), allowNull: true },
        content: { type: Sequelize.STRING(500), allowNull: true },
        status: { type: Sequelize.ENUM('draft', 'submitted', 'audited', 'rejected'), defaultValue: 'draft' },
        visit_type: { type: Sequelize.STRING(20), defaultValue: '门急诊' },
        hospital_level: { type: Sequelize.STRING(20), defaultValue: '二级' },
        order_no: { type: Sequelize.STRING(32), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: true }
      })
    }

    if (!has('prescription')) {
      await queryInterface.createTable('prescription', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        order_id: { type: Sequelize.INTEGER, allowNull: false },
        drug_id: { type: Sequelize.INTEGER, allowNull: false },
        quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        frequency: { type: Sequelize.STRING(50), allowNull: true },
        days: { type: Sequelize.INTEGER, defaultValue: 1 },
        single_dose: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW }
      })
    }

    if (!has('audit_rule')) {
      await queryInterface.createTable('audit_rule', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        code: { type: Sequelize.STRING(50), allowNull: false, unique: true },
        name: { type: Sequelize.STRING(100), allowNull: false },
        type: { type: Sequelize.STRING(50), allowNull: false },
        expression: { type: Sequelize.JSON, allowNull: false },
        legal_basis: { type: Sequelize.STRING(255), allowNull: true },
        reason_template: { type: Sequelize.STRING(500), allowNull: true },
        suggestion: { type: Sequelize.STRING(500), allowNull: true },
        category: { type: Sequelize.STRING(50), allowNull: true },
        severity: { type: Sequelize.ENUM('warn', 'reject'), defaultValue: 'warn' },
        priority: { type: Sequelize.INTEGER, defaultValue: 10 },
        enabled: { type: Sequelize.BOOLEAN, defaultValue: true },
        created_at: { type: Sequelize.DATE, allowNull: true }
      })
    }

    if (!has('audit_record')) {
      await queryInterface.createTable('audit_record', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        order_id: { type: Sequelize.INTEGER, allowNull: false },
        rule_id: { type: Sequelize.INTEGER, allowNull: true },
        category: { type: Sequelize.STRING(50), allowNull: true },
        checked_count: { type: Sequelize.INTEGER, defaultValue: 0 },
        status: { type: Sequelize.ENUM('pass', 'warn', 'reject'), allowNull: false },
        message: { type: Sequelize.STRING(500), allowNull: true },
        details: { type: Sequelize.JSON, allowNull: true },
        feedback: { type: Sequelize.STRING(500), allowNull: true },
        auditor_id: { type: Sequelize.INTEGER, allowNull: true },
        audit_no: { type: Sequelize.STRING(32), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: true }
      })
    }

    if (!has('audit_log')) {
      await queryInterface.createTable('audit_log', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        record_id: { type: Sequelize.INTEGER, allowNull: true },
        order_id: { type: Sequelize.INTEGER, allowNull: false },
        action: { type: Sequelize.ENUM('submit', 'pass', 'audit', 'feedback', 'reject', 'review'), allowNull: false },
        operator_id: { type: Sequelize.INTEGER, allowNull: true },
        content: { type: Sequelize.STRING(500), allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: true }
      })
    }

    if (!has('rule_knowledge')) {
      await queryInterface.createTable('rule_knowledge', {
        id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        seq: { type: Sequelize.INTEGER, allowNull: true },
        category1: { type: Sequelize.STRING(50), allowNull: true },
        category2: { type: Sequelize.STRING(100), allowNull: true },
        name: { type: Sequelize.STRING(200), allowNull: false },
        hasDetail: { type: Sequelize.BOOLEAN, defaultValue: false },
        knowledge: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: true }
      })
    }
  },

  async down(queryInterface, Sequelize) {
    // 逆序删除（与关联/依赖方向相反），便于回滚
    await queryInterface.dropTable('rule_knowledge')
    await queryInterface.dropTable('audit_log')
    await queryInterface.dropTable('audit_record')
    await queryInterface.dropTable('audit_rule')
    await queryInterface.dropTable('prescription')
    await queryInterface.dropTable('medical_order')
    await queryInterface.dropTable('drug')
    await queryInterface.dropTable('patient')
    await queryInterface.dropTable('user')
    await queryInterface.dropTable('department')
  }
}
