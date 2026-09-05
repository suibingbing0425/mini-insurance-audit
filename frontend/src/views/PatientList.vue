<template>
  <div>
    <div class="toolbar">
      <el-input v-model="keyword" placeholder="按姓名搜索" clearable style="width: 220px" @keyup.enter="load(1)" @clear="load(1)" />
      <el-button type="primary" @click="load(1)">搜索</el-button>
      <el-button type="success" @click="openDialog()">新增患者</el-button>
    </div>

    <el-table :data="list" border stripe v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="gender" label="性别" width="80" />
      <el-table-column prop="age" label="年龄" width="80" />
      <el-table-column prop="id_card" label="身份证号" />
      <el-table-column prop="phone" label="电话" />
      <el-table-column prop="insurance_type" label="医保类型" width="100" />
      <el-table-column label="妊娠" width="70">
        <template #default="{ row }">
          <el-tag v-if="row.pregnancy_status" type="danger" size="small">是</el-tag>
          <el-tag v-else type="info" size="small">否</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="160">
        <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
          <el-button v-if="userStore.role === 'admin'" link type="danger" @click="onDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑患者' : '新增患者'" width="500px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="form.gender">
            <el-radio value="男">男</el-radio>
            <el-radio value="女">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="年龄" prop="age">
          <el-input-number v-model="form.age" :min="0" :max="120" controls-position="right" style="width: 140px" />
        </el-form-item>
        <el-form-item label="身份证号" prop="id_card">
          <el-input v-model="form.id_card" placeholder="18 位身份证号（选填）" maxlength="18" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="form.phone" placeholder="11 位手机号（选填）" maxlength="11" />
        </el-form-item>
        <el-form-item label="医保类型" prop="insurance_type">
          <el-select v-model="form.insurance_type" style="width: 160px">
            <el-option label="职工医保" value="职工医保" />
            <el-option label="居民医保" value="居民医保" />
            <el-option label="自费" value="自费" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.gender === '女'" label="妊娠状态">
          <el-switch v-model="form.pregnancy_status" :active-value="1" :inactive-value="0" active-text="妊娠中" inactive-text="非妊娠" />
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
import { patientApi } from '../api'
import { useUserStore } from '../store'

const userStore = useUserStore()

// 格式化时间：2026-08-18 16:00:00
function formatTime(t) {
  if (!t) return '—'
  const d = new Date(t)
  if (isNaN(d)) return t
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const loading = ref(false)
const dialogVisible = ref(false)
const formRef = ref(null)
const form = reactive({ id: null, name: '', gender: '男', age: 0, id_card: '', phone: '', insurance_type: '居民医保', pregnancy_status: 0 })

// 表单校验规则
const rules = {
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' },
    { min: 2, max: 20, message: '姓名长度 2-20 个字符', trigger: 'blur' }
  ],
  gender: [{ required: true, message: '请选择性别', trigger: 'change' }],
  age: [{ required: true, message: '请输入年龄', trigger: 'blur' }],
  id_card: [
    { pattern: /^$|^\d{17}[\dXx]$/, message: '身份证号应为 18 位（最后一位可为 X）', trigger: 'blur' }
  ],
  phone: [
    { pattern: /^$|^1[3-9]\d{9}$/, message: '请输入正确的 11 位手机号', trigger: 'blur' }
  ],
  insurance_type: [{ required: true, message: '请选择医保类型', trigger: 'change' }]
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const data = await patientApi.list({ page: p, pageSize: pageSize.value, keyword: keyword.value })
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function openDialog(row) {
  Object.assign(form, row || { id: null, name: '', gender: '男', age: 0, id_card: '', phone: '', insurance_type: '居民医保', pregnancy_status: 0 })
  dialogVisible.value = true
}

async function onSave() {
  try {
    await formRef.value.validate()
  } catch {
    return  // 校验不通过，el-form-item 自动显示错误
  }
  if (form.id) await patientApi.update(form.id, form)
  else await patientApi.create(form)
  ElMessage.success('保存成功')
  dialogVisible.value = false
  load()
}

async function onDelete(row) {
  await ElMessageBox.confirm(`确定删除患者「${row.name}」？`, '提示', { type: 'warning' })
  await patientApi.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

onMounted(() => load())
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; }
</style>
