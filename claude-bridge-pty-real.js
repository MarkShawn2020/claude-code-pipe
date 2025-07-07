const pty = require('node-pty-prebuilt-multiarch');
const WebSocket = require('ws');

// 创建WebSocket服务器
const wss = new WebSocket.Server({ port: 8084 });

console.log('WebSocket服务器启动在端口 8084');

// 使用pty启动claude进程
const claude = pty.spawn('claude', ['--dangerously-skip-permissions'], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: {
    ...process.env,
    TERM: 'xterm-256color'
  }
});

console.log('Claude PTY进程启动, PID:', claude.pid);

// 存储所有连接的客户端
const clients = new Set();

// 处理claude的实时输出
claude.onData((data) => {
  console.log('Claude实时输出:', data);
  
  // 转发到所有客户端
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'realtime',
        data: data
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
        
        // 写入到pty
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

// 处理进程退出
claude.onExit(({ exitCode, signal }) => {
  console.log(`Claude进程退出，代码: ${exitCode}, 信号: ${signal}`);
  
  clients.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'exit',
        code: exitCode
      }));
    }
  });
});