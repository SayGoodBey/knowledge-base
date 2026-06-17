import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  title: 'Knowledge Base',
  description: '📚 每日学习记录与知识沉淀',
  base: '/knowledge-base/',

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '每日记录', link: '/daily/' },
      {
        text: '主题',
        items: [
          { text: '🎨 前端', link: '/topics/frontend/' },
          { text: '🚀 项目', link: '/topics/projects/' },
          { text: '🔧 DevOps', link: '/topics/devops/' },
          { text: '☸️ K8s', link: '/topics/k8s/' },
          { text: '☁️ 云原生', link: '/topics/cloud-native/' },
          { text: '🤖 AI', link: '/topics/ai/' },
        ]
      },
    ],

    sidebar: {
      '/daily/': [
        {
          text: '📅 每日学习',
          items: [
            { text: '索引', link: '/daily/' },
            { text: '2026-06-17 · K8s 11个核心概念系统学习', link: '/daily/2026-06-17' },
            { text: '2026-06-01 · cbc -p slash 命令真值 & v0.3.1 方案 E', link: '/daily/2026-06-01' },
            { text: '2026-05-25 · 新机器搭建知识沉淀环境 & Skill 安装规范', link: '/daily/2026-05-25' },
            { text: '2026-05-21 · Next 16 升级 build RangeError 排查', link: '/daily/2026-05-21' },
            { text: '2026-05-19 · 容器进阶 + K8s 核心概念', link: '/daily/2026-05-19' },
            { text: '2026-05-18 · 云原生学习模块启动', link: '/daily/2026-05-18' },
            { text: '2026-05-11 · pdfmake getBlob API 变更排查', link: '/daily/2026-05-11' },
            { text: '2026-05-09 · DRMS PDF 方案对比 & 合并分支后白屏排查', link: '/daily/2026-05-09' },
            { text: '2026-05-08 · qGPU 僵尸分配 & Next HMR 被 socket.io 误杀', link: '/daily/2026-05-08' },
            { text: '2026-05-07 · TCE + qGPU', link: '/daily/2026-05-07' },
          ]
        }
      ],

      '/topics/frontend/': [
        {
          text: '🎨 前端开发',
          items: [
            { text: '概览', link: '/topics/frontend/' },
            { text: 'React', link: '/topics/frontend/react/' },
            { text: 'Next.js', link: '/topics/frontend/next/' },
            { text: 'TypeScript', link: '/topics/frontend/typescript/' },
            { text: '构建工具', link: '/topics/frontend/build-tools/' },
            { text: '样式方案', link: '/topics/frontend/styling/' },
            { text: '国际化 i18n', link: '/topics/frontend/i18n/' },
            { text: '状态管理', link: '/topics/frontend/state/' },
            { text: '测试', link: '/topics/frontend/testing/' },
            { text: '性能优化', link: '/topics/frontend/performance/' },
          ]
        }
      ],

      '/topics/projects/': [
        {
          text: '🚀 业务项目',
          items: [
            { text: '概览', link: '/topics/projects/' },
            { text: '集群管理控制台', link: '/topics/projects/cluster-console/' },
            { text: 'DRMS 容灾系统', link: '/topics/projects/drms/' },
          ]
        }
      ],

      '/topics/devops/': [
        {
          text: '🔧 DevOps 与工程化',
          items: [
            { text: '概览', link: '/topics/devops/' },
            { text: 'CI/CD', link: '/topics/devops/ci-cd/' },
            { text: 'Git', link: '/topics/devops/git/' },
            { text: '代码质量', link: '/topics/devops/code-quality/' },
            { text: '自动化', link: '/topics/devops/automation/' },
          ]
        }
      ],

      '/topics/k8s/': [
        {
          text: '☸️ Kubernetes',
          items: [
            { text: '概览', link: '/topics/k8s/' },
            { text: '架构', link: '/topics/k8s/architecture/' },
            { text: 'API 基础', link: '/topics/k8s/api/' },
            { text: 'Node', link: '/topics/k8s/node/' },
            { text: 'Deployment', link: '/topics/k8s/deployment/' },
            { text: 'Pod', link: '/topics/k8s/pod/' },
            { text: 'PV/PVC', link: '/topics/k8s/pv-pvc/' },
            { text: 'Service', link: '/topics/k8s/service/' },
            { text: 'GPU 工作负载', link: '/topics/k8s/gpu/' },
          ]
        }
      ],

      '/topics/cloud-native/': [
        {
          text: '☁️ 云原生学习',
          items: [
            { text: '概览', link: '/topics/cloud-native/' },
            { text: '概述与发展简史', link: '/topics/cloud-native/overview' },
            { text: 'CNCF 全景图', link: '/topics/cloud-native/landscape' },
            { text: '容器技术', link: '/topics/cloud-native/container' },
            { text: 'K8s 核心概念', link: '/topics/cloud-native/k8s-core' },
            { text: 'K8s 进阶', link: '/topics/cloud-native/k8s-advanced' },
            { text: '服务网格', link: '/topics/cloud-native/service-mesh' },
            { text: '可观测性', link: '/topics/cloud-native/observability' },
            { text: 'CI/CD 与 GitOps', link: '/topics/cloud-native/gitops' },
          ]
        }
      ],

      '/topics/ai/': [
        {
          text: '🤖 AI',
          items: [
            { text: '概览', link: '/topics/ai/' },
            { text: '工作流', link: '/topics/ai/workflow/' },
            { text: 'MCP', link: '/topics/ai/mcp/' },
            { text: 'Skill', link: '/topics/ai/skill/' },
          ]
        }
      ],
    },

    search: {
      provider: 'local'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/SayGoodBey/knowledge-base' }
    ],

    footer: {
      message: '持续学习，每天进步 🚀',
    }
  }
})
