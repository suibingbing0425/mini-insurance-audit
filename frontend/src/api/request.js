import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '../router'
import { useUserStore } from '../store'

const request = axios.create({ baseURL: '/api', timeout: 10000 })

// 请求拦截器：自动带 token
request.interceptors.request.use(config => {
  const userStore = useUserStore()
  if (userStore.token) config.headers.Authorization = `Bearer ${userStore.token}`
  return config
})

// 响应拦截器：统一处理 code 与错误
request.interceptors.response.use(
  res => {
    const data = res.data
    if (data.code !== 0) {
      ElMessage.error(data.message || '请求失败')
      return Promise.reject(data)
    }
    return data.data // 直接返回业务数据，页面不用再包一层
  },
  err => {
    const status = err.response?.status
    if (status === 401) {
      const userStore = useUserStore()
      userStore.logout()
      ElMessage.warning('登录已过期，请重新登录')
      router.push('/login')
    } else if (status === 403) {
      ElMessage.error('无权限访问')
    } else {
      ElMessage.error(err.response?.data?.message || '网络错误')
    }
    return Promise.reject(err)
  }
)

export default request
