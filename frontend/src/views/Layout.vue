<template>
  <el-container class="layout">
    <el-aside width="210px" class="aside">
      <div class="logo">mini医保审核</div>
      <el-menu :default-active="$route.path" router background-color="#001529" text-color="#c9d1d9" active-text-color="#409eff">
        <el-menu-item index="/patients"><el-icon><User /></el-icon>患者管理</el-menu-item>
        <el-menu-item v-if="['doctor', 'admin'].includes(userStore.role)" index="/orders/create"><el-icon><EditPen /></el-icon>模拟HIS开方</el-menu-item>
        <el-menu-item index="/knowledge"><el-icon><Collection /></el-icon>医保知识库</el-menu-item>
        <el-menu-item v-if="userStore.role === 'admin'" index="/rules"><el-icon><Setting /></el-icon>审核规则配置</el-menu-item>
        <el-menu-item index="/orders"><el-icon><Document /></el-icon>事前提醒</el-menu-item>
        <el-menu-item v-if="userStore.role === 'admin'" index="/audits"><el-icon><Search /></el-icon>事中审核</el-menu-item>
        <el-menu-item v-if="userStore.role === 'admin'" index="/audit-logs"><el-icon><Clock /></el-icon>审核日志</el-menu-item>
        <el-menu-item v-if="userStore.role === 'admin'" index="/stats"><el-icon><DataAnalysis /></el-icon>统计报表</el-menu-item>
        <el-menu-item v-if="userStore.role === 'admin'" index="/users"><el-icon><UserFilled /></el-icon>人员管理</el-menu-item>
        
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <span class="page-title">{{ $route.meta.title || '' }}</span>
        <el-dropdown @command="onCommand">
          <span class="user-info">
            {{ userStore.userInfo?.name || '' }}（{{ roleText }}）
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>
      <el-main class="main"><router-view /></el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { useRouter } from 'vue-router'
import { useUserStore } from '../store'

const router = useRouter()
const userStore = useUserStore()

const roleMap = { doctor: '医生', admin: '管理员' }
const roleText = roleMap[userStore.role] || ''

function onCommand(cmd) {
  if (cmd === 'logout') {
    userStore.logout()
    router.push('/login')
  }
}
</script>

<style scoped>
.layout { height: 100vh; }
.aside { background: #001529; }
.logo { color: #fff; text-align: center; line-height: 60px; font-size: 16px; font-weight: 500; }
.aside :deep(.el-menu) { border-right: none; }
.header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; background: #fff; }
.page-title { font-size: 16px; font-weight: 500; }
.user-info { cursor: pointer; display: inline-flex; align-items: center; gap: 4px; color: #303133; }
.main { background: #f0f2f5; }
</style>
