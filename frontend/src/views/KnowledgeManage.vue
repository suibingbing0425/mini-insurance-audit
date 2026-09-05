<template>
  <div>
    <el-alert v-if="!isAdmin" type="info" :closable="false" show-icon
      title="只读模式：当前账号仅可查看政策知识，编辑与维护请联系管理员" style="margin-bottom: 12px" />

    <div class="toolbar">
      <el-input v-model="search.keyword" placeholder="搜索规则名称" clearable style="width: 220px" @keyup.enter="load" @clear="load" />
      <el-select v-model="search.category1" placeholder="一级分类" clearable style="width: 140px" @change="load">
        <el-option v-for="c in categories.category1" :key="c" :label="c" :value="c" />
      </el-select>
      <el-select v-model="search.category2" placeholder="二级分类" clearable style="width: 180px" @change="load">
        <el-option v-for="c in categories.category2" :key="c" :label="c" :value="c" />
      </el-select>
      <el-button type="primary" @click="load">搜索</el-button>
      <el-button circle @click="resetFilters"><el-icon><Refresh /></el-icon></el-button>
      <el-button v-if="isAdmin" type="warning" @click="openImport">导入 Excel</el-button>
      <el-button v-if="isAdmin" type="success" style="margin-left: auto" @click="openDialog()">新增知识条目</el-button>
    </div>

    <el-table :data="list" border stripe v-loading="loading" style="margin-top: 12px">
      <el-table-column prop="seq" label="序号" width="80" />
      <el-table-column prop="category1" label="一级分类" width="110">
        <template #default="{ row }"><el-tag :type="cat1Color(row.category1)" size="small">{{ row.category1 || '—' }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="category2" label="二级分类" width="190" />
      <el-table-column label="规则名称" min-width="200">
        <template #default="{ row }">
          <el-link type="primary" @click="openDetail(row)">{{ row.name }}</el-link>
        </template>
      </el-table-column>
      <el-table-column label="知识点" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.knowledgeCount > 0" type="success" size="small">{{ row.knowledgeCount }} 条</el-tag>
          <span v-else style="color: #c0c4cc">无</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">查看明细</el-button>
          <template v-if="isAdmin">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
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
      @size-change="page = 1"
    />

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑知识条目' : '新增知识条目'" width="640px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="序号"><el-input-number v-model="form.seq" :min="0" style="width: 140px" /></el-form-item>
        <el-form-item label="一级分类"><el-input v-model="form.category1" placeholder="如 政策类" /></el-form-item>
        <el-form-item label="二级分类"><el-input v-model="form.category2" placeholder="如 药品政策限定类" /></el-form-item>
        <el-form-item label="规则名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="含明细">
          <el-switch v-model="form.hasDetail" />
        </el-form-item>
        <el-form-item label="知识点">
          <el-input v-model="knowledgeText" type="textarea" :rows="10"
            placeholder='JSON 数组格式，如 [{"序号":"1","药品通用名":"xxx","检出逻辑":"..."}]' />
          <span v-if="jsonError" style="color:#f56c6c;font-size:12px">{{ jsonError }}</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!!jsonError" @click="onSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 导入 Excel 弹窗（仅管理员）-->
    <el-dialog v-model="importVisible" title="导入 Excel 规则库" width="560px">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: 12px"
        :title="importMode === 'full'
          ? '完整规则库模式：包含规则列表 sheet + 多个知识点明细 sheet，按 sheet 名匹配规则名'
          : '单规则明细模式：第一个 sheet 为该规则的基本信息，其余 sheet 全部视为该规则的知识点明细'" />
      <el-form label-width="90px" style="margin-bottom: 12px">
        <el-form-item label="导入模式">
          <el-radio-group v-model="importMode">
            <el-radio label="full">完整规则库</el-radio>
            <el-radio label="single">单条规则明细</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <el-upload
        drag
        :auto-upload="false"
        accept=".xlsx,.xls"
        :limit="1"
        :on-change="onFileChange"
        :on-exceed="() => ElMessage.warning('仅支持单个文件')"
        ref="uploadRef">
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">将 Excel 文件拖到此处，或<em>点击上传</em></div>
      </el-upload>
      <template #footer>
        <el-button @click="importVisible = false">取消</el-button>
        <el-button type="primary" :loading="importing" :disabled="!importFile" @click="doImport">开始导入</el-button>
      </template>
    </el-dialog>

    <!-- 详情抽屉：所有人可查看完整知识点明细 -->
    <el-drawer v-model="detailVisible" title="知识条目详情" size="52%">
      <template v-if="detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="序号">{{ detail.seq }}</el-descriptions-item>
          <el-descriptions-item label="一级分类">{{ detail.category1 || '—' }}</el-descriptions-item>
          <el-descriptions-item label="二级分类">{{ detail.category2 || '—' }}</el-descriptions-item>
          <el-descriptions-item label="规则名称">{{ detail.name }}</el-descriptions-item>
          <el-descriptions-item label="含明细">{{ detail.hasDetail ? '是' : '否' }}</el-descriptions-item>
        </el-descriptions>
        <template v-if="detail.knowledge && detail.knowledge.length">
          <h4 style="margin: 18px 0 10px; color: #303133; font-size: 14px">知识点明细</h4>
          <div v-for="(item, i) in detail.knowledge" :key="i" class="knowledge-card">
            <div v-for="(val, key) in item" :key="key" class="kv-row">
              <span class="kv-key">{{ key }}</span>
              <span class="kv-val">{{ val || '—' }}</span>
            </div>
          </div>
        </template>
        <el-empty v-else description="该条目无知识点明细" />
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { knowledgeApi, libraryApi } from '../api'
import { useUserStore } from '../store'

const userStore = useUserStore()
const isAdmin = computed(() => userStore.role === 'admin')

const list = ref([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const pageSize = ref(10)
const categories = ref({ category1: [], category2: [] })
const search = reactive({ keyword: '', category1: '', category2: '' })

const cat1ColorMap = { '政策类': 'warning', '管理类': 'info', '医疗类': 'success' }
const cat1Color = (c) => cat1ColorMap[c] || ''

function resetFilters() {
  search.keyword = ''
  search.category1 = ''
  search.category2 = ''
  page.value = 1
  load()
}

async function load() {
  loading.value = true
  try {
    const data = await knowledgeApi.list({ ...search, page: page.value, pageSize: pageSize.value })
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}
async function loadCategories() {
  const data = await libraryApi.categories()
  categories.value = data
}

// ===== 详情查看（所有角色）=====
const detailVisible = ref(false)
const detail = ref(null)
async function openDetail(row) {
  detail.value = await knowledgeApi.detail(row.id)
  detailVisible.value = true
}

// ===== 新增/编辑（仅管理员）=====
const dialogVisible = ref(false)
const form = reactive({ id: null, seq: 0, category1: '', category2: '', name: '', hasDetail: false })
const knowledgeText = ref('')
const jsonError = ref('')

watch(knowledgeText, (val) => {
  if (!val || !val.trim()) { jsonError.value = ''; return }
  try { JSON.parse(val); jsonError.value = '' }
  catch (e) { jsonError.value = 'JSON 格式错误：' + e.message }
})

function openDialog(row) {
  if (row) {
    form.id = row.id
    form.seq = row.seq
    form.category1 = row.category1
    form.category2 = row.category2
    form.name = row.name
    form.hasDetail = row.hasDetail
    knowledgeApi.detail(row.id).then(d => {
      detail.value = d
      knowledgeText.value = d.knowledge ? JSON.stringify(d.knowledge, null, 2) : ''
    })
  } else {
    Object.assign(form, { id: null, seq: 0, category1: '', category2: '', name: '', hasDetail: false })
    detail.value = null
    knowledgeText.value = ''
  }
  jsonError.value = ''
  dialogVisible.value = true
}

async function onSave() {
  if (!form.name) return ElMessage.warning('请填写规则名称')
  if (jsonError.value) return ElMessage.error('知识点 JSON 格式有误')
  const payload = {
    seq: form.seq,
    category1: form.category1,
    category2: form.category2,
    name: form.name,
    hasDetail: form.hasDetail,
    knowledge: knowledgeText.value ? JSON.parse(knowledgeText.value) : null
  }
  if (form.id) await knowledgeApi.update(form.id, payload)
  else await knowledgeApi.create(payload)
  ElMessage.success('保存成功')
  dialogVisible.value = false
  load()
}

async function onDelete(row) {
  await ElMessageBox.confirm(`确定删除知识条目「${row.name}」？`, '提示', { type: 'warning' })
  await knowledgeApi.remove(row.id)
  ElMessage.success('删除成功')
  load()
}

// ===== 导入 Excel（仅管理员）=====
const importVisible = ref(false)
const importing = ref(false)
const importFile = ref(null)
const importMode = ref('full')
const uploadRef = ref(null)

function openImport() {
  importFile.value = null
  importMode.value = 'full'
  if (uploadRef.value) uploadRef.value.clearFiles()
  importVisible.value = true
}
function onFileChange(file) {
  const raw = file.raw
  if (!raw) return
  if (!/\.(xlsx|xls)$/i.test(raw.name)) { ElMessage.error('仅支持 .xlsx / .xls 文件'); return }
  importFile.value = raw
}
async function doImport() {
  if (!importFile.value) return ElMessage.warning('请先选择 Excel 文件')
  importing.value = true
  try {
    const base64 = await fileToBase64(importFile.value)
    const res = await knowledgeApi.importExcel({
      filename: importFile.value.name,
      file: base64,
      mode: importMode.value
    })
    const created = res?.created || 0
    const updated = res?.updated || 0
    if (created === 0 && updated === 0) {
      ElMessage.info('未导入任何规则（文件可能为空，或规则已存在且无变化）')
    } else if (created === 0 && updated > 0) {
      // 重复导入：规则此前已存在，本次只是更新
      ElMessage.warning(`这 ${updated} 条规则此前已导入，本次已更新其知识点/信息`)
    } else if (updated === 0) {
      ElMessage.success(`成功新增 ${created} 条规则`)
    } else {
      ElMessage.success(`成功新增 ${created} 条、更新 ${updated} 条规则`)
    }
    importVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.message || e?.message || '导入失败')
  } finally {
    importing.value = false
  }
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

onMounted(() => { load(); loadCategories() })
</script>

<style scoped>
.toolbar { display: flex; gap: 12px; margin-bottom: 16px; align-items: center; }
.knowledge-card { border: 1px solid #ebeef5; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; background: #fafafa; }
.kv-row { display: flex; gap: 10px; padding: 3px 0; font-size: 13px; line-height: 1.6; }
.kv-key { flex: 0 0 110px; color: #909399; font-weight: 500; }
.kv-val { flex: 1; color: #303133; word-break: break-all; }
</style>
