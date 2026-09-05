<template>
  <div class="page-layout">
    <div class="left-panel">
      <el-card>
        <template #header>模拟 HIS 开方入口（演示用）</template>
        <div class="demo-bar">
          <span class="demo-label">一键演示：</span>
          <el-button size="small" :disabled="submitted" @click="applyDemo(0)">① 妊娠禁忌</el-button>
          <el-button size="small" :disabled="submitted" @click="applyDemo(1)">② 儿童禁用</el-button>
          <el-button size="small" :disabled="submitted" @click="applyDemo(2)">③ 超疗程</el-button>
          <el-button size="small" :disabled="submitted" @click="applyDemo(3)">④ 性别禁忌</el-button>
          <el-button size="small" :disabled="submitted" @click="applyDemo(4)">⑤ 医保不符</el-button>
          <span class="demo-tip">自动选患者+开药，右侧实时出事前提醒（供不了解规则的人快速体验）</span>
        </div>
        <el-form label-width="90px">
          <el-form-item label="患者">
            <el-select v-model="form.patient_id" :disabled="submitted" filterable placeholder="搜索选择患者" style="width: 220px">
              <el-option v-for="p in patients" :key="p.id" :label="`${p.name}（${p.gender}${p.age}岁${p.pregnancy_status ? '·妊娠中' : ''}·${p.insurance_type}）`" :value="p.id" />
            </el-select>
            <el-input v-model="patientKeyword" placeholder="搜患者" style="width: 130px; margin-left: 10px" @keyup.enter="loadPatients" />
            <el-button style="margin-left: 8px" @click="loadPatients">搜索</el-button>
          </el-form-item>
          <el-form-item label="就诊类型">
            <!-- <span style="color: #606266">就诊类型：</span> -->
            <el-select v-model="form.visit_type" :disabled="submitted" style="width: 120px">
              <el-option label="住院" value="住院" />
              <el-option label="门急诊" value="门急诊" />
              <el-option label="购药" value="购药" />
              <el-option label="互联网诊疗" value="互联网诊疗" />
            </el-select>
            <span style="margin-left:40px;color:#606266">医院级别：</span>
            <el-select v-model="form.hospital_level" :disabled="submitted" style="width: 120px">
              <el-option label="三级" value="三级" />
              <el-option label="二级" value="二级" />
              <el-option label="一级及以下" value="一级及以下" />
            </el-select>
          </el-form-item>
          <el-form-item label="诊断"><el-input v-model="form.diagnosis" :disabled="submitted" placeholder="如：上呼吸道感染" style="width: 435px" /></el-form-item>
          <el-form-item label="医嘱内容"><el-input v-model="form.content" :disabled="submitted" type="textarea" :rows="3" style="width: 435px" /></el-form-item>
        </el-form>

        <div style="display: flex; align-items: center; margin: 16px 0">
          <span style="font-weight: 500">处方明细</span>
          <el-button type="primary" plain size="small" style="margin-left: auto" :disabled="submitted" @click="addRow">+ 添加药品</el-button>
        </div>
        <el-table :data="form.prescriptions" border  style="height: 180px; width: 100%;" >
          <el-table-column type="index" label="序号" width="50" align="center" />
          <el-table-column label="药品名称" min-width="180">
            <template #default="{ row }">
              <el-select v-model="row.drug_id" :disabled="submitted" filterable placeholder="搜索药品" style="width: 100%" @change="onDrugChange(row)">
                <el-option v-for="d in drugs" :key="d.id" :label="d.name" :value="d.id" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="规格" min-width="100">
            <template #default="{ row }">
              <span style="color: #606266">{{ getDrugSpec(row.drug_id) || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="用法" min-width="100">
            <template #default="{ row }">
              <el-select v-model="row.usage" :disabled="submitted" placeholder="用法" style="width: 100%">
                <el-option label="口服" value="口服" />
                <el-option label="外用" value="外用" />
                <el-option label="注射" value="注射" />
                <el-option label="含服" value="含服" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="频次" min-width="100">
            <template #default="{ row }">
              <el-input v-model="row.frequency" :disabled="submitted" placeholder="如每日3次" />
            </template>
          </el-table-column>
          <el-table-column label="单次剂量(mg)" min-width="110">
            <template #default="{ row }">
              <el-input-number v-model="row.single_dose" :disabled="submitted" :min="0" :precision="1" controls-position="right" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column label="数量" min-width="90">
            <template #default="{ row }">
              <el-input-number v-model="row.quantity" :disabled="submitted" :min="1" controls-position="right" style="width: 100%" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" align="center" fixed="right">
            <template #default="{ $index }">
              <el-button link type="danger" :disabled="submitted" @click="removeRow($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="actions">
          <el-button @click="saveDraft" :disabled="submitted">保存草稿</el-button>
          <el-button type="primary" :loading="submitting" :disabled="submitted" @click="submitOrder">提交审核</el-button>
          <el-button type="default" plain style="margin-left: 12px" @click="resetForm">重置开方</el-button>
        </div>
        <el-alert v-if="submitted" type="success" :closable="false" title="该处方已提交成功，请点击下方「重置开方」或重新进入「模拟HIS开方」以开具新医嘱" style="margin-top: 12px" />
      </el-card>
    </div>

    <div class="right-panel">
      <el-card class="result-card">
        <template #header>事前提醒</template>
        <div v-if="precheckResults.length === 0" class="empty-tip">暂无数据</div>
        <template v-else>
          <el-card v-for="(v, i) in precheckResults" :key="i" shadow="never" class="violation-card"
            :class="v.severity === 'reject' ? 'violation-reject' : 'violation-warn'" style="margin-top: 8px">
            <div class="v-header">
              <el-tag :type="v.severity === 'reject' ? 'danger' : 'warning'" size="small">
                {{ v.severity === 'reject' ? '拒绝' : '提醒' }} · {{ v.category }}
              </el-tag>
              <span class="v-code">{{ v.rule_code }} · {{ v.rule_name }}</span>
            </div>
            <div class="v-reason">{{ v.reason }}</div>
            <div class="v-action" v-if="v.suggestion"><b>建议处理：</b>{{ v.suggestion }}</div>
            <div class="v-bases" v-if="v.legal_basis"><b>依据：</b>{{ v.legal_basis }}</div>
          </el-card>
          <div class="precheck-actions">
            <template v-if="submitted">
              <span class="submitted-tip"><el-icon><Check /></el-icon>已提交，点击下方「重置开方」继续</span>
            </template>
            <template v-else>
              <el-button type="warning" plain size="small" :loading="submitting" :disabled="!form.patient_id || form.prescriptions.filter(p=>p.drug_id).length===0" @click="transferToAudit">
                转入事中审核
              </el-button>
              <span class="precheck-hint">提交审核并跳转到事中审核队列</span>
            </template>
          </div>
        </template>
      </el-card>

      <el-card class="result-card" :class="result ? (result.status === 'rejected' ? 'result-reject' : 'result-pass') : ''">
        <template #header>审核结果</template>
        <div v-if="!result" class="empty-tip">暂无数据</div>
        <template v-else>
          <p><b>医嘱编号：</b>{{ result.order_no || ('#' + result.id) }}</p>
          <p><b>医嘱状态：</b>{{ statusText(result.status) }}</p>
          <el-alert v-for="(v, i) in result.violations" :key="i"
            :type="v.severity === 'reject' ? 'error' : 'warning'" :closable="false" style="margin-top: 8px"
            :title="`[${v.severity === 'reject' ? '拒绝' : '提醒'}] ${v.reason}`" />
          <el-alert v-if="result.violations.length === 0" type="success" :closable="false" title="未命中任何规则，审核通过" style="margin-top: 8px" />
        </template>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import { patientApi, drugApi, orderApi } from '../api'

const router = useRouter()
const patients = ref([])
const drugs = ref([])
const patientKeyword = ref('')
const submitting = ref(false)
const submitted = ref(false)   // 当前表单已提交成功，禁止重复提交
const result = ref(null)
const precheckResults = ref([])
const form = reactive({
  patient_id: null, diagnosis: '', content: '', prescriptions: [],
  visit_type: '门急诊', hospital_level: '二级'
})

// 事前提醒：处方变化时实时预审（防抖 400ms，不落库不改状态）
// 返回 { violations, checked } —— violations 是富结构数组
let precheckTimer = null
async function runPrecheck() {
  clearTimeout(precheckTimer)
  precheckTimer = setTimeout(async () => {
    const rows = form.prescriptions.filter(p => p.drug_id)
    if (rows.length === 0) { precheckResults.value = []; return }
    try {
      const data = await orderApi.precheck({ patient_id: form.patient_id, prescriptions: rows, visit_type: form.visit_type, hospital_level: form.hospital_level })
      console.log('data', data)
      precheckResults.value = data.violations || []
    } catch {
      precheckResults.value = []
    }
  }, 400)
}
watch(form.prescriptions, runPrecheck, { deep: true })

function addRow() {
  form.prescriptions.push({ drug_id: null, quantity: 1, frequency: '每日3次', days: 3, single_dose: null, usage: '口服' })
}
function removeRow(i) {
  form.prescriptions.splice(i, 1)
}
function onDrugChange(row) {
  const d = drugs.value.find(x => x.id === row.drug_id)
  if (d && d.max_dose) row.single_dose = Number(d.max_dose)
}
// 根据 drug_id 自动取规格显示
function getDrugSpec(drugId) {
  if (!drugId) return ''
  const d = drugs.value.find(x => x.id === drugId)
  return d ? d.specification : ''
}
function statusText(s) {
  return { draft: '草稿', submitted: '已提交', audited: '审核通过', rejected: '已拒绝' }[s] || s
}

// ===== 一键演示处方：自动选患者 + 填药，右侧 watch 会自动触发事前提醒 =====
const DEMOS = [
  { patient: '李小红', diagnosis: '常规诊疗', items: [{ name: '阿苯达唑片', days: 3 }] },
  { patient: '张小明', diagnosis: '上呼吸道感染', items: [{ name: '安乃近片', days: 3 }] },
  { patient: '张大壮', diagnosis: '支气管炎', items: [{ name: '阿莫西林分散片', days: 14 }] },
  { patient: '张大壮', diagnosis: '妇科门诊随访', items: [{ name: '艾附暖宫丸', days: 7 }] },
  { patient: '王秀英', diagnosis: '皮肤瘙痒', items: [{ name: '疤痕止痒软化膏', days: 7 }] }
]
function applyDemo(idx) {
  const demo = DEMOS[idx]
  if (!demo) return
  resetForm()
  const patient = patients.value.find(x => x.name === demo.patient)
  if (!patient) return ElMessage.warning(`未找到演示患者「${demo.patient}」，请先点击患者区「搜索」刷新`)
  form.patient_id = patient.id
  form.diagnosis = demo.diagnosis
  form.prescriptions = demo.items.map(it => {
    const drug = drugs.value.find(x => x.name === it.name)
    if (!drug) return null
    const isExternal = /膏|软膏|乳膏|栓|贴/.test(drug.name)
    return {
      drug_id: drug.id, quantity: 1, frequency: isExternal ? '每日1次' : '每日3次',
      days: it.days, single_dose: Number(drug.max_dose) || 1,
      usage: isExternal ? '外用' : '口服'
    }
  }).filter(Boolean)
  ElMessage.success(`已填充示例「${demo.patient} 开${demo.items.map(i => i.name).join('、')}」，右侧为事前提醒结果`)
}

// 重置表单，用于成功转入事中审核后或用户手动新开方
function resetForm() {
  form.patient_id = null
  form.diagnosis = ''
  form.content = ''
  form.prescriptions = []
  form.visit_type = '门急诊'
  form.hospital_level = '二级'
  precheckResults.value = []
  result.value = null
  submitted.value = false
}

async function loadPatients() {
  const data = await patientApi.list({ page: 1, pageSize: 20, keyword: patientKeyword.value })
  patients.value = data.list
}
async function loadDrugs() {
  const data = await drugApi.list({ page: 1, pageSize: 100 })
  drugs.value = data.list
}

async function saveDraft() {
  if (!form.patient_id) return ElMessage.warning('请选择患者')
  const data = await orderApi.create(form)
  const no = data.order_no || ('#' + data.id)
  ElMessage.success(`${no} 草稿已保存`)
}

// 事前预警 → 一键转入事中审核：提交审核生成审核记录并跳转到事中审核队列（带 orderId 高亮定位）
async function transferToAudit() {
  if (!form.patient_id) return ElMessage.warning('请选择患者')
  if (!form.diagnosis.trim()) return ElMessage.warning('请填写诊断')
  if (form.prescriptions.filter(p => p.drug_id).length === 0) return ElMessage.warning('请至少添加一条处方')
  submitting.value = true
  try {
    const data = await orderApi.create(form)
    const res = await orderApi.submit(data.id)
    const no = data.order_no || ('#' + data.id)
    ElMessage.success(`${no} 已提交并转入事中审核队列`)
    resetForm()
    router.push({ path: '/audits', query: { orderId: data.id } })
  } catch {
    ElMessage.error('转入失败，请重试')
  } finally {
    submitting.value = false
  }
}
async function submitOrder() {
  if (!form.patient_id) return ElMessage.warning('请选择患者')
  if (!form.diagnosis.trim()) return ElMessage.warning('请填写诊断')
  if (form.prescriptions.length === 0) return ElMessage.warning('请至少添加一条处方')
  submitting.value = true
  try {
    const data = await orderApi.create(form)
    const res = await orderApi.submit(data.id)
    const no = data.order_no || ('#' + data.id)
    result.value = { status: res.status, violations: res.violations, order_no: data.order_no, id: data.id }
    submitted.value = true
    ElMessage.success(`${no} ${res.status === 'rejected' ? '命中拒绝规则，医嘱被拦截' : '审核完成'}`)
  } finally {
    submitting.value = false
  }
}

onMounted(() => { loadPatients(); loadDrugs() })
</script>

<style scoped>
.demo-bar { display: flex; align-items: center; gap: 6px; margin-bottom: 14px; flex-wrap: wrap; background: rgba(64,158,255,0.05); border: 1px dashed rgba(64,158,255,0.35); border-radius: 8px; padding: 8px 10px; }
.demo-label { font-weight: 500; font-size: 13px; color: #409eff; }
.demo-tip { font-size: 12px; color: #909399; margin-left: 4px; }
.page-layout { display: flex; gap: 10px; align-items: stretch; height: 100%; box-sizing: border-box; padding: 10px; }
.left-panel { flex: 1; min-width: 0; display: flex; }
.left-panel > .el-card { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.left-panel > .el-card :deep(.el-card__body) { flex: 1; overflow: auto; scrollbar-width: none; }
.left-panel > .el-card :deep(.el-card__body)::-webkit-scrollbar { width: 0; height: 0; }
.right-panel { width: 360px; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; }
.result-card { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.right-panel > .result-card:first-child { flex: 6; }
.right-panel > .result-card:last-child { flex: 4; }
.result-card :deep(.el-card__body) { flex: 1; overflow: auto; scrollbar-width: none; padding: 12px; }
.result-card :deep(.el-card__body)::-webkit-scrollbar { width: 0; height: 0; }
.empty-tip { color: #909399; font-size: 13px; text-align: center; padding: 20px 0; }
.actions { margin-top: 20px; }
.result-reject { border-color: #f56c6c; }
.result-pass { border-color: #67c23a; }
.violation-card { padding: 8px 10px; border-radius: 6px; background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.04); }
.violation-reject { background: rgba(245,108,108,0.04); border-color: rgba(245,108,108,0.12); }
.violation-warn { background: rgba(230,162,60,0.04); border-color: rgba(230,162,60,0.12); }
.v-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.v-code { color: #606266; font-weight: 600; font-size: 12px; }
.v-reason { color: #303133; font-size: 13px; line-height: 1.4; margin-bottom: 4px; }
.v-action, .v-bases { font-size: 12px; color: #606266; line-height: 1.6; }
.precheck-actions { margin-top: 12px; display: flex; align-items: center; gap: 10px; }
.precheck-hint { font-size: 12px; color: #909399; }
.submitted-tip { font-size: 13px; color: #909399; display: inline-flex; align-items: center; gap: 5px; }
</style>
