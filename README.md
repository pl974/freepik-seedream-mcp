# Freepik Seedream MCP Server

[![smithery badge](https://smithery.ai/badge/thib/freepik-seedream-mcp)](https://smithery.ai/server/thib/freepik-seedream-mcp)

MCP server for Freepik API with **Seedream 4.0** support, optimized for Smithery deployment.

## Features

### Seedream 4.0 (ByteDance)
- **`seedream_generate`** - Generate images from text (up to 4K)
- **`seedream_edit`** - Edit images with natural language
- **`seedream_status`** - Check generation status

### Freepik Stock
- **`search_resources`** - Search photos, vectors, PSDs
- **`get_resource`** - Get resource details
- **`download_resource`** - Get download URLs

### Mystic AI (Legacy)
- **`mystic_generate`** - Generate with Freepik Mystic

## Requirements

- Node.js 18+
- Freepik API Key ([Get one here](https://www.freepik.com/api))
- Freepik Premium+ subscription (for Seedream 4)

## Local Development

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build
npm run build
```

## Deploy to Smithery

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/freepik-seedream-mcp.git
git push -u origin main
```

### 2. Deploy on Smithery

1. Go to [smithery.ai](https://smithery.ai)
2. Connect your GitHub account
3. Select your repository
4. Click **Deploy**

You'll get a URL like:
```
https://server.smithery.ai/YOUR_USER/freepik-seedream-mcp/mcp
```

### 3. Connect to Claude Online

1. Go to [claude.ai](https://claude.ai) → Settings → Connectors
2. Click "Add custom connector"
3. Enter:
   - **Name**: Freepik Seedream
   - **URL**: Your Smithery URL
4. When prompted, enter your Freepik API Key

## Usage Examples

### Generate an image
```
"Generate a cyberpunk city at night with neon lights"
```

### Edit an image
```
"Add a sunset sky to this image: https://example.com/photo.jpg"
```

### Search stock photos
```
"Search for business meeting photos"
```

## API Pricing

| Feature | Cost |
|---------|------|
| Seedream 4 | Included with Premium+ |
| Stock Downloads | Included with subscription |
| API Calls | Free tier available |

## License

MIT