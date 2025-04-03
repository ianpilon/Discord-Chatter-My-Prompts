# How to Create a Modern Documentation Site

This guide explains how to create a modern documentation site using Next.js and Nextra, similar to the Discord Digest documentation. The result will be a clean, searchable documentation site with dark mode support and excellent developer experience.

## Prerequisites

- Node.js installed on your system
- Basic understanding of React and Markdown
- Your documentation content (optional, can be added later)

## Step 1: Project Setup

1. Create a new directory for your documentation site:
```bash
mkdir docs-site
cd docs-site
```

2. Initialize a new Node.js project:
```bash
npm init -y
```

3. Update package.json with the following content:
```json
{
  "name": "your-project-docs",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "nextra": "^2.13.2",
    "nextra-theme-docs": "^2.13.2",
    "@tailwindcss/typography": "^0.5.10",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  },
  "devDependencies": {
    "@types/node": "^20.8.2",
    "@types/react": "^18.2.25",
    "typescript": "^5.2.2"
  }
}
```

4. Install dependencies:
```bash
npm install
```

## Step 2: Project Structure

Create the following directory structure:
```
docs-site/
├── src/
│   ├── pages/
│   │   ├── _app.js
│   │   ├── index.mdx
│   │   └── [...documentation pages].mdx
│   └── styles/
│       └── globals.css
├── public/
├── next.config.js
├── postcss.config.js
├── tailwind.config.js
└── theme.config.jsx
```

## Step 3: Configuration Files

1. Create next.config.js:
```javascript
const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.jsx',
  defaultShowCopyCode: true,
})

module.exports = withNextra({
  reactStrictMode: true,
})
```

2. Create theme.config.jsx:
```jsx
export default {
  logo: <span style={{ fontWeight: 'bold' }}>Your Project Docs</span>,
  project: {
    link: 'https://github.com/yourusername/your-project'
  },
  docsRepositoryBase: 'https://github.com/yourusername/your-project/tree/main/docs',
  useNextSeoProps() {
    return {
      titleTemplate: '%s – Your Project Documentation'
    }
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="Your Project - Developer Documentation" />
    </>
  ),
  navigation: {
    prev: true,
    next: true
  },
  footer: {
    text: \`Your Project Documentation \${new Date().getFullYear()}\`
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
```

3. Create postcss.config.js:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

4. Create tailwind.config.js:
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,jsx,ts,tsx,md,mdx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
    './theme.config.jsx'
  ],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
}
```

## Step 4: Styles and App Setup

1. Create src/styles/globals.css:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --nextra-primary-hue: 212;
  --nextra-navbar-height: 4rem;
  --nextra-menu-height: 3.75rem;
  --nextra-banner-height: 2.5rem;
}
```

2. Create src/pages/_app.js:
```javascript
import '../styles/globals.css'

export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}
```

## Step 5: Documentation Pages

1. Create src/pages/index.mdx as your home page:
```mdx
# Project Documentation

Welcome to the documentation. This guide provides comprehensive information about your application.

## Quick Links

- [Getting Started](/getting-started)
- [Architecture Overview](/architecture)
- [API Reference](/api-reference)
- [Deployment Guide](/deployment)

## Overview

Brief description of your project here...
```

2. Create additional .mdx files in src/pages for each section of your documentation:
- getting-started.mdx
- architecture.mdx
- api-reference.mdx
- deployment.mdx

## Step 6: Running the Site

1. Start the development server:
```bash
npm run dev
```

2. View your site at http://localhost:3000

## Documentation Features

Your documentation site now includes:

1. **Navigation**
   - Automatically generated sidebar
   - Previous/Next page navigation
   - Collapsible sections

2. **Search**
   - Full-text search across all documentation
   - Keyboard shortcuts (⌘K or CtrlK)

3. **UI Features**
   - Dark/Light mode toggle
   - Mobile responsive design
   - Table of contents
   - Code syntax highlighting
   - Copy code button

4. **Developer Experience**
   - MDX support (React components in Markdown)
   - Fast refresh in development
   - TypeScript support
   - SEO optimization

## Customization Tips

1. **Theme Colors**
   - Modify the primary hue in globals.css
   - Customize Tailwind theme in tailwind.config.js

2. **Navigation**
   - Control sidebar collapse level in theme.config.jsx
   - Add external links in navigation

3. **Components**
   - Create custom React components in src/components
   - Import and use them in MDX files

4. **Meta Information**
   - Update SEO settings in theme.config.jsx
   - Add custom meta tags per page

## Deployment

1. Build the site:
```bash
npm run build
```

2. Deploy to platforms like Vercel:
```bash
vercel
```

## Best Practices

1. **Organization**
   - Group related documentation in folders
   - Use clear, descriptive file names
   - Keep MDX files focused and concise

2. **Content**
   - Start with a clear overview
   - Include code examples
   - Use headings for structure
   - Add tables for complex information

3. **Maintenance**
   - Keep dependencies updated
   - Review and update content regularly
   - Test links and code examples

## Troubleshooting

Common issues and solutions:

1. **Build Errors**
   - Check PostCSS configuration
   - Verify Tailwind content paths
   - Ensure all dependencies are installed

2. **Styling Issues**
   - Clear .next directory
   - Check globals.css import
   - Verify Tailwind configuration

3. **Content Not Updating**
   - Check file extensions (.mdx)
   - Clear browser cache
   - Restart development server

## Resources

- [Nextra Documentation](https://nextra.site)
- [Next.js Documentation](https://nextjs.org/docs)
- [MDX Documentation](https://mdxjs.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
