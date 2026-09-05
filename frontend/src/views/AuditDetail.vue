<template>
  <div>
    <el-card v-if="rec">
      <template #header>审核记录 {{ rec.audit_no || ('#' + rec.id) }}</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="患者">{{ rec.order?.patient?.name }}</el-descriptions-item>
        <el-descriptions-item label="诊断">{{ rec.order?.diagnosis }}</el-descriptions-item>
        <el-descriptions-item label="医嘱状态">
          {{ { draft: '草稿', submitted: '已提交', audited: '审核通过', rejected: '已拒绝' }[rec.order?.status] }}
        </el-descriptions-item>
        <el-descriptions-item label="命中规则">{{ rec.rule?.name || '自动通过' }}</el-descriptions-item>
        <el-descriptions-item label="审核结果">
          <el-tag :type="rec.status === 'reject' ? 'danger' : rec.status === 'warn' ? 'warning' : 'success'">
            {{ { pass: '通过', warn: '提醒', reject: '拒绝' }[rec.status] }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="处理人">{{ rec.auditor?.name || '未处理' }}</el-descriptions-item>
        <el-descriptions-item label="已有反馈" :span="2"><span class="detail-long-text">{{ rec.feedback || '暂无' }}</span></el-descriptions-item>
      </el-descriptions>

      <!-- 命中规则明细：逐条展开引擎产出的结构化违规（含法规依据/处理建议） -->
      <el-divider>命中规则明细（{{ hitRecords.length }} 条）</el-divider>
      <div v-if="hitRecords.length" class="hit-list">
        <el-card v-for="(h, i) in hitRecords" :key="h.id" class="hit-card" shadow="never">
          <template #header>
            <div class="hit-head">
              <span class="hit-index">#{{ i + 1 }}</span>
              <span class="hit-name">{{ h.rule?.name || h.details?.rule_name || '自动通过' }}</span>
              <el-tag :type="h.status === 'reject' ? 'danger' : 'warning'" size="small">
                {{ { warn: '提醒', reject: '驳回' }[h.status] || h.status }}
              </el-tag>
              <span class="hit-code">{{ h.details?.rule_code || '' }}</span>
            </div>
          </template>
          <div class="hit-body">
            <div class="hit-row"><span class="hit-label">违规说明</span><span class="detail-long-text">{{ h.details?.reason || h.message }}</span></div>
            <div v-if="h.details?.legal_basis" class="hit-row"><span class="hit-label">法规依据</span><span class="detail-long-text">{{ h.details.legal_basis }}</span></div>
            <div v-if="h.details?.suggestion" class="hit-row"><span class="hit-label">处理建议</span><span class="detail-long-text">{{ h.details.suggestion }}</span></div>
            <div class="hit-row"><span class="hit-label">命中时间</span><span>{{ formatTime(h.created_at) }}</span></div>
          </div>
        </el-card>
      </div>
      <el-empty v-else description="本次审核未命中任何规则" />

      <el-divider>人工复核</el-divider>
      <el-input v-if="userStore.role === 'admin'" v-model="feedback" type="textarea" :rows="3" placeholder="填写复核意见（保存后写入审核日志，满足监管追溯）" />
      <el-alert v-else type="warning" :closable="false" style="margin-bottom: 12px"
        title="仅管理员可操作" description="您当前无复核权限，可查看详情但不能填写反馈。" />
      <div style="margin-top: 12px; display: flex; gap: 10px; flex-wrap: wrap">
        <el-button v-if="userStore.role === 'admin'" type="success" :loading="saving" :disabled="!feedback.trim()" @click="onReview('pass')">通过</el-button>
        <el-button v-if="userStore.role === 'admin'" type="danger" :loading="saving" :disabled="!feedback.trim()" @click="onReview('reject')">驳回</el-button>
        <el-button v-if="userStore.role === 'admin'" @click="onSave">反馈</el-button>
        <el-button @click="router.back()">返回</el-button>
      </div>
    </el-card>

    <el-card v-if="logs.length" style="margin-top: 16px">
      <template #header>操作日志流水</template>
      <el-timeline>
        <el-timeline-item v-for="log in logs" :key="log.id" :timestamp="formatTime(log.created_at)">
          【{{ actionText(log.action) }}】{{ log.operator?.name || '系统' }}：{{ log.content }}
        </el-timeline-item>
      </el-timeline>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { auditApi } from '../api'
import { useUserStore } from '../store'

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const rec = ref(null)
const logs = ref([])
const feedback = ref('')
const saving = ref(false)

const actionMap = { submit: '提交审核', pass: '自动通过', audit: '审核', feedback: '人工反馈', reject: '驳回' }
const actionText = a => actionMap[a] || a

// 命中规则明细：后端 detail 接口已按 order_id 聚合本次提交的全部 warn/reject 审核记录
const hitRecords = computed(() => {
  if (!rec.value || !Array.isArray(rec.value.hitRecords)) return []
  return rec.value.hitRecords
})

async function onSave() {
  if (!feedback.value.trim()) return ElMessage.warning('请填写反馈内容')
  saving.value = true
  try {
    await auditApi.feedback(rec.value.id, { feedback: feedback.value.trim() })
    ElMessage.success('反馈已保存')
    feedback.value = ''
    await load()
  } finally {
    saving.value = false
  }
}

async function onReview(decision) {
  if (!rec.value) return
  saving.value = true
  try {
    await auditApi.review(rec.value.id, { decision, feedback: feedback.value.trim() || null })
    ElMessage.success(decision === 'pass' ? '已复核通过，医嘱置为审核通过' : '已复核驳回，医嘱置为已拒绝')
    await load()
  } finally {
    saving.value = false
  }
}

async function load() {
  rec.value = await auditApi.detail(route.params.id)
  feedback.value = rec.value.feedback || ''
  if (rec.value.order_id) logs.value = await auditApi.logs(rec.value.order_id)
}

function formatTime(str) {
  if (!str) return '-'
  const d = new Date(str)
  return d.toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
}

onMounted(() => load())
</script>

<style scoped>
.detail-long-text {
  display: inline-block;
  max-width: 100%;
  line-height: 1.6;
  word-break: break-all;
  white-space: pre-wrap;
}
.hit-list { display: flex; flex-direction: column; gap: 12px; }
.hit-card { border: 1px solid #ebeef5; }
.hit-head { display: flex; align-items: center; gap: 10px; }
.hit-index { color: #909399; font-weight: bold; }
.hit-name { font-weight: 600; color: #303133; flex: 1; }
.hit-code { color: #c0c4cc; font-size: 12px; }
.hit-body { display: flex; flex-direction: column; gap: 8px; }
.hit-row { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; line-height: 1.6; }
.hit-label { flex-shrink: 0; width: 72px; color: #909399; text-align: right; }
.hit-row > .detail-long-text,
.hit-row > span:last-child { color: #606266; }
</style>
