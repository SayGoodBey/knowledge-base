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
          { text: '☁️ 云原生 / K8s', link: '/topics/cloud-native/' },
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
            { text: '2026-10-28 · 为什么需要 Pod（成组调度）+ 容器设计模式 + 知识库消重', link: '/daily/2026-10-28' },
            { text: '2026-10-19 · 云原生公开课「Kubernetes 核心概念」', link: '/daily/2026-10-19' },
            { text: '2026-10-16 · kubeadm 部署 K8s 与网络底层（三种 IP / CNI / 虚拟网卡）', link: '/daily/2026-10-16' },
            { text: '2026-09-22 · npm workspaces esbuild 双版本 postinstall 冲突', link: '/daily/2026-09-22' },
            { text: '2026-09-15 · TCE Pod 调度失败排障（ENI-IP / ipset）', link: '/daily/2026-09-15' },
            { text: '2026-08-20 · Dragonfly P2P 镜像加速实战', link: '/daily/2026-08-20' },
            { text: '2026-08-13 · GraphRAG Leiden 社区检测算法', link: '/daily/2026-08-13' },
            { text: '2026-08-08 · Vector RAG 原理', link: '/daily/2026-08-08' },
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

      '/topics/cloud-native/': [
        {
          text: '☁️ 云原生',
          items: [
            { text: '概览 · 按主题找', link: '/topics/cloud-native/' },
            { text: '概述与发展简史', link: '/topics/cloud-native/overview' },
            { text: 'CNCF 全景图', link: '/topics/cloud-native/landscape' },
            { text: '容器技术（含 pause/init/sidecar）', link: '/topics/cloud-native/container' },
            { text: 'Dragonfly 镜像加速', link: '/topics/cloud-native/dragonfly' },
          ]
        },
        {
          text: '☸️ Kubernetes',
          items: [
            { text: '概览', link: '/topics/cloud-native/k8s/' },
            { text: '架构', link: '/topics/cloud-native/k8s/architecture/' },
            { text: '安装部署', link: '/topics/cloud-native/k8s/install/' },
            { text: 'API 基础', link: '/topics/cloud-native/k8s/api/' },
            { text: 'Node', link: '/topics/cloud-native/k8s/node/' },
            { text: 'Deployment', link: '/topics/cloud-native/k8s/deployment/' },
            { text: 'Pod', link: '/topics/cloud-native/k8s/pod/' },
            { text: 'PV/PVC', link: '/topics/cloud-native/k8s/pv-pvc/' },
            { text: 'Service', link: '/topics/cloud-native/k8s/service/' },
            { text: '网络', link: '/topics/cloud-native/k8s/network/' },
            { text: 'GPU 工作负载', link: '/topics/cloud-native/k8s/gpu/' },
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
            { text: 'RAG', link: '/topics/ai/rag/' },
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
}))
