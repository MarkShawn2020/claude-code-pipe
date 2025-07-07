const { spawn } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');

// 创建WebSocket服务器
const wss = new WebSocket.Server({ port: 8082 });

console.log('WebSocket服务器启动在端口 8082');

// 存储所有连接的客户端
const clients = new Set();

// 创建命名管道
const pipeName = '/tmp/claude-pipe';
try {
  fs.unlinkSync(pipeName);
} catch (e) {
  // 文件不存在，忽略
}

// 启动script命令来记录终端会话
const scriptProcess = spawn('script', ['-f', pipeName], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, TERM: 'xterm-256color' }
});

console.log('Script进程启动, PID:', scriptProcess.pid);

// 在script环境中启动claude
setTimeout(() => {
  console.log('在script环境中启动claude...');
  scriptProcess.stdin.write('claude --dangerously-skip-permissions\n');
}, 1000);

// 监听命名管道的输出
let pipeWatcher = null;

function startPipeWatcher() {
  try {
    const stream = fs.createReadStream(pipeName);
    
    stream.on('data', (data) => {
      const output = data.toString();
      console.log('实时输出:', output);
      
      // 转发到所有客户端
      clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'realtime',
            data: output
          }));
        }
      });
    });
    
    stream.on('error', (err) => {
      console.error('管道读取错误:', err);
      setTimeout(startPipeWatcher, 1000);
    });
    
    pipeWatcher = stream;
  } catch (e) {
    console.error('启动管道监听失败:', e);
    setTimeout(startPipeWatcher, 1000);
  }
}

// 等待管道文件创建
setTimeout(startPipeWatcher, 2000);

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
        
        // 发送到script进程
        if (scriptProcess.stdin.writable) {
          scriptProcess.stdin.write(parsed.data);
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

// 清理函数
process.on('exit', () => {
  try {
    fs.unlinkSync(pipeName);
    if (scriptProcess) {
      scriptProcess.kill();
    }
  } catch (e) {
    // 忽略清理错误
  }
});