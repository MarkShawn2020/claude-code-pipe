const { spawn } = require('child_process');
const WebSocket = require('ws');

// 创建WebSocket服务器
const wss = new WebSocket.Server({ port: 8080 });

console.log('WebSocket服务器启动在端口 8080');

// 启动一个持久的claude进程使用流式JSON
const claude = spawn('claude', [
  '--dangerously-skip-permissions',
  '--print',
  '--output-format', 'stream-json',
  '--input-format', 'stream-json'
], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { 
    ...process.env, 
    PYTHONUNBUFFERED: '1'
  }
});

console.log('启动流式Claude进程, PID:', claude.pid);

// 存储所有连接的客户端
const clients = new Set();

// 处理claude的实时输出
claude.stdout.on('data', (data) => {
  const chunk = data.toString();
  console.log('Claude流式输出:', chunk);
  
  // 解析流式JSON
  const lines = chunk.split('\n').filter(line => line.trim());
  lines.forEach(line => {
    try {
      const parsed = JSON.parse(line);
      // 转发到所有连接的客户端
      clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'claude-stream',
            data: parsed
          }));
        }
      });
    } catch (e) {
      // 可能是不完整的JSON行，忽略
    }
  });
});

claude.stderr.on('data', (data) => {
  const chunk = data.toString();
  console.log('Claude stderr:', chunk);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'stderr',
        data: chunk
      }));
    }
  });
});

// 处理claude进程退出
claude.on('close', (code) => {
  console.log(`Claude进程退出，代码: ${code}`);
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'exit',
        code: code
      }));
    }
  });
});

// 处理WebSocket连接
wss.on('connection', (ws) => {
  console.log('新的WebSocket连接');
  clients.add(ws);
  
  // 接收来自WebSocket客户端的输入
  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      console.log('收到消息:', parsed);
      if (parsed.type === 'input') {
        console.log('发送到claude:', parsed.data);
        
        // 构造流式JSON输入
        const streamInput = {
          type: 'message',
          content: parsed.data.trim()
        };
        
        const jsonLine = JSON.stringify(streamInput) + '\n';
        if (claude.stdin.writable) {
          claude.stdin.write(jsonLine);
        }
      }
    } catch (e) {
      console.error('解析消息失败:', e);
    }
  });
  
  // 处理连接关闭
  ws.on('close', () => {
    console.log('WebSocket连接关闭');
    clients.delete(ws);
  });
});