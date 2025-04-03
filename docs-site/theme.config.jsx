export default {
  logo: <span style={{ fontWeight: 'bold' }}>Discord Digest Docs</span>,
  project: {
    link: 'https://github.com/yourusername/discord-digest'
  },
  docsRepositoryBase: 'https://github.com/yourusername/discord-digest/tree/main/docs',
  useNextSeoProps() {
    return {
      titleTemplate: '%s – Discord Digest Documentation'
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="Discord Digest - Developer Documentation" />
    </>
  ),
  navigation: {
    prev: true,
    next: true
  },
  footer: {
    text: `Discord Digest Documentation ${new Date().getFullYear()}`
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
