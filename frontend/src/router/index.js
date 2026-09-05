import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '../store'

const routes = [
  { path: '/login', name: 'Login', component: () => import('../views/Login.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    redirect: '/patients',
    children: [
      { path: 'patients', name: 'PatientList', component: () => import('../views/PatientList.vue'), meta: { title: '患者管理' } },
      { path: 'orders/create', name: 'OrderCreate', component: () => import('../views/OrderCreate.vue'), meta: { title: '模拟HIS开方', roles: ['doctor', 'admin'] } },
      { path: 'orders', name: 'OrderList', component: () => import('../views/OrderList.vue'), meta: { title: '医嘱审核列表' } },
      { path: 'rules', name: 'RuleManage', component: () => import('../views/RuleManage.vue'), meta: { title: '审核规则配置', roles: ['admin'] } },
      { path: 'audits', name: 'AuditList', component: () => import('../views/AuditList.vue'), meta: { title: '审核中心', roles: ['admin'] } },
      { path: 'audits/:id', name: 'AuditDetail', component: () => import('../views/AuditDetail.vue'), meta: { title: '审核详情', roles: ['admin'] } },
      { path: 'audit-logs', name: 'AuditLog', component: () => import('../views/AuditLog.vue'), meta: { title: '审核日志', roles: ['admin'] } },
      { path: 'stats', name: 'Stats', component: () => import('../views/Stats.vue'), meta: { title: '统计报表', roles: ['admin'] } },
      { path: 'users', name: 'UserManage', component: () => import('../views/UserManage.vue'), meta: { title: '人员管理', roles: ['admin'] } },
      { path: 'knowledge', name: 'KnowledgeManage', component: () => import('../views/KnowledgeManage.vue'), meta: { title: '医保政策知识库' } }
    ]
  }
]

const router = createRouter({ history: createWebHistory(), routes })

// 全局前置守卫：未登录跳登录页；角色不匹配跳患者管理
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  if (to.meta.public) return next()
  if (!userStore.token) return next('/login')
  if (to.meta.roles && !to.meta.roles.includes(userStore.role)) {
    return next('/patients')
  }
  next()
})

export default router
