# 任务清单

## 任务拆解

- [x] 任务 1: 提交代码到本地仓库
  - [x] 1.1 检查当前修改内容
  - [x] 1.2 添加修改文件到暂存区
  - [x] 1.3 提交到本地仓库（4 次提交）

- [x] 任务 2: 当窗口到前台时，需要重新加载配置文件
  - [x] 2.1 检查代码是否已实现
  - [x] 2.2 添加主进程窗口焦点事件监听
  - [x] 2.3 添加渲染进程窗口焦点事件监听（双重保障）
  - [x] 2.4 实现配置重新加载逻辑

- [x] 任务 3: 顶部添加一个按钮，点击后可以切换到活跃设备
  - [x] 3.1 检查代码是否已实现
  - [x] 3.2 在顶部添加绿色按钮（Target 图标）
  - [x] 3.3 实现切换逻辑
  - [x] 3.4 添加自动滚动到活跃设备位置
  - [x] 3.5 添加 2 秒绿色高亮效果

- [x] 任务 4: 顶部添加一键断开连接按钮，点击后可以断开所有设备的连接
  - [x] 4.1 检查代码是否已实现
  - [x] 4.2 在顶部添加红色按钮（Power 图标）
  - [x] 4.3 实现断开所有设备连接逻辑
  - [x] 4.4 添加确认对话框

## 实现细节

### 核心方法实现
- [x] DeviceManager.disconnectAll()
- [x] DeviceManager.switchToActive()

### IPC 通信层
- [x] device:disconnectAll
- [x] device:switchToActive
- [x] config:reload

### API 暴露层
- [x] preload.ts 接口定义
- [x] preload.ts 实现
- [x] global.d.ts 类型定义

### UI 交互层
- [x] 导入 Target 和 Power 图标
- [x] handleSwitchToActive 处理函数（带滚动和高亮）
- [x] handleDisconnectAll 处理函数
- [x] 活跃设备按钮（绿色）
- [x] 断开所有按钮（红色）
- [x] DeviceCard 添加 data-is-active 属性

### 窗口事件
- [x] main/index.ts 添加 focus 事件监听
- [x] App.tsx 添加 window focus 事件监听

### 用户体验增强
- [x] 点击活跃设备按钮自动滚动
- [x] 2 秒绿色高亮效果
- [x] 双重焦点事件保障

### 验证
- [x] TypeScript 编译通过
- [x] Vite 构建成功
- [x] 代码提交完成（4 次）
- [x] 应用正常运行

## 所有任务已完成 ✅

---

# 新任务清单 - 2026/06/09

## 任务：创建 tools 目录并检查 ADB 和 scrcpy 是否存在

- [x] 1. 创建 tools 目录（如果不存在）
- [x] 2. 检查 ADB 是否已安装
- [x] 3. 检查 scrcpy 是否已安装
- [x] 4. 输出检查结果
