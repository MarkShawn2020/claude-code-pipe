const { spawn } = require('child_process');
const WebSocket = require('ws');

// 创建WebSocket服务器
const wss = new WebSocket.Server({ port: 8080 });

console.log('WebSocket服务器启动在端口 8080');

// 启动一个持久的claude进程
let claude = null;

function startClaude() {
  claude = spawn('claude', ['--dangerously-skip-permissions'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { 
      ...process.env, 
      PYTHONUNBUFFERED: '1',
      FORCE_COLOR: '1'
    }
  });
  
  console.log('启动持久的Claude进程, PID:', claude.pid);
  
  // 监听进程退出
  claude.on('close', (code) => {
    console.log(`Claude进程退出，代码: ${code}`);
    claude = null;
  });
  
  claude.on('error', (error) => {
    console.error('Claude进程错误:', error);
    claude = null;
  });
  
  return claude;
}

// 存储所有连接的客户端
const clients = new Set();

// 启动claude进程
startClaude();

// 处理WebSocket连接
wss.on('connection', (ws) => {
  console.log('新的WebSocket连接');
  clients.add(ws);
  
  // 如果claude进程不存在，重新启动
  if (!claude) {
    startClaude();
  }
  
  // 监听claude的实时输出
  const handleStdout = (data) => {
    const chunk = data.toString();
    console.log('Claude实时输出:', chunk);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'stdout',
        data: chunk
      }));
    }
  };
  
  const handleStderr = (data) => {
    const chunk = data.toString();
    console.log('Claude stderr:', chunk);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'stderr',
        data: chunk
      }));
    }
  };
  
  // 添加输出监听器
  if (claude) {
    claude.stdout.on('data', handleStdout);
    claude.stderr.on('data', handleStderr);
  }
  
  // 接收来自WebSocket客户端的输入
  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      console.log('收到消息:', parsed);
      if (parsed.type === 'input') {
        console.log('发送到claude:', parsed.data);
        
        // 如果claude进程不存在，重新启动
        if (!claude) {
          startClaude();
          if (claude) {
            claude.stdout.on('data', handleStdout);
            claude.stderr.on('data', handleStderr);
          }
        }
        
        if (claude && claude.stdin.writable) {
          claude.stdin.write(parsed.data);
          // 不要end()，保持流开放
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
    
    // 移除监听器
    if (claude) {
      claude.stdout.removeListener('data', handleStdout);
      claude.stderr.removeListener('data', handleStderr);
    }
  });
});