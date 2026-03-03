<template>
  <div class="help-view">
    <el-card shadow="never" class="hero">
      <h2>帮助中心（新手友好）</h2>
      <p>
        这是一个把“论文方法描述”自动转成图片的工具。你只需要输入方法内容和图注，系统会自动规划、出图、优化并保存到本地历史。
      </p>
    </el-card>

    <el-row :gutter="16">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="section">
          <h3>它是怎么工作的？</h3>
          <ol>
            <li><b>Planner：</b>先把你的文字整理成可画图的描述。</li>
            <li><b>Visualizer：</b>根据描述生成图像（统计图会用 Plotly 后端渲染）。</li>
            <li><b>Critic：</b>自动检查图像并给出修改建议，再迭代。</li>
            <li><b>History：</b>保存任务记录和图片，方便回看和重绘。</li>
          </ol>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="section">
          <h3>三种模式怎么选？</h3>
          <ul>
            <li><b>智能迭代（推荐）：</b>质量和速度平衡，适合大多数任务。</li>
            <li><b>全流程增强：</b>增加 Stylist 风格优化，质量更高但更慢。</li>
            <li><b>快速直出：</b>最快速试图，但稳定性和精细度较低。</li>
          </ul>
          <div class="mode-principle">
            <h4>模式原理（高级用户）</h4>
            <ul>
              <li><b>智能迭代：</b>Retriever -> Planner -> Visualizer -> Critic(多轮)。先出初稿，再按评审意见迭代修图。</li>
              <li><b>全流程增强：</b>Retriever -> Planner -> Stylist -> Visualizer -> Critic(多轮)。在初稿前加入风格规范步骤，降低版式与视觉不一致。</li>
              <li><b>快速直出：</b>Vanilla 单步生成。跳过检索/规划/评审，延迟最低，但对输入质量和模型稳定性更敏感。</li>
              <li><b>统计图（plot）机制：</b>先生成 Plotly 规范，再在后端渲染为图片并入库；diagram 任务则直接走图像模型。</li>
            </ul>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="never" class="section">
      <h3>小白 5 步上手</h3>
      <ol>
        <li>打开“生成候选图表”。</li>
        <li>粘贴方法节内容，填写图注。</li>
        <li>模式先选“智能迭代（推荐）”，候选数量建议 2-3。</li>
        <li>点击“开始生成”，等待候选结果出现。</li>
        <li>到“历史记录”里查看、下载，或点“重绘”继续优化。</li>
      </ol>
    </el-card>

    <el-card shadow="never" class="section">
      <h3>常见问题</h3>
      <ul>
        <li><b>图片不显示：</b>先看历史详情是否有候选成功，再检查后端是否在运行。</li>
        <li><b>生成很慢：</b>图像生成本身耗时较长，建议先减少候选数量或轮数。</li>
        <li><b>提示额度不足：</b>通常是模型 API 余额或配额不足，换模型或充值后重试。</li>
        <li><b>重启后任务丢失吗：</b>不会，系统会把中间状态写入本地 SQLite 并尝试续跑。</li>
      </ul>
    </el-card>
  </div>
</template>

<script setup>
</script>

<style scoped>
.help-view {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.hero h2 {
  margin: 0 0 8px;
  font-size: 20px;
}
.hero p {
  margin: 0;
  color: #4b5563;
  line-height: 1.7;
}
.section h3 {
  margin: 0 0 10px;
  font-size: 16px;
}
.section ul,
.section ol {
  margin: 0;
  padding-left: 18px;
  color: #374151;
  line-height: 1.8;
}
.mode-principle {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e5e7eb;
}
.mode-principle h4 {
  margin: 0 0 6px;
  font-size: 13px;
  color: #374151;
}
</style>
