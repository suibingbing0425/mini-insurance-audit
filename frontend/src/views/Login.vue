<template>
  <div class="login-wrap">
    <el-card class="login-card">
      <h2 class="title">mini医保智能审核系统</h2>
      <el-form :model="form" @keyup.enter="onLogin">
        <el-form-item>
          <el-input v-model="form.username" placeholder="账号" size="large" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" size="large" show-password />
        </el-form-item>
        <el-button type="primary" size="large" style="width: 100%" :loading="loading" @click="onLogin">
          登 录
        </el-button>
      </el-form>
      <p class="tip">测试账号：dr_wang/123456（医生）· admin_zheng/123456（管理员）</p>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { authApi } from '../api'
import { useUserStore } from '../store'

const router = useRouter()
const userStore = useUserStore()
const loading = ref(false)
const form = reactive({ username: '', password: '' })

async function onLogin() {
  if (!form.username || !form.password) return ElMessage.warning('请输入账号和密码')
  loading.value = true
  try {
    const data = await authApi.login({ ...form })
    userStore.setLogin(data.token, data.user)
    ElMessage.success('登录成功')
    router.push('/patients')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-wrap { height: 100vh; display: flex; align-items: center; justify-content: center; background: #f0f2f5; }
.login-card { width: 380px; padding: 10px 20px; }
.title { text-align: center; margin-bottom: 24px; color: #303133; }
.tip { color: #909399; font-size: 12px; margin-top: 16px; line-height: 1.6; }
</style>
