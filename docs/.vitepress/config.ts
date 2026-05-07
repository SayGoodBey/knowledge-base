import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Knowledge Base',
  description: '📚 每日学习记录与知识沉淀',
  base: '/knowledge-base/',
  
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '每日记录', link: '/daily/' },
      { text: 'AI', link: '/topics/ai/' },
      { text: 'K8s', link: '/topics/k8s/' },
    ],

    sidebar: {
      '/daily/': [
        {
          text: '📅 每日学习',
          items: [
            { text: '索引', link: '/daily/' }
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
          ]
        }
      ]
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
