const { spawn } = require('child_process');
const WebSocket = require('ws');

// 创建WebSocket服务器
const wss = new WebSocket.Server({ port: 8080 });

console.log('WebSocket服务器启动在端口 8080');

// 启动claude code进程
const claude = spawn('claude', ['--dangerously-skip-permissions', ...process.argv.slice(2)], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { 
    ...process.env, 
    FORCE_COLOR: '1',
    TERM: 'xterm-256color'
  }
});

console.log('Claude进程已启动, PID:', claude.pid);

// 检查claude进程是否正常启动
claude.on('spawn', () => {
  console.log('Claude进程成功启动');
});

// 立即发送一个测试消息
setTimeout(() => {
  console.log('发送测试消息到claude...');
  claude.stdin.write('hello\n');
}, 1000);

// 存储所有连接的客户端
const clients = new Set();

// 将claude的stdout转发到所有WebSocket客户端
claude.stdout.on('data', (data) => {
  console.log('Claude stdout:', data.toString());
  const message = JSON.stringify({
    type: 'stdout',
    data: data.toString()
  });
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
});

// 将claude的stderr转发到所有WebSocket客户端
claude.stderr.on('data', (data) => {
  console.log('Claude stderr:', data.toString());
  const message = JSON.stringify({
    type: 'stderr',
    data: data.toString()
  });
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
});

// 处理WebSocket连接
wss.on('connection', (ws) => {
  console.log('新的WebSocket连接');
  clients.add(ws);
  
  // 接收来自WebSocket客户端的输入，转发给claude
  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      console.log('收到消息:', parsed);
      if (parsed.type === 'input') {
        console.log('发送到claude:', parsed.data);
        claude.stdin.write(parsed.data);
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

// 处理claude进程退出
claude.on('close', (code) => {
  console.log(`Claude进程退出，代码: ${code}`);
  // 通知所有连接的客户端
  const message = JSON.stringify({
    type: 'exit',
    code: code
  });
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
});

// 处理进程错误
claude.on('error', (error) => {
  console.error('Claude进程错误:', error);
  const message = JSON.stringify({
    type: 'error',
    data: error.message
  });
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
});