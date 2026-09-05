const ExcelJS = require('exceljs')

// 从 xlsx buffer 解析出规则库结构，逻辑与 gen-rule-library.py 保持一致。
// 支持两种导入模式（通过 mode 参数控制）：
//  - 'full'（默认）: 完整规则库。规则列表 sheet + 知识点明细 sheet；
//                    知识点 sheet 按「sheet 名包含规则名」匹配。
//  - 'single':      单条规则知识点明细。规则列表 sheet 只有 1 条规则，
//                    其余 sheet 全部视为该规则的知识点明细（解决 sheet 名为 Sheet1/Sheet2 等场景）。
// 返回 [{ seq, category1, category2, name, hasDetail, knowledge: [...] }]
async function parseRuleLibrary(buffer, mode = 'full') {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  // 1) 定位规则列表 sheet：
  //    优先按 sheet 名（含"规则列表" / "规则库"），其次按表头含"规则名称"，最后 fallback 到第一个 sheet。
  const listWs = findRuleListWorksheet(wb.worksheets)
  const rules = parseRuleList(listWs)

  // 2) 剩余 sheet 都是候选知识点明细 sheet
  const detailSheets = wb.worksheets.filter(w => w !== listWs)

  if (mode === 'single') {
    // 单规则模式：只有一条规则且含明细时，其余 sheet 全部挂到这条规则上
    if (rules.length === 1 && rules[0].hasDetail && detailSheets.length) {
      const rule = rules[0]
      for (const ws of detailSheets) {
        rule.knowledge.push(...parseKnowledgeSheet(ws))
      }
    }
  } else {
    // 完整模式：按规则名匹配 sheet
    for (const rule of rules) {
      if (!rule.hasDetail) continue
      const matched = detailSheets.find(ws => rule.name && ws.name.includes(rule.name))
      if (!matched) continue
      rule.knowledge = parseKnowledgeSheet(matched)
    }
  }

  return rules
}

function findRuleListWorksheet(worksheets) {
  // 按 sheet 名找
  const byName = worksheets.find(w => /规则列表|规则库/.test(w.name))
  if (byName) return byName

  // 按表头找：第一行存在"规则名称"单元格
  for (const ws of worksheets) {
    const headerRow = ws.getRow(1)
    let hasNameHeader = false
    headerRow.eachCell({ includeEmpty: true }, cell => {
      if (String(cell.value || '').trim().includes('规则名称')) hasNameHeader = true
    })
    if (hasNameHeader) return ws
  }

  // fallback 第一个 sheet
  return worksheets[0]
}

function parseRuleList(listWs) {
  const rules = []
  listWs.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) return // 跳过表头
    const rawSeq = row.getCell(1).value
    const cat1 = row.getCell(2).value
    const cat2 = row.getCell(3).value
    const name = row.getCell(4).value
    const hasDetail = row.getCell(5).value
    if (name == null || String(name).trim() === '') return
    rules.push({
      seq: rawSeq ? Number(rawSeq) : rules.length + 1,
      category1: cat1 != null ? String(cat1).trim() : '',
      category2: cat2 != null ? String(cat2).trim() : '',
      name: String(name).trim(),
      hasDetail: String(hasDetail).trim() === '是',
      knowledge: []
    })
  })
  return rules
}

function parseKnowledgeSheet(ws) {
  const items = []
  let headers = []
  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        headers[colNumber - 1] = cell.value != null ? String(cell.value).trim() : ''
      })
      return
    }
    const item = {}
    for (let j = 0; j < headers.length; j++) {
      const val = row.getCell(j + 1).value
      if (headers[j]) item[headers[j]] = val != null ? String(val).trim() : ''
    }
    if (Object.values(item).some(v => v !== '' && v != null)) {
      items.push(item)
    }
  })
  return items.slice(0, 500) // 每条规则最多 500 行知识点
}

module.exports = { parseRuleLibrary }
