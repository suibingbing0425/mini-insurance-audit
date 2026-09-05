const router = require('express').Router()
const { Department } = require('../models')
const auth = require('../middlewares/auth')

// GET /api/departments  科室列表（登录即可，供开医嘱/统计下拉用）
router.get('/', auth, async (req, res) => {
  const list = await Department.findAll({ order: [['id', 'ASC']] })
  res.json({ code: 0, data: list, message: 'ok' })
})

module.exports = router
