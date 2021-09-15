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
          link: '/blogs/classic-dtrans',
        },
        {
          text: 'Choose the right distributed transanction management solution',
          link: '/blogs/choose-dtrans',
        },
        {
          text: 'SAGA distributed transanction model in Go',
          link: '/blogs/go-saga',
        },
        {
          text: 'TCC distributed transanction model in Go',
          link: '/blogs/go-tcc',
        },
      ],
      '/examples/': 'auto',
      // catch-all fallback
      '/': [
        {
          text: 'Fundations',
          children: [
            {
              text: 'Distributed transanction management theory',
              link: '/guide/theory'
            },
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
          text: 'Overview',
          children: [
            {
              text: 'Architecture',
              link: '/summary/arch'
            },
            {
              text: 'Protocols',
              link: '/summary/protocol'
            },
            {
              text: 'Databases',
              link: '/summary/db'
            },
            {
              text: 'Source code',
              link: '/summary/code'
            },
          ]
        },
        {
          text: 'Practice',
          children: [
            {
              text: 'SAGA',
              link: '/practice/saga'
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
              text: 'Transanctional Messaging',
              link: '/practice/msg'
            },
            {
              text: 'Others',
              link: '/practice/other'
            },
            {
              text: 'Wait for results',
              link: '/practice/wait'
            },
            {
              text: 'Choose the right transanction model',
              link: '/practice/choice'
            }
          ]
        },
        {
          text: 'Exception handling',
          children: [
            {
              text: 'Exceptions',
              link: '/exception/exception'
            },
            {
              text: 'Subtransanction barrier',
              link: '/exception/barrier'
            }
          ]
        },
        {
          text: 'Deployment and maintenance',
          children: [
            {
              text: 'Basics',
              link: '/deploy/base'
            },
            {
              text: 'Docker deployment',
              link: '/deploy/docker'
            },
            {
              text: 'Online deployment',
              link: '/deploy/online'
            },
            {
              text: 'Direct deployment',
              link: '/deploy/direct'
            },
            {
              text: 'Maintenance',
              link: '/deploy/maintain'
            }
          ]
        },
        {
          text: 'Miscellaneous',
          children: [
            {
              text: 'Alternatives',
              link: '/other/opensource'
            },
            {
              text: 'Who uses DTM',
              link: '/other/using'
            }
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
