module.exports = {
  title: 'DTM tutorial',
  description: 'A Distributed transaction framework in Go',
  lang: 'en-US',
  head: [
    ['link', { rel: 'icon', type: 'image/svg', href: '/dtm.svg' }],
    ['script', {},
      `
      var _hmt = _hmt || [];
      (function() {
        var hm = document.createElement("script");
        hm.src = "https://hm.baidu.com/hm.js?16273180c0c2741f6d6f7ca8f3f334e4";
        var s = document.getElementsByTagName("script")[0];
        s.parentNode.insertBefore(hm, s);
      })();
      `
    ]
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
      { text: 'Blog', link: 'https://medium.com/@dongfuye' },
      // { text: '示例', link: '/examples/' },
      { text: 'Github', link: 'https://github.com/dtm-labs/dtm' },
      { text: 'zhihu', link: 'https://www.zhihu.com/people/ye-dongfu' }
    ],
    sidebar: {
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
            },
            {
              text: '2-phase message example',
              link: '/guide/e-msg'
            },
            {
              text: 'SAGA example',
              link: '/guide/e-saga'
            },
            {
              text: 'TCC example',
              link: '/guide/e-tcc'
            },
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
              link: '/ref/projects'
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
              link: '/other/performance'
            },
            {
              text: 'Performance of Redis Engine',
              link: '/other/perform-redis'
            },
            // {
            //   text: 'Alternatives',
            //   link: '/other/opensource'
            // },
            {
              text: 'Who is Using',
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
