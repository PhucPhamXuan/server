const NodeMediaServer = require('node-media-server');
const express = require('express');

const HTTP_PORT = process.env.PORT || 10000;
const RTMP_PORT = 1935;

// Config đơn giản - CHỈ RELAY, KHÔNG TRANS
const config = {
  logType: 3,
  
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  
  http: {
    port: 8000, // Port nội bộ cho NMS
    allow_origin: '*'
  }
  
  // KHÔNG dùng trans để tránh bug
};

const nms = new NodeMediaServer(config);

// Bắt lỗi bytesWritten (harmless bug)
process.on('uncaughtException', (err) => {
  if (err.message && err.message.includes('bytesWritten')) {
    // Ignore - đây là bug vô hại khi disconnect
    return;
  }
  console.error('❌ Uncaught Exception:', err);
});

// Event listeners
nms.on('preConnect', (id, args) => {
  console.log('🔌 Client connecting...', id);
});

nms.on('postConnect', (id, args) => {
  console.log('✅ Client connected:', id);
});

nms.on('doneConnect', (id, args) => {
  console.log('👋 Client disconnected:', id);
});

nms.on('prePublish', (id, StreamPath, args) => {
  console.log(`📡 Stream STARTED: ${StreamPath}`);
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log(`⏹️  Stream STOPPED: ${StreamPath}`);
});

nms.on('prePlay', (id, StreamPath, args) => {
  console.log(`▶️  Client PLAYING: ${StreamPath}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
  console.log(`⏸️  Client STOPPED playing: ${StreamPath}`);
});

// Start RTMP server
nms.run();

console.log('✅ RTMP Server started');

// HTTP API để Render không kill service
const app = express();

app.get('/', (req, res) => {
  const host = process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost';
  res.json({
    status: 'running',
    service: 'RTMP Relay Server',
    version: '1.0.0',
    instructions: {
      push_from_larix: `rtmp://${host}/live/YOUR_STREAM_KEY`,
      pull_in_obs: `rtmp://${host}/live/YOUR_STREAM_KEY`,
      example: {
        larix_url: `rtmp://${host}/live`,
        larix_key: 'mystream',
        obs_media_source: `rtmp://${host}/live/mystream`
      }
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

app.listen(HTTP_PORT, '0.0.0.0', () => {
  const host = process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost';
  console.log(`✅ HTTP API started on port: ${HTTP_PORT}`);
  console.log(`\n📋 Usage:`);
  console.log(`   Larix: rtmp://${host}/live/YOUR_KEY`);
  console.log(`   OBS:   rtmp://${host}/live/YOUR_KEY`);
  console.log(`   Info:  https://${host}/\n`);
});
