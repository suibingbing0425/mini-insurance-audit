<template>
  <div>
    <el-tabs v-model="activeTab">
      <!-- ========== Tab 1: 规则库（88 条国家规则 + 知识点明细） ========== -->
      <el-tab-pane label="规则库（88 条国家规则）" name="library">
        <div class="toolbar">
          <el-input v-model="libSearch.keyword" placeholder="搜索规则名称" clearable style="width: 220px" @keyup.enter="loadLibrary" @clear="loadLibrary" />
          <el-select v-model="libSearch.category1" placeholder="一级分类" clearable style="width: 140px" @change="loadLibrary">
            <el-option v-for="c in categories.category1" :key="c" :label="c" :value="c" />
          </el-select>
          <el-select v-model="libSearch.category2" placeholder="二级分类" clearable style="width: 180px" @change="loadLibrary">
            <el-option v-for="c in categories.category2" :key="c" :label="c" :value="c" />
          </el-select>
          <el-button type="primary" @click="loadLibrary">搜索</el-button>
          <el-button circle @click="resetLibFilters"><el-icon><Refresh /></el-icon></el-button>
          <el-tag type="info" style="margin-left: auto">共 {{ libTotal }} 条</el-tag>
        </div>

        <el-table :data="libPaged" border stripe v-loading="libLoading" style="margin-top: 12px">
          <el-table-column prop="seq" label="序号" width="70" />
          <el-table-column prop="category1" label="一级分类" width="100">
            <template #default="{ row }">
              <el-tag :type="cat1Color(row.category1)" size="small">{{ row.category1 }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="category2" label="二级分类" width="180" />
          <el-table-column prop="name" label="规则名称" />
          <el-table-column label="知识点" width="90" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.hasDetail" type="success" size="small">{{ row.knowledgeCount }} 条</el-tag>
              <span v-else style="color: #c0c4cc">无</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="110">
            <template #default="{ row }">
              <el-button v-if="row.hasDetail && row.knowledgeCount > 0" link type="primary" @click="showKnowledge(row)">查看明细</el-button>
              <span v-else style="color: #c0c4cc; font-size: 12px">无明细</span>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          style="margin-top: 16px; justify-content: flex-end"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 20, 50, 100]"
          :total="libList.length"
          v-model:page-size="libPageSize"
          v-model:current-page="libPage"
          @size-change="libPage = 1"
        />
      </el-tab-pane>

      <!-- ========== Tab 2: 可执行规则（审核引擎实际跑的规则） ========== -->
      <el-tab-pane label="可执行规则（审核引擎）" name="executable">
        <!-- <div class="tab-intro">
          <el-alert type="info" :closable="false" show-icon
            title="以下为审核引擎实际执行的可执行规则（来自《2025版医保监管规则库》自动抽取），按真实业务维度展示。点「编辑」可调整参数，点启用开关可临时停用某条规则。" />
        </div> -->
        <div class="toolbar">
          <el-input v-model="execSearch.keyword" placeholder="搜索规则名称 / 编码" clearable style="width: 220px" @keyup.enter="load" @clear="load" />
          <el-select v-model="execSearch.type" placeholder="校验维度" clearable style="width: 160px" @change="load">
            <el-option v-for="t in execTypeOptions" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
          <el-select v-model="execSearch.severity" placeholder="级别" clearable style="width: 110px" @change="load">
            <el-option label="拒绝" value="reject" />
            <el-option label="提醒" value="warn" />
          </el-select>
          <el-button circle @click="load"><el-icon><Refresh /></el-icon></el-button>
          <el-button type="success" @click="openDialog()">新增规则</el-button>
          <el-tag type="info" style="margin-left: auto">共 {{ list.length }} 条</el-tag>
        </div>
        <el-table :data="execPaged" border stripe v-loading="loading">
          <el-table-column prop="id" label="编号" width="60" />
          <el-table-column prop="category" label="源规则分类" width="130" show-overflow-tooltip />
          <el-table-column prop="code" label="规则编码" width="130" show-overflow-tooltip />
          <el-table-column label="规则名称" min-width="170" show-overflow-tooltip>
            <template #default="{ row }">{{ officialName(row) }}</template>
          </el-table-column>
          <el-table-column label="知识点" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ cleanName(row) }}</template>
          </el-table-column>
          <el-table-column label="校验维度" width="125">
            <template #default="{ row }">
              <el-tag type="primary" size="small">{{ typeText(row.type) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="覆盖范围" width="125" align="center">
            <template #default="{ row }">{{ scopeText(row) }}</template>
          </el-table-column>
          <el-table-column label="触发条件" min-width="220" show-overflow-tooltip>
            <template #default="{ row }">{{ conditionText(row) }}</template>
          </el-table-column>
          <el-table-column label="级别" width="70" align="center">
            <template #default="{ row }">
              <el-tag :type="row.severity === 'reject' ? 'danger' : 'warning'" size="small">
                {{ row.severity === 'reject' ? '拒绝' : '提醒' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="启用" width="70" align="center">
            <template #default="{ row }">
              <el-switch :model-value="!!row.enabled" @change="onToggle(row)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="110" align="center">
            <template #default="{ row }">
              <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
              <el-button link type="danger" @click="onDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          style="margin-top: 16px; justify-content: flex-end"
          layout="total, sizes, prev, pager, next, jumper"
          :page-sizes="[10, 20, 50, 100]"
          :total="execFiltered.length"
          v-model:page-size="execPageSize"
          v-model:current-page="execPage"
          @size-change="execPage = 1"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- 知识点明细抽屉 -->
    <el-drawer v-model="drawerVisible" :title="`知识点明细 - ${currentRule?.name}`" size="60%" direction="rtl">
      <div v-if="currentRule" style="padding: 0 20px">
        <el-descriptions :column="2" border size="small" style="margin-bottom: 16px">
          <el-descriptions-item label="序号">{{ currentRule.seq }}</el-descriptions-item>
          <el-descriptions-item label="一级分类">{{ currentRule.category1 }}</el-descriptions-item>
          <el-descriptions-item label="二级分类">{{ currentRule.category2 }}</el-descriptions-item>
          <el-descriptions-item label="知识点数">{{ currentRule.knowledge?.length }} 条</el-descriptions-item>
        </el-descriptions>
        <el-input v-model="knowledgeSearch" placeholder="在知识点中搜索" clearable style="margin-bottom: 12px" />
        <el-table :data="filteredKnowledge" border size="small" max-height="500" style="width: 100%">
          <el-table-column
            v-for="col in knowledgeColumns"
            :key="col"
            :prop="col"
            :label="col"
            min-width="120"
            show-overflow-tooltip
          />
        </el-table>
      </div>
    </el-drawer>

    <!-- 可执行规则的新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑规则' : '新增规则'" width="560px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="编码"><el-input v-model="form.code" placeholder="如 GJ2025-074" /></el-form-item>
        <el-form-item label="规则名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type" style="width: 100%">
            <el-option v-for="t in execTypeOptions" :key="t.value" :label="t.label + ' (' + t.value + ')'" :value="t.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类"><el-input v-model="form.category" placeholder="如 药品合理使用类" /></el-form-item>
        <el-form-item label="级别">
          <el-radio-group v-model="form.severity">
            <el-radio value="warn">提醒 warn</el-radio>
            <el-radio value="reject">拒绝 reject</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="表达式">
          <el-input v-model="form.expression" type="textarea" :rows="4" placeholder='JSON 格式，如 {"drugs":["阿莫西林","克林霉素"]}' />
        </el-form-item>
        <el-form-item label="法规依据"><el-input v-model="form.legal_basis" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="处理建议"><el-input v-model="form.suggestion" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ruleApi, libraryApi } from '../api'

const activeTab = ref('library')

// ===== 规则库 =====
const libList = ref([])
const libTotal = ref(0)
const libPage = ref(1)
const libPageSize = ref(10)
const libPaged = computed(() =>
  libList.value.slice((libPage.value - 1) * libPageSize.value, libPage.value * libPageSize.value)
)
const libLoading = ref(false)
const categories = ref({ category1: [], category2: [] })
const libSearch = reactive({ keyword: '', category1: '', category2: '' })

function resetLibFilters() {
  libSearch.keyword = ''
  libSearch.category1 = ''
  libSearch.category2 = ''
  loadLibrary()
}

const drawerVisible = ref(false)
const currentRule = ref(null)
const knowledgeSearch = ref('')

const cat1ColorMap = { '政策类': 'warning', '管理类': 'info', '医疗类': 'success' }
const cat1Color = (c) => cat1ColorMap[c] || ''

const knowledgeColumns = computed(() => {
  if (!currentRule.value?.knowledge?.length) return []
  return Object.keys(currentRule.value.knowledge[0])
})
const filteredKnowledge = computed(() => {
  if (!currentRule.value?.knowledge) return []
  if (!knowledgeSearch.value) return currentRule.value.knowledge
  return currentRule.value.knowledge.filter(item =>
    Object.values(item).some(v => v.includes(knowledgeSearch.value))
  )
})

async function loadLibrary() {
  libLoading.value = true
  try {
    const data = await libraryApi.list(libSearch)
    libList.value = data
    libTotal.value = data.length
    libPage.value = 1
  } finally {
    libLoading.value = false
  }
}
async function loadCategories() {
  const data = await libraryApi.categories()
  categories.value = data
}
async function showKnowledge(row) {
  const data = await libraryApi.detail(row.seq)
  currentRule.value = data
  knowledgeSearch.value = ''
  drawerVisible.value = true
}

// ===== 可执行规则 CRUD =====
const list = ref([])
const loading = ref(false)
const execPage = ref(1)
const execPageSize = ref(10)

// 校验维度中文化（按真实业务视角，10 种 type 全覆盖）
const typeMap = {
  drug_conflict: '配伍禁忌',
  pregnancy_drug: '妊娠期用药',
  insurance_limit: '医保类型限制',
  hospital_level_limit: '医疗机构级别',
  gender_drug: '性别用药禁忌',
  age_drug: '年龄用药禁忌',
  course_limit: '用药疗程超限',
  duplicate_drug: '同类重复开药',
  frequency: '近期重复用药',
  dose: '单次剂量超标'
}
const typeText = t => typeMap[t] || t
const execTypeOptions = Object.entries(typeMap).map(([value, label]) => ({ value, label }))

// 覆盖范围：从 expression 中解析出影响药品/项目数量
const scopeText = (r) => {
  const e = r.expression || {}
  if (Array.isArray(e.drugs) && e.drugs.length) return `覆盖 ${e.drugs.length} 个药品`
  if (e.drug) return '单药品'
  if (e.category) return '同分类多药'
  return '—'
}

// 净化名称：规则类型已由「校验维度」「触发条件」两列承担，
// 这一列只展示对象（药名 / 分类 / 聚合药品数），不再混在一起
const cleanName = (r) => {
  const e = r.expression || {}
  if (e.drug) return e.drug
  if (e.category) return `${e.category}（分类聚合）`
  if (Array.isArray(e.drugs) && e.drugs.length) {
    const head = e.drugs.slice(0, 2).join('、')
    return e.drugs.length > 2 ? `${head} 等 ${e.drugs.length} 个药品` : head
  }
  return r.name || '—'
}

// 规则名称 = 官方源规则名（按 code 前缀映射回 88 条源表的规则），与「知识点(药名)」列分离
const officialName = (r) => {
  const c = r.code || ''
  if (c.startsWith('EXE-AGE66')) return '药品儿童禁用'
  if (c.startsWith('EXE-AGE7')) return '药品限儿童使用'
  if (c.startsWith('EXE-COURSE10')) return '药品限支付疗程'
  if (c.startsWith('EXE-COURSE68')) return '超说明书用量开药'
  if (c.startsWith('EXE-DUP69')) return '重复开药'
  if (c.startsWith('EXE-TCM75')) return '中药饮片配伍禁忌'
  if (c.startsWith('EXE-PREG')) return '妊娠期及哺乳期用药安全'
  if (c.startsWith('EXE-INS-001')) return '药品限工伤保险'
  if (c.startsWith('EXE-INS-002')) return '药品限生育保险'
  if (c.startsWith('EXE-HOSP')) return '药品限医疗机构级别'
  if (c.startsWith('EXE-GENDER-M')) return '药品区分性别使用（限男）'
  if (c.startsWith('EXE-GENDER-F')) return '药品区分性别使用（限女）'
  return r.name || '—'
}

// 触发条件：按 type 模板化，把 expression 翻译成业务人员能读懂的话
const conditionText = (r) => {
  const e = r.expression || {}
  switch (r.type) {
    case 'pregnancy_drug':
      return Array.isArray(e.drugs) ? `妊娠期患者禁用（涵盖 ${e.drugs.length} 种药）` : '妊娠期禁用'
    case 'insurance_limit':
      return `仅限 ${(e.allowedInsurance || []).join(' / ')} 支付`
    case 'hospital_level_limit':
      return `${e.minLevel || '二级'} 及以上医院使用`
    case 'gender_drug':
      return (e.allowedGender === '女' ? '仅限女性使用' : '仅限男性使用') +
        (Array.isArray(e.drugs) ? `（覆盖 ${e.drugs.length} 药）` : '')
    case 'age_drug':
      if (e.minAge != null) return `${e.minAge} 岁及以上方可使用（不足年龄禁用）`
      if (e.maxAge != null) return `限 ${e.maxAge} 岁及以下使用（超龄风险）`
      return '—'
    case 'course_limit':
      return `单次处方疗程 ≤ ${e.maxDays} 天`
    case 'duplicate_drug':
      return `同一次处方开具 ≥ 2 种「${e.category}」类药品`
    case 'drug_conflict':
      return Array.isArray(e.drugs) && e.drugs.length >= 2
        ? `同方禁用：${e.drugs[0]} + ${e.drugs[1]}`
        : '同方禁用'
    case 'frequency':
      return `${e.days || 7} 天内重复开药`
    case 'dose':
      return `单次剂量 > ${e.maxDose}${e.unit || ''}`
    default:
      return '—'
  }
}

// 搜索/筛选（按校验维度 + 级别 + 关键词）
const execSearch = reactive({ keyword: '', type: '', severity: '' })
const execFiltered = computed(() => list.value.filter(r => {
  if (execSearch.type && r.type !== execSearch.type) return false
  if (execSearch.severity && r.severity !== execSearch.severity) return false
  if (execSearch.keyword) {
    const k = execSearch.keyword.toLowerCase()
    if (!(r.name || '').toLowerCase().includes(k) && !(r.code || '').toLowerCase().includes(k)) return false
  }
  return true
}))
const execPaged = computed(() =>
  execFiltered.value.slice((execPage.value - 1) * execPageSize.value, execPage.value * execPageSize.value)
)
const dialogVisible = ref(false)
const form = reactive({ id: null, code: '', name: '', type: 'drug_conflict', category: '', severity: 'warn', expression: '', legal_basis: '', suggestion: '' })

async function load() {
  loading.value = true
  try { list.value = await ruleApi.list() }
  finally { loading.value = false; execPage.value = 1 }
}
function openDialog(row) {
  Object.assign(form, row || { id: null, code: '', name: '', type: 'drug_conflict', category: '', severity: 'warn', expression: '', legal_basis: '', suggestion: '' })
  if (row) form.expression = typeof row.expression === 'string' ? row.expression : JSON.stringify(row.expression)
  dialogVisible.value = true
}
async function onSave() {
  if (!form.name || !form.type || !form.expression) return ElMessage.warning('请填写完整')
  try { JSON.parse(form.expression) } catch { return ElMessage.error('表达式不是合法 JSON') }
  const payload = { ...form }
  if (form.id) await ruleApi.update(form.id, payload)
  else await ruleApi.create(payload)
  ElMessage.success('保存成功')
  dialogVisible.value = false
  load()
}
async function onToggle(row) {
  await ruleApi.toggle(row.id)
  ElMessage.success(row.enabled ? '已停用' : '已启用')
  load()
}
async function onDelete(row) {
  await ElMessageBox.confirm(`确定删除规则「${row.name}」？`, '提示', { type: 'warning' })
  await ruleApi.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(() => { loadLibrary(); loadCategories(); load() })
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
</style>
