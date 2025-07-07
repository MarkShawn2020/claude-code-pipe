const { spawn } = require('child_process');
const WebSocket = require('ws');

// 创建WebSocket服务器
const wss = new WebSocket.Server({ port: 8080 });

console.log('WebSocket服务器启动在端口 8080');

// 启动claude code进程
const claude = spawn('claude', ['--dangerously-skip-permissions', ...process.argv.slice(2)], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, FORCE_COLOR: '1' }
});

console.log('Claude进程已启动');

// 处理WebSocket连接
wss.on('connection', (ws) => {
  console.log('新的WebSocket连接');
  
  // 将claude的stdout转发到WebSocket客户端
  claude.stdout.on('data', (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'stdout',
        data: data.toString()
      }));
    }
  });
  
  // 将claude的stderr转发到WebSocket客户端
  claude.stderr.on('data', (data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'stderr',
        data: data.toString()
      }));
    }
  });
  
  // 接收来自WebSocket客户端的输入，转发给claude
  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'input') {
        claude.stdin.write(parsed.data);
      }
    } catch (e) {
      console.error('解析消息失败:', e);
    }
  });
  
  // 处理连接关闭
  ws.on('close', () => {
    console.log('WebSocket连接关闭');
  });
});

// 处理claude进程退出
claude.on('close', (code) => {
  console.log(`Claude进程退出，代码: ${code}`);
  // 通知所有连接的客户端
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'exit',
        code: code
      }));
    }
  });
});

// 处理进程错误
claude.on('error', (error) => {
  console.error('Claude进程错误:', error);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'error',
        data: error.message
      }));
    }
  });
});