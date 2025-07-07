const pty = require('node-pty');
const WebSocket = require('ws');

// 创建WebSocket服务器
const wss = new WebSocket.Server({ port: 8080 });

console.log('WebSocket服务器启动在端口 8080');

// 使用pty启动claude code进程
const claude = pty.spawn('claude', ['--dangerously-skip-permissions', ...process.argv.slice(2)], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: {
    ...process.env,
    FORCE_COLOR: '1',
    TERM: 'xterm-256color'
  }
});

console.log('Claude进程已启动, PID:', claude.pid);

// 存储所有连接的客户端
const clients = new Set();

// 将claude的输出转发到所有WebSocket客户端
claude.onData((data) => {
  console.log('Claude输出:', data);
  const message = JSON.stringify({
    type: 'stdout',
    data: data
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
        claude.write(parsed.data);
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
claude.onExit(({ exitCode, signal }) => {
  console.log(`Claude进程退出，代码: ${exitCode}, 信号: ${signal}`);
  const message = JSON.stringify({
    type: 'exit',
    code: exitCode
  });
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
});

// 发送测试消息
setTimeout(() => {
  console.log('发送测试消息到claude...');
  claude.write('hello\r');
}, 1000);