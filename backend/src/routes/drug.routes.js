const router = require('express').Router()
const { Op } = require('sequelize')
const { Drug } = require('../models')
const auth = require('../middlewares/auth')

// GET /api/drugs  药品分页搜索（开方时下拉选择用）
router.get('/', auth, async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const pageSize = parseInt(req.query.pageSize) || 20
  const keyword = req.query.keyword || ''
  const where = {}
  if (keyword) {
    where[Op.or] = [
      { name: { [Op.like]: `%${keyword}%` } },
      { code: { [Op.like]: `%${keyword}%` } }
    ]
  }
  const { rows, count } = await Drug.findAndCountAll({
    where,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order: [['id', 'ASC']]
  })
  res.json({ code: 0, data: { list: rows, total: count }, message: 'ok' })
})

module.exports = router
