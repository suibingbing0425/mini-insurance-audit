<template>
  <div>
    <div class="toolbar">
      <span class="label-text">审核状态</span>
      <el-select v-model="status" style="width: 160px" @change="load(1)">
        <el-option label="提醒/拒绝" value="pending" />
        <el-option label="全部" value="" />
        <el-option label="通过" value="pass" />
        <el-option label="提醒" value="warn" />
        <el-option label="拒绝" value="reject" />
      </el-select>
      <span class="label-text">处理状态</span>
      <el-select v-model="handled" style="width: 140px" @change="load(1)">
        <el-option label="全部" value="" />
        <el-option label="已处理" value="done" />
        <el-option label="未处理" value="undone" />
      </el-select>
      <el-button circle @click="resetFilters"><el-icon><Refresh /></el-icon></el-button>
      <el-button type="primary" :loading="exporting" @click="exportExcel" style="margin-left: auto">导出 Excel</el-button>
    </div>

    <el-table :data="list" border stripe v-loading="loading" :row-class-name="rowClassName">
      <el-table-column label="审核编号" width="130">
        <template #default="{ row }">{{ row.audit_no || row.id }}</template>
      </el-table-column>
      <el-table-column label="患者" width="85">
        <template #default="{ row }">{{ row.order?.patient?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="命中规则" width="200" show-overflow-tooltip>
        <template #default="{ row }">{{ row.rule?.name || '（无规则，自动通过）' }}</template>
      </el-table-column>
      <el-table-column label="审核结论" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'reject' ? 'danger' : row.status === 'warn' ? 'warning' : 'success'" size="small">
            {{ { pass: '通过', warn: '提醒', reject: '拒绝' }[row.status] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="message" label="审核说明" :show-overflow-tooltip="{ popperClass: 'audit-message-tooltip' }" />
      <el-table-column prop="feedback" label="复核反馈" :show-overflow-tooltip="{ popperClass: 'audit-message-tooltip' }" >
        <template #default="{ row }">{{ row.feedback || '-' }}</template>
      </el-table-column>
      <el-table-column label="审核时间" width="150">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button v-if="userStore.role === 'admin'" link type="primary" @click="router.push(`/audits/${row.id}`)">复核/反馈</el-button>
          <el-tooltip v-else content="仅管理员可操作" placement="top">
            <span>
              <el-button link type="info" @click="router.push(`/audits/${row.id}`)">查看详情</el-button>
            </span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="处理状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.auditor_id ? 'success' : 'info'" size="small">{{ row.auditor_id ? '已处理' : '未处理' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="处理人" width="100">
        <template #default="{ row }">{{ row.auditor?.name || '-' }}</template>
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { auditApi } from '../api'
import { useUserStore } from '../store'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()

const route = useRoute()
const router = useRouter()
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const status = ref('pending')
const handled = ref('')
const loading = ref(false)
const exporting = ref(false)
// 从开方页「转入事中审核」跳转而来时，高亮该医嘱对应的审核记录
const highlightOrderId = ref(route.query.orderId ? Number(route.query.orderId) : null)

function rowClassName({ row }) {
  return row.order_id && row.order_id === highlightOrderId.value ? 'row-highlight' : ''
}

function resetFilters() {
  status.value = 'pending'
  handled.value = ''
  load(1)
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const data = await auditApi.list({ page: p, pageSize: pageSize.value, status: status.value, handled: handled.value })
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

async function exportExcel() {
  exporting.value = true
  try {
    const res = await auditApi.exportExcel({ status: status.value, handled: handled.value })
    const url = window.URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `审核记录_${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (e) {
    ElMessage.error('导出失败：' + (e.response?.data?.message || e.message))
  } finally {
    exporting.value = false
  }
}

function formatTime(str) {
  if (!str) return '-'
  const d = new Date(str)
  return d.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
}

onMounted(() => load())
</script>

<style scoped>
.toolbar { margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
.hint { font-size: 12px; color: #909399; }

/* 限制"审核说明"悬浮气泡宽度：窄了文字换行、高度自然变高 */
:deep(.audit-message-tooltip) {
  max-width: 300px;
  line-height: 1.6;
  word-break: break-all;
  white-space: pre-wrap;
}

/* toolbar 标签文字 */
.label-text { font-size: 14px; color: #606266; }

/* 从开方页转入事中审核时高亮对应记录 */
:deep(.row-highlight) {
  background-color: #fdf6ec !important;
}
:deep(.row-highlight:hover > td) {
  background-color: #faecd8 !important;
}
</style>
