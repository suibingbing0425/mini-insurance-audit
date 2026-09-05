<template>
  <div class="prescription-page">
    <el-card shadow="never" class="prescription-card">
      <template #header>
        <div class="card-title">模拟 HIS 开方入口（演示用）</div>
      </template>

      <!-- 患者信息区 -->
      <el-form :model="form" label-width="100px" class="base-form">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="患者" class="patient-item">
              <el-select
                v-model="form.patientId"
                filterable
                remote
                reserve-keyword
                placeholder="搜索选择患者"
                :remote-method="searchPatient"
                :loading="patientLoading"
                style="flex: 1"
              >
                <el-option
                  v-for="p in patientOptions"
                  :key="p.id"
                  :label="p.name"
                  :value="p.id"
                />
              </el-select>
              <el-input
                v-model="form.patientKeyword"
                placeholder="搜患者"
                style="width: 140px; margin-left: 12px"
              />
              <el-button type="primary" style="margin-left: 12px" @click="onSearchPatient">
                搜索
              </el-button>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="就诊类型">
              <el-select v-model="form.visitType" placeholder="请选择" style="width: 100%">
                <el-option label="门急诊" value="emergency" />
                <el-option label="门诊" value="outpatient" />
                <el-option label="住院" value="inpatient" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="医疗机构级别">
              <el-select v-model="form.hospitalLevel" placeholder="请选择" style="width: 100%">
                <el-option label="一级" value="1" />
                <el-option label="二级" value="2" />
                <el-option label="三级" value="3" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="16">
            <el-form-item label="诊断">
              <el-input v-model="form.diagnosis" placeholder="如：上呼吸道感染" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="16">
            <el-form-item label="医嘱内容">
              <el-input
                v-model="form.doctorOrder"
                type="textarea"
                :rows="3"
                placeholder="请输入医嘱内容"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <el-divider />

      <!-- 处方明细区 -->
      <div class="detail-section">
        <div class="detail-header">
          <span class="detail-title">处方明细</span>
          <el-button type="primary" :icon="Plus" @click="addDrugRow">
            添加药品
          </el-button>
        </div>

        <el-table :data="form.drugs" border class="detail-table">
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column label="药品名称" min-width="180">
            <template #default="{ row }">
              <el-input v-model="row.name" placeholder="请输入药品名称" />
            </template>
          </el-table-column>
          <el-table-column label="规格" width="140">
            <template #default="{ row }">
              <el-input v-model="row.spec" placeholder="如：0.5g*12片" />
            </template>
          </el-table-column>
          <el-table-column label="用法" width="120">
            <template #default="{ row }">
              <el-input v-model="row.usage" placeholder="如：口服" />
            </template>
          </el-table-column>
          <el-table-column label="频次" width="120">
            <template #default="{ row }">
              <el-input v-model="row.frequency" placeholder="如：每日三次" />
            </template>
          </el-table-column>
          <el-table-column label="单次剂量" width="100">
            <template #default="{ row }">
              <el-input v-model="row.dose" placeholder="剂量" />
            </template>
          </el-table-column>
          <el-table-column label="数量" width="100">
            <template #default="{ row }">
              <el-input-number
                v-model="row.quantity"
                :min="1"
                :max="999"
                controls-position="right"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center" fixed="right">
            <template #default="{ $index }">
              <el-button link type="danger" @click="removeDrugRow($index)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 底部操作区 -->
      <div class="footer-actions">
        <el-button @click="saveDraft">保存草稿</el-button>
        <el-button type="primary" @click="submitAudit">提交审核</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const form = reactive({
  patientId: '',
  patientKeyword: '',
  visitType: 'emergency',
  hospitalLevel: '2',
  diagnosis: '',
  doctorOrder: '',
  // 默认有一条空行
  drugs: [createEmptyDrug()]
})

const patientLoading = ref(false)
const patientOptions = ref([])

function createEmptyDrug() {
  return {
    name: '',
    spec: '',
    usage: '',
    frequency: '',
    dose: '',
    quantity: 1
  }
}

function addDrugRow() {
  form.drugs.push(createEmptyDrug())
}

function removeDrugRow(index) {
  // 至少保留一条空行
  if (form.drugs.length === 1) {
    form.drugs[0] = createEmptyDrug()
    return
  }
  form.drugs.splice(index, 1)
}

function searchPatient(query) {
  if (!query) return
  patientLoading.value = true
  // TODO: 调用真实患者搜索接口
  setTimeout(() => {
    patientOptions.value = [
      { id: '1', name: `患者-${query}-1` },
      { id: '2', name: `患者-${query}-2` }
    ]
    patientLoading.value = false
  }, 300)
}

function onSearchPatient() {
  searchPatient(form.patientKeyword)
}

function saveDraft() {
  ElMessage.success('草稿已保存')
  console.log('draft:', form)
}

function submitAudit() {
  // 简单校验：药品名不能为空
  const hasEmptyName = form.drugs.some((d) => !d.name.trim())
  if (hasEmptyName) {
    ElMessage.warning('请填写完整的药品信息')
    return
  }
  ElMessage.success('已提交审核')
  console.log('submit:', form)
}
</script>

<style scoped>
.prescription-page {
  padding: 20px;
  background: #f5f7fa;
  min-height: 100vh;
}

.prescription-card {
  max-width: 1200px;
  margin: 0 auto;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.base-form {
  margin-top: 8px;
}

.patient-item :deep(.el-form-item__content) {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
}

.detail-section {
  margin-top: 8px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.detail-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.detail-table {
  margin-bottom: 16px;
}

.detail-table :deep(.el-input__inner) {
  border-radius: 0;
}

.footer-actions {
  display: flex;
  justify-content: flex-start;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}
</style>
