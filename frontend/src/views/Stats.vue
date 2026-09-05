<template>
  <div>
    <el-row :gutter="16">
      <el-col :span="9">
        <el-card v-loading="loading">
          <template #header>违规趋势（按天）</template>
          <div ref="lineRef" style="height: 320px"></div>
        </el-card>
      </el-col>
      <el-col :span="15">
        <el-card v-loading="loading">
          <template #header>违规类型分布</template>
          <div ref="pieRef" style="height: 320px"></div>
        </el-card>
      </el-col>
    </el-row>
    <el-card style="margin-top: 16px" v-loading="loading">
      <template #header>科室违规排行</template>
      <div ref="barRef" style="height: 300px"></div>
    </el-card>

    <el-card style="margin-top: 16px" v-loading="loading">
      <template #header>规则命中质量（触发频次 / 硬性拦截率）</template>
      <el-table :data="quality" border stripe size="small" empty-text="暂无数据">
        <el-table-column prop="rule_code" label="规则编号" width="120" />
        <el-table-column prop="rule_name" label="规则名称" min-width="180" show-overflow-tooltip />
        <el-table-column label="级别" width="90">
          <template #default="{ row }">
            <el-tag :type="row.severity === 'reject' ? 'danger' : 'warning'" size="small">
              {{ row.severity === 'reject' ? '拒绝' : '提醒' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="触发次数" width="110" prop="total" sortable align="center" />
        <el-table-column label="硬性拦截" width="110" prop="rejectCount" sortable align="center" />
        <el-table-column label="拦截率" width="140" align="center" sortable :sort-by="row => row.rejectRate">
          <template #default="{ row }">
            <el-progress :percentage="row.rejectRate" :stroke-width="10"
              :status="row.rejectRate >= 50 ? 'exception' : ''" />
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { statsApi } from '../api'

const lineRef = ref(null)
const pieRef = ref(null)
const barRef = ref(null)
const quality = ref([])
const loading = ref(false)
let lineChart, pieChart, barChart

// 根据返回的日期范围补全缺失的天，保证趋势图连续（无数据填 0）
function fillDays(byDay = []) {
  if (!byDay.length) return { days: [], counts: [] }
  const sorted = [...byDay].sort((a, b) => a.day.localeCompare(b.day))
  const start = sorted[0].day
  const end = sorted[sorted.length - 1].day
  const countMap = new Map(byDay.map(d => [d.day, Number(d.count) || 0]))
  const result = []
  const [sy, sm, sd] = start.split('-').map(Number)
  const cur = new Date(sy, sm - 1, sd)
  const [ey, em, ed] = end.split('-').map(Number)
  const endDate = new Date(ey, em - 1, ed)
  while (cur <= endDate) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = String(cur.getDate()).padStart(2, '0')
    const full = `${y}-${m}-${d}`
    result.push({ day: `${m}-${d}`, count: countMap.get(full) || 0 })
    cur.setDate(cur.getDate() + 1)
  }
  return { days: result.map(r => r.day), counts: result.map(r => r.count) }
}

onMounted(async () => {
  loading.value = true
  lineChart = echarts.init(lineRef.value)
  pieChart = echarts.init(pieRef.value)
  barChart = echarts.init(barRef.value)

  try {
    const vio = await statsApi.violations()
    const dist = await statsApi.ruleDistribution()
    quality.value = await statsApi.ruleQuality()

    const { days, counts } = fillDays(vio.byDay || [])

    lineChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: days },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{
        type: 'line',
        smooth: true,
        name: '违规数',
        data: counts,
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(64,158,255,0.5)' },
            { offset: 1, color: 'rgba(64,158,255,0.05)' }
          ])
        },
        itemStyle: { color: '#409eff' }
      }]
    })

    const pieData = (dist || [])
      .map(d => ({ name: d.rule_name || '未命名规则', value: Number(d.count) || 0 }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value)

    const pieTotal = pieData.reduce((s, d) => s + d.value, 0)
    pieChart.setOption({
      color: ['#5b8ff9', '#5ad8a6', '#5d7092', '#f6bd16', '#e8684a', '#6dc8ec', '#9270ca', '#ff9d4d', '#269a99', '#ff99c3'],
      tooltip: {
        trigger: 'item',
        formatter: p => `${p.name}<br/>违规数：${p.value}（${p.percent}%）`
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 0,
        top: 'middle',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { width: 110, overflow: 'truncate' },
        tooltip: { show: true }
      },
      series: [{
        type: 'pie',
        radius: ['42%', '62%'],
        center: ['38%', '50%'],
        minAngle: 4,
        avoidLabelOverlap: true,
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          color: '#606266',
          lineHeight: 16
        },
        labelLine: { show: true, length: 12, length2: 8 },
        data: pieData
      }]
    })

    const byDept = (vio.byDept || []).map(d => ({
      name: d.dept_name || '未分配科室',
      value: Number(d.count) || 0
    }))

    barChart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
      xAxis: {
        type: 'category',
        data: byDept.map(d => d.name),
        axisLabel: { interval: 0, rotate: 25, color: '#606266' }
      },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{
        type: 'bar',
        barWidth: 32,
        data: byDept.map(d => d.value),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#67c23a' },
            { offset: 1, color: '#409eff' }
          ]),
          borderRadius: [4, 4, 0, 0]
        }
      }]
    })
  } finally {
    loading.value = false
  }
})

function resize() {
  lineChart?.resize()
  pieChart?.resize()
  barChart?.resize()
}
window.addEventListener('resize', resize)
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  lineChart?.dispose()
  pieChart?.dispose()
  barChart?.dispose()
})
</script>
