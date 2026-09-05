// 全接口自测脚本：运行 node test-api.js（需先启动 npm run dev）
const BASE = 'http://localhost:3000/api'
let pass = 0, fail = 0

async function req(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  })
  return { status: res.status, data: await res.json() }
}

function check(name, ok, extra = '') {
  if (ok) { pass++; console.log('PASS', name) }
  else { fail++; console.log('FAIL', name, extra) }
}

async function main() {
  // 1. 三种角色登录
  const dr = (await req('POST', '/auth/login', { username: 'dr_wang', password: '123456' })).data
  const au = (await req('POST', '/auth/login', { username: 'auditor_li', password: '123456' })).data
  const ad = (await req('POST', '/auth/login', { username: 'admin_zheng', password: '123456' })).data
  check('医生登录', dr.code === 0, JSON.stringify(dr))
  check('审核员登录', au.code === 0)
  check('管理员登录', ad.code === 0)
  const drT = dr.data.token, auT = au.data.token, adT = ad.data.token

  // 2. 科室
  const deps = await req('GET', '/departments', null, drT)
  check('科室列表=3', deps.data.code === 0 && deps.data.data.length === 3)

  // 3. 患者 CRUD
  const p1 = await req('POST', '/patients', { name: '张三', gender: '男', age: 45 }, drT)
  check('新增患者', p1.data.code === 0, JSON.stringify(p1.data))
  const pid = p1.data.data.id
  const plist = await req('GET', '/patients?page=1&pageSize=5&keyword=张', null, drT)
  check('患者分页搜索', plist.data.code === 0 && plist.data.data.total >= 1)
  const pup = await req('PUT', '/patients/' + pid, { age: 46 }, drT)
  check('修改患者', pup.data.code === 0)
  const pdel1 = await req('DELETE', '/patients/' + pid, null, drT)
  check('医生删除患者被拒403', pdel1.status === 403)
  const pdel2 = await req('DELETE', '/patients/' + pid, null, adT)
  check('管理员删除患者', pdel2.data.code === 0)

  // 4. 药品搜索
  const drugs = []
  for (const kw of ['布洛芬', '阿莫西林', '克林霉素']) {
    const r = await req('GET', '/drugs?keyword=' + encodeURIComponent(kw), null, drT)
    drugs.push(...r.data.data.list)
  }
  check('药品搜索>=3', drugs.length >= 3)

  // 5. 准备患者给医嘱
  const p2 = await req('POST', '/patients', { name: '李四', gender: '女', age: 30 }, drT)
  const pid2 = p2.data.data.id

  const drugAmox = drugs.find(d => d.name === '阿莫西林')
  const drugClind = drugs.find(d => d.name === '克林霉素')
  const drugIbu = drugs.find(d => d.name === '布洛芬')

  // 6. 医嘱1：阿莫西林+克林霉素 → 配伍禁忌 reject
  const o1 = await req('POST', '/orders', {
    patient_id: pid2, diagnosis: '上呼吸道感染', content: '发热伴咳嗽',
    prescriptions: [
      { drug_id: drugAmox.id, quantity: 2, frequency: '每日3次', days: 3, single_dose: 500 },
      { drug_id: drugClind.id, quantity: 2, frequency: '每日3次', days: 3, single_dose: 300 }
    ]
  }, drT)
  check('创建医嘱(冲突)', o1.data.code === 0, JSON.stringify(o1.data))
  const oid1 = o1.data.data.id
  const sub1 = await req('POST', '/orders/' + oid1 + '/submit', null, drT)
  check('提交命中配伍禁忌→rejected', sub1.data.code === 0 && sub1.data.data.status === 'rejected' && sub1.data.data.violations.length >= 1, JSON.stringify(sub1.data))

  // 7. 医嘱2：布洛芬正常剂量 → 通过
  const o2 = await req('POST', '/orders', {
    patient_id: pid2, diagnosis: '头痛',
    prescriptions: [{ drug_id: drugIbu.id, quantity: 1, frequency: '每日2次', days: 2, single_dose: 200 }]
  }, drT)
  const oid2 = o2.data.data.id
  const sub2 = await req('POST', '/orders/' + oid2 + '/submit', null, drT)
  check('正常医嘱→audited无违规', sub2.data.code === 0 && sub2.data.data.status === 'audited' && sub2.data.data.violations.length === 0, JSON.stringify(sub2.data))

  // 8. 医嘱3：布洛芬500mg > 400上限 → warn
  const o3 = await req('POST', '/orders', {
    patient_id: pid2, diagnosis: '重度头痛',
    prescriptions: [{ drug_id: drugIbu.id, quantity: 1, frequency: '每日1次', days: 1, single_dose: 500 }]
  }, drT)
  const oid3 = o3.data.data.id
  const sub3 = await req('POST', '/orders/' + oid3 + '/submit', null, drT)
  check('剂量超标→命中warn', sub3.data.code === 0 && sub3.data.data.violations.length >= 1, JSON.stringify(sub3.data))

  // 9. 医嘱详情（含处方）
  const od = await req('GET', '/orders/' + oid1, null, drT)
  check('医嘱详情含2条处方', od.data.code === 0 && od.data.data.prescriptions.length === 2)
  const ol = await req('GET', '/orders?status=rejected', null, drT)
  check('医嘱列表按状态筛选', ol.data.code === 0 && ol.data.data.total >= 1)

  // 10. 规则 CRUD（管理员）
  const r1 = await req('POST', '/rules', { name: '测试冲突规则', type: 'drug_conflict', expression: { drugs: ['阿司匹林', '布洛芬'] }, severity: 'reject' }, adT)
  check('新增规则', r1.data.code === 0, JSON.stringify(r1.data))
  const rid = r1.data.data.id
  const rt = await req('PUT', '/rules/' + rid + '/toggle', null, adT)
  check('规则启停切换', rt.data.code === 0 && rt.data.data.enabled === false)
  const rbad = await req('POST', '/rules', { name: '非法JSON', type: 'dose', expression: '{bad json' }, adT)
  check('非法JSON被拦截', rbad.data.code === 400)
  const rd = await req('DELETE', '/rules/' + rid, null, adT)
  check('删除规则', rd.data.code === 0)
  const rf = await req('GET', '/rules', null, adT)
  check('规则列表=3(管理员)', rf.data.code === 0 && rf.data.data.length === 3)
  const rf2 = await req('GET', '/rules', null, drT)
  check('医生访问规则403', rf2.status === 403)

  // 11. 审核反馈 + 日志流水（审核员）
  const al = await req('GET', '/audits?status=reject', null, auT)
  check('审核记录列表', al.data.code === 0 && al.data.data.total >= 1)
  const rec = al.data.data.list.find(r => r.status === 'reject')
  const fb = await req('POST', '/audits/' + rec.id + '/feedback', { feedback: '确认配伍禁忌，退回医生修改' }, auT)
  check('填写反馈', fb.data.code === 0, JSON.stringify(fb.data))
  const logs = await req('GET', '/audits/' + rec.order_id + '/logs', null, auT)
  check('日志流水完整', logs.data.code === 0 && logs.data.data.length >= 1, JSON.stringify(logs.data))

  // 12. 统计（管理员）
  const st1 = await req('GET', '/stats/violations', null, adT)
  check('违规统计接口', st1.data.code === 0, JSON.stringify(st1.data))
  const st2 = await req('GET', '/stats/rule-distribution', null, adT)
  check('规则分布接口', st2.data.code === 0)

  // 13. 权限与鉴权
  const noToken = await req('GET', '/patients', null, null)
  check('无token访问401', noToken.status === 401)

  console.log('')
  console.log('结果: ' + pass + ' PASS / ' + fail + ' FAIL')
  process.exit(fail > 0 ? 1 : 0)
}
main().catch(e => { console.error('脚本异常:', e.message); process.exit(1) })
