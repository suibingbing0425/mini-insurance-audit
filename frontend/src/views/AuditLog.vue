<template>
  <div>
    <!-- 统计概览：审核结果分布（质控用） -->
    <div class="stats">
      <div class="stat-card">
        <div class="stat-label">审核总数</div>
        <div class="stat-num">{{ stats.total }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">通过</div>
        <div class="stat-num" style="color: var(--el-color-success)">{{ stats.pass }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">驳回</div>
        <div class="stat-num" style="color: var(--el-color-danger)">{{ stats.reject }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">提醒</div>
        <div class="stat-num" style="color: var(--el-color-warning)">{{ stats.warn }}</div>
      </div>
    </div>

    <!-- 多维筛选栏 -->
    <div class="toolbar">
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width: 240px"
        @change="load(1)"
      />
      <el-select v-model="operatorId" placeholder="操作人" clearable style="width: 130px" @change="load(1)">
        <el-option v-for="u in operators" :key="u.id" :label="u.name" :value="u.id" />
      </el-select>
      <el-select v-model="action" placeholder="操作类型" clearable style="width: 130px" @change="load(1)">
        <el-option label="提交审核" value="submit" />
        <el-option label="人工通过" value="audit" />
        <el-option label="反馈" value="feedback" />
        <el-option label="人工驳回" value="reject" />
      </el-select>
      <el-input v-model="patientKeyword" placeholder="患者姓名" clearable style="width: 130px" @keyup.enter="load(1)" @clear="load(1)" />
      <el-input v-model="doctorKeyword" placeholder="医生姓名" clearable style="width: 130px" @keyup.enter="load(1)" @clear="load(1)" />
      <el-input v-model="orderNo" placeholder="医嘱编号 YZ-" clearable style="width: 160px" @keyup.enter="load(1)" @clear="load(1)" />
      <el-button type="primary" @click="load(1)">查询</el-button>
      <el-button circle @click="resetFilters"><el-icon><Refresh /></el-icon></el-button>
      <el-button style="margin-left: auto" @click="exportCsv">导出 CSV</el-button>
    </div>

    <el-table :data="list" border stripe v-loading="loading" @row-click="openDrawer">
      <el-table-column label="医嘱编号" width="140">
        <template #default="{ row }">{{ row.order?.order_no || ('#' + row.order_id) }}</template>
      </el-table-column>
      <el-table-column label="患者" width="100">
        <template #default="{ row }">{{ row.order?.patient?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="医生" width="100">
        <template #default="{ row }">{{ row.order?.doctor?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作类型" width="110">
        <template #default="{ row }">
          <el-tag size="small" :type="actionType(row.action)">{{ actionText(row.action) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作人" width="100">
        <template #default="{ row }">{{ row.operator?.name || '系统' }}</template>
      </el-table-column>
      <el-table-column prop="content" label="内容" show-overflow-tooltip />
       <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="total > 0"
      style="margin-top: 14px; justify-content: flex-end"
      layout="total, sizes, prev, pager, next, jumper"
      :page-sizes="[10, 20, 50, 100]"
      :total="total"
      v-model:page-size="pageSize"
      v-model:current-page="page"
      @size-change="load(1)"
      @current-change="load"
    />

    <!-- 单条医嘱的完整决策链 -->
    <el-drawer v-model="drawerVisible" title="该医嘱审核决策链" size="420px">
      <el-timeline v-loading="drawerLoading">
        <el-timeline-item v-for="log in drawerLogs" :key="log.id" :timestamp="formatTime(log.created_at)">
          <div style="font-weight: 500">{{ actionText(log.action) }} · {{ log.operator?.name || '系统' }}</div>
          <div style="color: var(--el-text-color-secondary); font-size: 13px; margin-top: 4px">{{ log.content }}</div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-if="!drawerLoading && drawerLogs.length === 0" description="暂无日志" />
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { auditApi, userApi } from '../api'

const list = ref([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)

const dateRange = ref('')
const operatorId = ref('')
const action = ref('')
const patientKeyword = ref('')
const doctorKeyword = ref('')
const orderNo = ref('')
const operators = ref([])

const stats = ref({ total: 0, pass: 0, reject: 0, warn: 0 })

const drawerVisible = ref(false)
const drawerLoading = ref(false)
const drawerLogs = ref([])

const actionMap = { submit: '提交审核', audit: '人工通过', feedback: '反馈', reject: '人工驳回' }
const actionText = a => actionMap[a] || a
const actionType = a => ({ submit: 'info', audit: 'success', feedback: 'warning', reject: 'danger' }[a] || 'info')

function formatTime(str) {
  if (!str) return '-'
  const d = new Date(str)
  return d.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
}

async function loadOperators() {
  try {
    const users = await userApi.list()
    operators.value = (users || []).filter(u => u.role === 'admin')
  } catch { operators.value = [] }
}

function buildParams() {
  const p = { page: page.value, pageSize: pageSize.value }
  if (dateRange.value && dateRange.value.length === 2) {
    p.startDate = dateRange.value[0]
    p.endDate = dateRange.value[1]
  }
  if (operatorId.value) p.operatorId = operatorId.value
  if (action.value) p.action = action.value
  if (patientKeyword.value.trim()) p.patientKeyword = patientKeyword.value.trim()
  if (doctorKeyword.value.trim()) p.doctorKeyword = doctorKeyword.value.trim()
  if (orderNo.value.trim()) p.orderNo = orderNo.value.trim()
  return p
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const data = await auditApi.allLogs(buildParams())
    list.value = data.list || []
    total.value = data.total || 0
    if (data.stats) stats.value = data.stats
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || '审核日志加载失败')
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  dateRange.value = ''
  operatorId.value = ''
  action.value = ''
  patientKeyword.value = ''
  doctorKeyword.value = ''
  orderNo.value = ''
  load(1)
}

async function exportCsv() {
  try {
    const data = await auditApi.allLogs({ ...buildParams(), page: 1, pageSize: 100000 })
    const rows = data.list || []
    const header = ['时间', '医嘱编号', '患者', '医生', '操作类型', '操作人', '内容']
    const lines = [header.join(',')]
    for (const r of rows) {
      const cells = [
        formatTime(r.created_at),
        r.order?.order_no || ('#' + r.order_id),
        r.order?.patient?.name || '',
        r.order?.doctor?.name || '',
        actionText(r.action),
        r.operator?.name || '系统',
        (r.content || '').replace(/,/g, '，')
      ]
      lines.push(cells.map(c => `"${c}"`).join(','))
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `审核日志_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || '导出失败')
  }
}

async function openDrawer(row) {
  drawerVisible.value = true
  drawerLoading.value = true
  drawerLogs.value = []
  try {
    drawerLogs.value = await auditApi.logs(row.order_id)
  } catch (err) {
    ElMessage.error(err?.response?.data?.message || '加载该医嘱日志失败')
  } finally {
    drawerLoading.value = false
  }
}

onMounted(() => { loadOperators(); load(1) })
</script>

<style scoped>
.toolbar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-card { background: var(--el-fill-color-light); border-radius: 8px; padding: 12px 16px; }
.stat-label { font-size: 13px; color: var(--el-text-color-secondary); }
.stat-num { font-size: 24px; font-weight: 500; margin-top: 4px; }
</style>
