const { spawn } = require('child_process');
const WebSocket = require('ws');

// 创建WebSocket服务器
const wss = new WebSocket.Server({ port: 8081 });

console.log('WebSocket服务器启动在端口 8081');

// 存储所有连接的客户端
const clients = new Set();

// 模拟打字效果的函数
function simulateTyping(text, ws, delay = 50) {
  return new Promise((resolve) => {
    let index = 0;
    
    function typeNextChar() {
      if (index < text.length && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'typing',
          data: text[index]
        }));
        index++;
        setTimeout(typeNextChar, delay);
      } else {
        resolve();
      }
    }
    
    typeNextChar();
  });
}

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
        
        // 发送开始信号
        ws.send(JSON.stringify({
          type: 'start'
        }));
        
        // 为每个输入启动一个新的claude进程
        const claude = spawn('claude', ['--dangerously-skip-permissions'], {
          stdio: ['pipe', 'pipe', 'pipe']
        });
        
        // 发送输入到claude
        claude.stdin.write(parsed.data);
        claude.stdin.end();
        
        // 收集输出
        let output = '';
        claude.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        claude.stderr.on('data', (data) => {
          console.log('Claude stderr:', data.toString());
          ws.send(JSON.stringify({
            type: 'stderr',
            data: data.toString()
          }));
        });
        
        claude.on('close', async (code) => {
          console.log('Claude进程退出，开始模拟打字效果');
          
          // 模拟打字效果
          await simulateTyping(output, ws, 30);
          
          // 发送完成信号
          ws.send(JSON.stringify({
            type: 'complete'
          }));
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