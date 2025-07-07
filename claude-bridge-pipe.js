const { spawn } = require('child_process');
const WebSocket = require('ws');
const fs = require('fs');

// 创建WebSocket服务器
const wss = new WebSocket.Server({ port: 8083 });

console.log('WebSocket服务器启动在端口 8083');

// 存储所有连接的客户端
const clients = new Set();

// 创建命名管道
const inputPipe = '/tmp/claude-input';
const outputPipe = '/tmp/claude-output';

try {
  fs.unlinkSync(inputPipe);
  fs.unlinkSync(outputPipe);
} catch (e) {
  // 文件不存在，忽略
}

// 创建命名管道
spawn('mkfifo', [inputPipe]);
spawn('mkfifo', [outputPipe]);

console.log('创建命名管道:', inputPipe, outputPipe);

// 启动claude进程，使用tee将输出同时写入管道
setTimeout(() => {
  console.log('启动claude进程...');
  
  // 使用bash启动复杂的管道命令
  const bashCommand = `cat ${inputPipe} | claude --dangerously-skip-permissions | tee ${outputPipe}`;
  
  const bashProcess = spawn('bash', ['-c', bashCommand], {
    stdio: ['inherit', 'inherit', 'inherit']
  });
  
  console.log('Bash进程启动, PID:', bashProcess.pid);
}, 1000);

// 监听输出管道
setTimeout(() => {
  console.log('开始监听输出管道...');
  
  const outputStream = fs.createReadStream(outputPipe);
  
  outputStream.on('data', (data) => {
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
  
  outputStream.on('error', (err) => {
    console.error('输出管道读取错误:', err);
  });
}, 2000);

// 打开输入管道写入流
let inputStream = null;
setTimeout(() => {
  console.log('打开输入管道写入流...');
  inputStream = fs.createWriteStream(inputPipe);
}, 1500);

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
        
        // 写入输入管道
        if (inputStream && inputStream.writable) {
          inputStream.write(parsed.data);
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
    fs.unlinkSync(inputPipe);
    fs.unlinkSync(outputPipe);
  } catch (e) {
    // 忽略清理错误
  }
});