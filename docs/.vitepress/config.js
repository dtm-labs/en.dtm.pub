module.exports = {
  title: 'DTM tutorial',
  description: 'Distributed transaction management in Go',
  lang: 'en-US',
  head: [
    ['link', { rel: 'icon', type: 'image/svg', href: '/dtm.svg' }],
    ['script', { defer: true, type: 'text/javascript', src: 'https://v1.cnzz.com/z_stat.php?id=1280325584&web_id=1280325584' }]
  ],
  themeConfig: {
    logo: '/dtm.svg',

    // algolia: {
    //   apiKey: '<YOUR_CUSTOM_APP_ID>',
    //   indexName: 'dtm',
    //   searchParameters: {
    //     facetFilters: ['tags:cn']
    //   }
    // },

    nav: [
      { text: 'Guide', link: '/guide/start' },
      { text: '中文', link: 'https://dtm.pub' },
      { text: 'Blog', link: '/blogs/classic-dtrans' },
      // { text: '示例', link: '/examples/' },
      { text: 'Github', link: 'https://github.com/yedf/dtm' },
      { text: 'zhihu', link: 'https://www.zhihu.com/people/ye-dongfu' }
    ],
    sidebar: {
      '/blogs/': [
        {
          text: 'The seven classic solutions for distributed transanction management',
          link: 'https://medium.com/@dongfuye/the-seven-most-classic-solutions-for-distributed-transaction-management-3f915f331e15',
        },
      ],
      '/examples/': 'auto',
      // catch-all fallback
      '/': [
        {
          text: 'Fundations',
          children: [
            {
              text: 'Installation',
              link: '/guide/install'
            },
            {
              text: 'Why DTM',
              link: '/guide/why'
            },
            {
              text: 'Start here',
              link: '/guide/start'
            }
          ]
        },
        {
          text: 'Theory & Practice',
          children: [
            {
              text: 'Theory',
              link: '/practice/theory'
            },
            {
              text: 'Architecture',
              link: '/practice/arch'
            },
            {
              text: 'SAGA',
              link: '/practice/saga'
            },
            {
              text: '2-phase MSG',
              link: '/practice/msg'
            },
            {
              text: 'TCC',
              link: '/practice/tcc'
            },
            {
              text: 'XA',
              link: '/practice/xa'
            },
            {
              text: 'Other',
              link: '/practice/other'
            },
            {
              text: 'Exception & Solution',
              link: '/practice/barrier'
            },
            {
              text: 'Must Succeed',
              link: '/practice/must-succeed'
            },
            {
              text: 'Choose the right solution',
              link: '/practice/choice'
            },
          ]
        },
        {
          text: 'Application',
          children: [
            {
              text: 'Introduction',
              link: '/app/intro'
            },
            {
              text: 'Order',
              link: '/app/order'
            },
            {
              text: 'Flash Sale',
              link: '/app/flash'
            },
            {
              text: 'Cache Consistency',
              link: '/app/cache'
            },
          ]
        },
        {
          text: 'Access DTM',
          children: [
            {
              text: 'SDK',
              link: '/ref/sdk'
            },
            {
              text: 'Transaction Options',
              link: '/ref/options'
            },
            {
              text: 'Storage',
              link: '/ref/store'
            },
            {
              text: 'Supported Protocols',
              link: '/ref/proto'
            },
            {
              text: 'More Features',
              link: '/ref/feature'
            },
            {
              text: 'HTTP Reference',
              link: '/ref/http'
            },
            {
              text: 'Projects',
              link: '/ref/prejects'
            },
            {
              text: 'Go-zero Access',
              link: '/ref/go-zero'
            },
          ]
        },
        {
          text: 'Deployment',
          children: [
            {
              text: 'Base',
              link: '/deploy/base'
            },
            {
              text: 'Deploy',
              link: '/deploy/deploy'
            },
            {
              text: 'Maintenance',
              link: '/deploy/maintain'
            },
            {
              text: 'Upgrade',
              link: '/deploy/upgrade'
            },
          ]
        },
        {
          text: 'Miscellaneous',
          children: [
            {
              text: 'How to develop',
              link: '/other/develop'
            },
            {
              text: 'Performance of Mysql Engine',
              link: '/other/mysql'
            },
            {
              text: 'Performance of Redis Engine',
              link: '/other/redis'
            },
            {
              text: 'Alternatives',
              link: '/other/opensource'
            },
            {
              text: 'Who uses DTM',
              link: '/other/using'
            },
          ]
        },
      ]
    }
  },
  markdown: {
    anchor: {
      renderPermalink: require('./render-perma-link')
    },
    config: (md) => {
      md.use(require('./markdown-it-custom-anchor'))
    }
  }
}
