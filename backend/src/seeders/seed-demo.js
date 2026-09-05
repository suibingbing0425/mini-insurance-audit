// 演示数据脚本：批量创建医嘱并提交审核，产生审核记录供统计报表展示
// 运行：node src/seeders/seed-demo.js
const BASE = 'http://localhost:3000/api'

async function main() {
  // 1. 医生登录
  const drLogin = await (await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'dr_wang', password: '123456' })
  })).json()
  const drToken = drLogin.data.token
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + drToken }

  // 0. 防重复：若已有医嘱数据则跳过整段创建，避免污染手开医嘱
  const existCheck = await (await fetch(BASE + '/orders?pageSize=1', { headers: H })).json()
  if (existCheck.data && existCheck.data.list && existCheck.data.list.length > 0) {
    console.log('⚠️ 检测到已有医嘱数据，跳过演示数据创建（避免重复）。如需重建演示环境，请先 `node src/seeders/seed.js --reset` 再运行本脚本')
    process.exit(0)
  }

  // 2. 获取药品和患者
  const drugs = (await (await fetch(BASE + '/drugs?page=1&pageSize=100', { headers: H })).json()).data.list
  const pats = (await (await fetch(BASE + '/patients?page=1&pageSize=20', { headers: H })).json()).data.list
  const drug = n => drugs.find(d => d.name === n).id

  // 3. 定义 10 条演示医嘱（覆盖各种规则场景）
  const scenarios = [
    { label: '配伍禁忌(阿莫西林+克林霉素)', patient: pats.find(p => p.gender === '男' && p.age > 30), vt: '门急诊', hl: '二级',
      diag: '上呼吸道感染', rx: [{ drug_id: drug('阿莫西林'), single_dose: 500, days: 3 }, { drug_id: drug('克林霉素'), single_dose: 300, days: 3 }] },
    { label: '性别禁忌(男+己烯雌酚)', patient: pats.find(p => p.gender === '男'), vt: '门急诊', hl: '二级',
      diag: '激素补充', rx: [{ drug_id: drug('己烯雌酚'), single_dose: 1, days: 7 }] },
    { label: '年龄禁忌(8岁+左氧氟沙星)', patient: pats.find(p => p.age < 18), vt: '门急诊', hl: '二级',
      diag: '感染', rx: [{ drug_id: drug('左氧氟沙星'), single_dose: 200, days: 5 }] },
    { label: '妊娠禁用(妊娠+甲氨蝶呤)', patient: pats.find(p => p.pregnancy_status === 1), vt: '门急诊', hl: '三级',
      diag: '风湿性关节炎', rx: [{ drug_id: drug('甲氨蝶呤'), single_dose: 5, days: 7 }] },
    { label: '医保限制(居民+阿达木单抗)', patient: pats.find(p => p.insurance_type === '居民医保'), vt: '门急诊', hl: '三级',
      diag: '类风湿', rx: [{ drug_id: drug('阿达木单抗'), single_dose: 40, days: 1 }] },
    { label: '医院级别(一级+紫杉醇)', patient: pats.find(p => p.insurance_type === '居民医保'), vt: '住院', hl: '一级及以下',
      diag: '乳腺癌', rx: [{ drug_id: drug('注射用紫杉醇'), single_dose: 175, days: 1 }] },
    { label: '剂量超限(布洛芬500)', patient: pats.find(p => p.gender === '女' && p.age > 50), vt: '门急诊', hl: '二级',
      diag: '头痛', rx: [{ drug_id: drug('布洛芬'), single_dose: 500, days: 3 }] },
    { label: '重复开药(阿莫西林+头孢氨苄)', patient: pats.find(p => p.gender === '男' && p.age > 30), vt: '门急诊', hl: '二级',
      diag: '感染', rx: [{ drug_id: drug('阿莫西林'), single_dose: 500, days: 3 }, { drug_id: drug('头孢氨苄'), single_dose: 500, days: 3 }] },
    { label: '重复开药(布洛芬+对乙酰氨基酚)', patient: pats.find(p => p.gender === '女' && p.age > 50), vt: '门急诊', hl: '二级',
      diag: '发热', rx: [{ drug_id: drug('布洛芬'), single_dose: 200, days: 3 }, { drug_id: drug('对乙酰氨基酚'), single_dose: 500, days: 3 }] },
    { label: '正常通过(布洛芬200)', patient: pats.find(p => p.gender === '男' && p.age > 30), vt: '门急诊', hl: '二级',
      diag: '头痛', rx: [{ drug_id: drug('布洛芬'), single_dose: 200, days: 3 }] },
  ]

  let created = 0, rejected = 0, warned = 0, passed = 0
  for (const s of scenarios) {
    if (!s.patient) { console.log('跳过(无匹配患者):', s.label); continue }
    // 创建医嘱
    const order = await (await fetch(BASE + '/orders', {
      method: 'POST', headers: H,
      body: JSON.stringify({ patient_id: s.patient.id, diagnosis: s.diag, content: s.label, visit_type: s.vt, hospital_level: s.hl, prescriptions: s.rx })
    })).json()
    if (order.code !== 0) { console.log('创建失败:', s.label, order.message); continue }
    // 提交审核
    const submit = await (await fetch(BASE + '/orders/' + order.data.id + '/submit', { method: 'POST', headers: H })).json()
    if (submit.code !== 0) { console.log('提交失败:', s.label, submit.message); continue }
    created++
    if (submit.data.status === 'rejected') rejected++
    else if (submit.data.violations.length > 0) warned++
    else passed++
    console.log(`${s.label} → ${submit.data.status} (${submit.data.violations.length}条违规)`)
  }

  // 4. 管理员给部分记录加反馈
  const auLogin = await (await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin_zheng', password: '123456' })
  })).json()
  const auH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auLogin.data.token }
  const audits = (await (await fetch(BASE + '/audits?pageSize=50', { headers: auH })).json()).data.list
  let feedbackCount = 0
  for (const rec of audits.filter(r => r.status !== 'pass').slice(0, 5)) {
    await fetch(BASE + '/audits/' + rec.id + '/feedback', {
      method: 'POST', headers: auH,
      body: JSON.stringify({ feedback: '已复核确认，退回医生修改' })
    })
    feedbackCount++
  }

  console.log(`\n演示数据完成：创建 ${created} 条医嘱（reject ${rejected} / warn ${warned} / pass ${passed}），审核反馈 ${feedbackCount} 条`)
  console.log('现在统计报表有数据了，去 admin_zheng 登录看统计报表')
  process.exit()
}
main().catch(e => { console.error('脚本异常:', e.message); process.exit(1) })