export default {
  logo: <span style={{ fontWeight: 'bold' }}>Create Modern Docs</span>,
  project: {
    link: 'https://github.com/yourusername/docs-creation-guide'
  },
  docsRepositoryBase: 'https://github.com/yourusername/docs-creation-guide/tree/main',
  useNextSeoProps() {
    return {
      titleTemplate: '%s – Create Modern Documentation'
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="Learn how to create modern documentation sites with Next.js and Nextra" />
    </>
  ),
  navigation: {
    prev: true,
    next: true
  },
  footer: {
    text: 'Create Modern Documentation Guide ' + new Date().getFullYear()
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true
  },
  toc: {
    float: true,
    title: 'On This Page'
  }
}
