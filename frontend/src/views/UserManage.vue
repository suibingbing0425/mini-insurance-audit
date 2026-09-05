<template>
  <div>
    <!-- 功能权限矩阵说明 -->
    <el-card style="margin-bottom: 16px">
      <template #header>功能权限矩阵</template>
      <el-table :data="permissionMatrix" border size="small">
        <el-table-column prop="module" label="功能模块" width="140" />
        <el-table-column label="医生 doctor" align="center">
          <template #default="{ row }">
            <el-tag :type="row.doctor === '操作' ? 'success' : row.doctor === '查看' ? 'info' : ''" size="small">{{ row.doctor }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="管理员 admin" align="center">
          <template #default="{ row }">
            <el-tag :type="row.admin === '操作' ? 'success' : row.admin === '查看' ? 'info' : ''" size="small">{{ row.admin }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <div class="toolbar">
      <el-button type="success" @click="openDialog()">新增人员</el-button>
    </div>

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="username" label="用户名" width="140" />
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column label="角色" width="100">
        <template #default="{ row }">
          <el-tag :type="roleColor(row.role)" size="small">{{ roleText(row.role) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="科室" width="120">
        <template #default="{ row }">{{ row.department?.name || '—' }}</template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button v-if="row.id !== currentUserId" link type="danger" @click="onDelete(row)">删除</el-button>
          <span v-else style="color: #c0c4cc; font-size: 12px">当前账号</span>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑人员' : '新增人员'" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名"><el-input v-model="form.username" :disabled="!!form.id" /></el-form-item>
        <el-form-item :label="form.id ? '新密码' : '密码'">
          <el-input v-model="form.password" type="password" show-password :placeholder="form.id ? '留空不修改' : '请输入密码'" />
        </el-form-item>
        <el-form-item label="姓名"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width: 100%">
            <el-option label="医生 doctor" value="doctor" />
            <el-option label="管理员 admin" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="科室">
          <el-select v-model="form.dept_id" clearable placeholder="可选" style="width: 100%">
            <el-option v-for="d in departments" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="onSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { userApi, departmentApi } from '../api'
import { useUserStore } from '../store'

const userStore = useUserStore()
const currentUserId = userStore.userInfo?.id
const list = ref([])
const departments = ref([])
const loading = ref(false)
const dialogVisible = ref(false)
const form = reactive({ id: null, username: '', password: '', name: '', role: 'doctor', dept_id: null })

const roleMap = { doctor: '医生', admin: '管理员' }
const roleText = r => roleMap[r] || r
const roleColor = r => ({ doctor: 'success', admin: 'danger' }[r] || '')

function formatTime(str) {
  if (!str) return '-'
  const d = new Date(str)
  return d.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
}

// 功能权限矩阵
const permissionMatrix = [
  { module: '患者管理', doctor: '操作', admin: '操作' },
  { module: '模拟HIS开方', doctor: '操作', admin: '操作' },
  { module: '事前提醒', doctor: '查看自己的', admin: '查看全部' },
  { module: '规则管理', doctor: '—', admin: '操作' },
  { module: '事中审核', doctor: '—', admin: '操作' },
  { module: '审核日志', doctor: '—', admin: '查看' },
  { module: '统计报表', doctor: '—', admin: '操作' },
  { module: '人员管理', doctor: '—', admin: '操作' },
]

async function load() {
  loading.value = true
  try {
    list.value = await userApi.list()
    departments.value = await departmentApi.list()
  } finally { loading.value = false }
}
function openDialog(row) {
  Object.assign(form, row || { id: null, username: '', password: '', name: '', role: 'doctor', dept_id: null })
  if (row) form.password = ''
  dialogVisible.value = true
}
async function onSave() {
  if (!form.username || !form.name || !form.role) return ElMessage.warning('用户名/姓名/角色必填')
  if (!form.id && !form.password) return ElMessage.warning('请输入密码')
  const payload = { ...form }
  if (form.id) { if (!payload.password) delete payload.password }
  if (form.id) await userApi.update(form.id, payload)
  else await userApi.create(payload)
  ElMessage.success('保存成功')
  dialogVisible.value = false
  load()
}
async function onDelete(row) {
  await ElMessageBox.confirm(`确定删除「${row.name}（${row.username}）」？`, '提示', { type: 'warning' })
  await userApi.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(() => load())
</script>

<style scoped>
.toolbar { margin-bottom: 16px; }
</style>
