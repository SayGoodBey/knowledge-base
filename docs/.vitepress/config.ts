import { defineConfig } from 'vitepress'

export default defineConfig({
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
            { text: '2026-05-07 · TCE + qGPU', link: '/daily/2026-05-07' },
            { text: '2026-05-08 · qGPU Checkpoint 僵尸分配', link: '/daily/2026-05-08' },
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
            { text: 'Node', link: '/topics/k8s/node/' },
            { text: 'Deployment', link: '/topics/k8s/deployment/' },
            { text: 'Pod', link: '/topics/k8s/pod/' },
            { text: 'PV/PVC', link: '/topics/k8s/pv-pvc/' },
            { text: 'Service', link: '/topics/k8s/service/' },
            { text: 'GPU 工作负载', link: '/topics/k8s/gpu/' },
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
