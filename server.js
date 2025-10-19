const RtmpServer = require('rtmp-server');
const express = require('express');

const PORT = process.env.PORT || 10000;
const RTMP_PORT = 1935;

// Tạo RTMP server
const rtmpServer = new RtmpServer();

// Lắng nghe sự kiện
rtmpServer.on('client', (client) => {
  console.log('📱 Client connected:', client.id);
  
  client.on('connect', () => {
    console.log('✅ Client handshake complete');
  });
  
  client.on('play', ({ streamName }) => {
    console.log(`▶️  Client playing stream: ${streamName}`);
  });
  
  client.on('publish', ({ streamName }) => {
    console.log(`📡 Client publishing stream: ${streamName}`);
  });
  
  client.on('stop', () => {
    console.log('⏹️  Client stopped streaming');
  });
  
  client.on('close', () => {
    console.log('👋 Client disconnected');
  });
  
  client.on('error', (err) => {
    console.error('❌ Client error:', err.message);
  });
});

// Start RTMP server
rtmpServer.listen(RTMP_PORT, () => {
  console.log('✅ RTMP Server started on port:', RTMP_PORT);
});

// Tạo HTTP server để Render không kill service
const app = express();

app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'RTMP Relay Server',
    rtmp_url: `rtmp://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}/live`,
    instructions: {
      larix: 'Push to rtmp://HOST/live/YOUR_STREAM_KEY',
      obs_pull: 'Media Source -> rtmp://HOST/live/YOUR_STREAM_KEY'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HTTP Server started on port: ${PORT}`);
  console.log(`\n📋 Server Info:`);
  console.log(`   RTMP URL: rtmp://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}/live/stream`);
  console.log(`   HTTP API: https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'localhost'}\n`);
});

// Handle errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
});
