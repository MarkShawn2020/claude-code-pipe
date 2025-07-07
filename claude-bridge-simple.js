const { spawn } = require('child_process');
const WebSocket = require('ws');

// 创建WebSocket服务器
const wss = new WebSocket.Server({ port: 8080 });

console.log('WebSocket服务器启动在端口 8080');

// 存储所有连接的客户端
const clients = new Set();

// 处理WebSocket连接
wss.on('connection', (ws) => {
  console.log('新的WebSocket连接');
  clients.add(ws);
  
  // 接收来自WebSocket客户端的输入，启动新的claude进程
  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      console.log('收到消息:', parsed);
      if (parsed.type === 'input') {
        console.log('启动claude进程处理输入:', parsed.data);
        
        // 为每个输入启动一个新的claude进程
        const claude = spawn('claude', ['--dangerously-skip-permissions'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // 发送输入到claude
        claude.stdin.write(parsed.data);
        claude.stdin.end();
        
        // 实时发送输出
        claude.stdout.on('data', (data) => {
          const chunk = data.toString();
          console.log('Claude实时输出:', chunk);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'stdout',
              data: chunk
            }));
          }
        });
        
        claude.stderr.on('data', (data) => {
          console.log('Claude stderr:', data.toString());
          ws.send(JSON.stringify({
            type: 'stderr',
            data: data.toString()
          }));
        });
        
        claude.on('close', (code) => {
          console.log('Claude进程退出，输出:', output);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'stdout',
              data: output
            }));
            // 发送完成信号
            ws.send(JSON.stringify({
              type: 'complete'
            }));
          }
        });
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