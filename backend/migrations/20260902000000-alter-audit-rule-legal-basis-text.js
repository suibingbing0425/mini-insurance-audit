// 将 audit_rule.legal_basis 由 VARCHAR(255) 改为 TEXT，
// 以容纳完整法律依据（如药品相互作用的禁忌药品清单）。幂等：若已是 TEXT 则跳过。
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('audit_rule')
    if (cols.legal_basis && /text/i.test(cols.legal_basis.type)) return
    await queryInterface.changeColumn('audit_rule', 'legal_basis', {
      type: Sequelize.TEXT,
      allowNull: true
    })
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('audit_rule', 'legal_basis', {
      type: Sequelize.STRING(255),
      allowNull: true
    })
  }
}
