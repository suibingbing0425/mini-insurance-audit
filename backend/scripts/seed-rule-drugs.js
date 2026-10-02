// 从可执行规则（EXE）中自动抽取 ~40 个非注射剂药品入库，作为可触发的演示药房。
// 逻辑：单药型规则(age_drug/course_limit 等) 与 聚合型规则(preg/insurance/gender) 的药品全名池
//       → 排除已存在 Drug / 注射剂类 / 超长名 → findOrCreate 入库。
// 用法：node scripts/seed-rule-drugs.js   （幂等，可重复跑；--reset 后请重跑一次）
const { sequelize, Drug, AuditRule } = require('../src/models')
const { Op } = require('sequelize')

// 注射/吸入/滴眼等不便手动开方的剂型剔除，保证演示为可口服/外用常规药
const BAD = /注射|输液|输注|滴眼|滴鼻|滴耳|喷雾|气雾|吸入|喷鼻|滴剂|眼膏|凝胶剂|缓释微粒/
const TOO_LONG = 13

;(async () => {
  const existing = new Set((await Drug.findAll({ attributes: ['name'], raw: true })).map(d => d.name))
  const rules = await AuditRule.findAll({ where: { code: { [Op.like]: 'EXE%' }, enabled: true }, raw: true })

  const singlePool = [] // expression.drug（单药型：age/course 等，开即触发）
  const groupPool = []  // expression.drugs（聚合型：preg/ins/gender 等，命中其清单即触发）
  for (const r of rules) {
    const e = typeof r.expression === 'string' ? JSON.parse(r.expression) : r.expression
    if (!e) continue
    if (e.drug) singlePool.push(e.drug)
    else if (Array.isArray(e.drugs) && !/EXE-(TCM|DUP)/.test(r.code)) groupPool.push(...e.drugs)
  }

  const want = []
  const pick = (pool, n) => {
    for (const name of pool) {
      if (want.length >= n) return
      if (existing.has(name) || want.includes(name)) continue
      if (name.length > TOO_LONG || BAD.test(name)) continue
      existing.add(name)
      want.push(name)
    }
  }
  pick(singlePool, 34) // 儿童禁用/限儿童/限支付疗程/最大开药天数等
  pick(groupPool, 8)   // 妊娠/医保/性别 聚合清单里的常规药

  let created = 0
  for (let i = 0; i < want.length; i++) {
    const name = want[i]
    const code = 'YB' + String(300 + i)
    const [d, isNew] = await Drug.findOrCreate({
      where: { name },
      defaults: { code, category: '医保规则药', specification: '常规规格', max_dose: 100, unit: 'mg' }
    })
    if (isNew) created++
  }
  console.log('本次新增演示药:', created, '条 | 药房现有总药数:', (await Drug.count()))

  // 验证：新加的药都能命中规则（便于排查手误）
  const now = await Drug.findAll({ where: { name: { [Op.in]: want } }, raw: true })
  const nameSet = new Set(now.map(d => d.name))
  const hitMap = {}
  for (const r of rules) {
    const e = typeof r.expression === 'string' ? JSON.parse(r.expression) : r.expression
    if (!e) continue
    if (e.drug && nameSet.has(e.drug)) (hitMap[e.drug] = hitMap[e.drug] || []).push(r.code)
    if (Array.isArray(e.drugs)) for (const d of e.drugs) if (nameSet.has(d)) (hitMap[d] = hitMap[d] || []).push(r.code)
  }
  const noHit = now.filter(d => !hitMap[d.name])
  console.log('抽样(前12个药 -> 命中规则):')
  now.slice(0, 12).forEach(d => console.log(' ', d.name, '->', (hitMap[d.name] || ['无']).slice(0, 2).join(', ')))
  console.log('未命中任何规则的新药:', noHit.length ? noHit.map(d => d.name).join('、') : '无（全部可触发）')
  await sequelize.close()
})()
