<template>
  <div>
    <div class="toolbar">
      <el-select v-model="status" placeholder="全部状态" clearable style="width: 160px" @change="load(1)">
        <el-option label="草稿" value="draft" />
        <el-option label="已提交" value="submitted" />
        <el-option label="审核通过" value="audited" />
        <el-option label="已拒绝" value="rejected" />
      </el-select>
      <el-input v-model="patientName" placeholder="按患者姓名搜索" clearable style="width: 200px; margin-left: 12px"
        @keyup.enter="load(1)" @clear="load(1)">
      </el-input>
      <el-input v-model="doctorName" placeholder="按医生姓名搜索" clearable style="width: 200px; margin-left: 12px"
        @keyup.enter="load(1)" @clear="load(1)">
      </el-input>
      <el-button  @click="load(1)" type="primary">搜索</el-button>
      <el-button circle @click="resetFilters"><el-icon><Refresh /></el-icon></el-button>
    </div>

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column label="医嘱编号" width="130">
        <template #default="{ row }">{{ row.order_no || row.id }}</template>
      </el-table-column>
      <el-table-column label="患者" width="120">
        <template #default="{ row }">{{ row.patient?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="开方医生" width="120">
        <template #default="{ row }">{{ row.doctor?.name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="diagnosis" label="诊断" />
      <el-table-column label="医嘱状态" width="110">
        <template #default="{ row }">
          <el-tag :type="tagType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="命中数量" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.hitCount > 0 ? 'danger' : 'info'" size="small">{{ row.hitCount }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="开立时间" width="180">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="{ row }">
          <el-button link type="primary" @click="showDetail(row)">详情</el-button>
          <el-button v-if="['draft', 'rejected'].includes(row.status) && userStore.role === 'doctor'" link type="primary" @click="onSubmit(row)">提交</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      style="margin-top: 16px; justify-content: flex-end"
      layout="total, sizes, prev, pager, next, jumper"
      :page-sizes="[10, 20, 50, 100]"
      :total="total"
      v-model:page-size="pageSize"
      v-model:current-page="page"
      @current-change="load"
      @size-change="load(1)"
    />

    <el-dialog v-model="detailVisible" title="医嘱详情" width="720px">
      <el-descriptions v-if="detail" :column="2" border>
        <el-descriptions-item label="患者">{{ detail.patient?.name }}</el-descriptions-item>
        <el-descriptions-item label="医生">{{ detail.doctor?.name }}</el-descriptions-item>
        <el-descriptions-item label="诊断">{{ detail.diagnosis }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusText(detail.status) }}</el-descriptions-item>
        <el-descriptions-item label="内容" :span="2">{{ detail.content || '-' }}</el-descriptions-item>
      </el-descriptions>
      <el-table v-if="detail" :data="detail.prescriptions || []" border size="small" style="margin-top: 12px">
        <el-table-column label="药品" prop="drug.name" />
        <el-table-column label="规格" prop="drug.specification" />
        <el-table-column label="数量" prop="quantity" width="80" />
        <el-table-column label="频次" prop="frequency" width="110" />
        <el-table-column label="天数" prop="days" width="70" />
        <el-table-column label="单次剂量(mg)" prop="single_dose" width="130" />
      </el-table>
      <div v-if="detail?.auditRecords?.length" style="margin-top: 12px">
        <div style="font-weight: 500; margin-bottom: 8px">审核结果（共对照 {{ detail.auditRecords[0]?.checked_count || 0 }} 条规则）</div>
        <el-card v-for="(rec, i) in detail.auditRecords" :key="i" shadow="never" style="margin-bottom: 8px"
          :class="rec.status === 'reject' ? 'rec-reject' : rec.status === 'warn' ? 'rec-warn' : 'rec-pass'">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px">
            <el-tag :type="rec.status === 'reject' ? 'danger' : rec.status === 'warn' ? 'warning' : 'success'" size="small">
              {{ { pass: '通过', warn: '提醒', reject: '拒绝' }[rec.status] }}
            </el-tag>
            <span v-if="rec.details" style="color: #606266; font-size: 13px; font-weight: 500">
              {{ rec.details.rule_code }} · {{ rec.details.rule_name }}
            </span>
          </div>
          <div v-if="rec.details" style="font-size: 13px; color: #303133; line-height: 1.6">
            {{ rec.details.reason }}
          </div>
          <div v-if="rec.details?.suggestion" style="font-size: 12px; color: #606266; margin-top: 4px">
            <b>建议：</b>{{ rec.details.suggestion }}
          </div>
          <div v-if="rec.details?.legal_basis" style="font-size: 12px; color: #909399; margin-top: 2px">
            <b>依据：</b>{{ rec.details.legal_basis }}
          </div>
          <div v-else style="font-size: 13px; color: #303133">{{ rec.message }}</div>
        </el-card>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.rec-reject { border-left: 3px solid #f56c6c; background: #fef0f0; }
.rec-warn { border-left: 3px solid #e6a23c; background: #fdf6ec; }
.rec-pass { border-left: 3px solid #67c23a; background: #f0f9eb; }
</style>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { orderApi } from '../api'
import { useUserStore } from '../store'

const userStore = useUserStore()
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const status = ref('')
const patientName = ref('')
const doctorName = ref('')
const loading = ref(false)
const detailVisible = ref(false)
const detail = ref(null)

const statusMap = { draft: '草稿', submitted: '已提交', audited: '审核通过', rejected: '已拒绝' }
const statusText = s => statusMap[s] || s
const tagType = s => ({ draft: 'info', submitted: 'warning', audited: 'success', rejected: 'danger' }[s] || 'info')

// 格式化时间：2026-08-18 16:00（与 PatientList 保持一致）
function formatTime(t) {
  if (!t) return '—'
  const d = new Date(t)
  if (isNaN(d)) return t
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function resetFilters() {
  status.value = ''
  patientName.value = ''
  doctorName.value = ''
  load(1)
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const data = await orderApi.list({ page: p, pageSize: pageSize.value, status: status.value, patientName: patientName.value.trim(), doctorName: doctorName.value.trim() })
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

async function showDetail(row) {
  detail.value = await orderApi.detail(row.id)
  detailVisible.value = true
}

async function onSubmit(row) {
  await ElMessageBox.confirm('确定提交该医嘱并触发审核？', '提示', { type: 'warning' })
  const res = await orderApi.submit(row.id)
  if (res.status === 'rejected') ElMessage.error('命中拒绝规则，医嘱被拦截')
  else if (res.violations.length > 0) ElMessage.warning('命中提醒规则，审核通过（需人工复核）')
  else ElMessage.success('审核通过')
  load()
}

onMounted(() => load())
</script>

<style scoped>
.toolbar { margin-bottom: 16px; }
.toolbar :deep(.el-input__inner) { color: #409eff; }
</style>
