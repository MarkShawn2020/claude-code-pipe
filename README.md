# Console Pipe

通过 WebSocket 与手机双向同步 Claude CLI 的解决方案。

## 方案概述

使用 tmux + ttyd 实现 Claude CLI 的远程访问和移动端同步。

## 快速开始

### 1. 安装依赖

```bash
# 安装 ttyd
brew install ttyd  # macOS
# 或 apt install ttyd  # Ubuntu

# 安装 tmux
brew install tmux   # macOS
# 或 apt install tmux  # Ubuntu
```

### 2. 启动服务

```bash
# 1. 创建 tmux 会话
tmux new-session -d -s claude-session 'claude'

# 2. 启动 ttyd 服务
ttyd -p 8080 --writable -t fontSize=32 -t theme=dark tmux attach-session -t claude-session
```

### 3. 访问方式

- **电脑端**: `http://localhost:8080`
- **手机端**: `http://你的电脑IP:8080`

获取电脑 IP：
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1
```

## 特性

- ✅ 双向同步 Claude CLI 会话
- ✅ 移动端友好的 Web 界面
- ✅ 会话持久化（断开连接后可重新连接）
- ✅ 多设备同时访问
- ✅ 可调整字体大小和主题

## 配置选项

### ttyd 参数说明

- `-p 8080`: 监听端口
- `--writable`: 允许写入操作
- `-t fontSize=32`: 设置字体大小
- `-t theme=dark`: 设置暗色主题
- `--credential user:password`: 添加认证（可选）
- `--max-clients 5`: 最大连接数（可选）

### 常用主题

- `dark`: 暗色主题
- `light`: 亮色主题
- `solarized-dark`: Solarized 暗色
- `solarized-light`: Solarized 亮色

## 使用说明

1. **创建会话**: 使用 tmux 创建持久化的 Claude CLI 会话
2. **启动服务**: 通过 ttyd 将 tmux 会话暴露为 Web 服务
3. **多端访问**: 在任何设备的浏览器中访问 Claude CLI
4. **会话恢复**: 断开连接后可重新连接到同一会话

## 故障排除

### 会话不存在
```bash
# 检查 tmux 会话
tmux list-sessions

# 重新创建会话
tmux new-session -d -s claude-session 'claude'
```

### 端口被占用
```bash
# 查看端口占用
lsof -i :8080

# 使用其他端口
ttyd -p 8081 --writable tmux attach-session -t claude-session
```

### 停止服务
```bash
# 停止 ttyd
pkill ttyd

# 停止 tmux 会话
tmux kill-session -t claude-session
```