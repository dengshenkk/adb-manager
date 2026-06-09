# BUNDLED_TOOLS.md

## 概述

ADB Manager 支持在应用内打包 ADB 工具，使用户无需单独安装 Android SDK Platform Tools 即可使用完整功能。本文档说明内置工具的实现、打包方法和使用注意事项。

---

## 一、工具打包位置

### 1.1 支持的打包路径

应用会在以下路径按顺序查找内置 ADB 工具（相对于 `app.getPath('resources')`）：

```
resources/
├── bin/adb                    # 推荐路径（优先级 1）
├── platform-tools/adb         # 标准 Android SDK 结构（优先级 2）
├── tools/adb                  # 备选路径（优先级 3）
└── adb                        # 根目录（优先级 4）
```

### 1.2 平台差异

- **macOS/Linux**: 可执行文件名为 `adb`
- **Windows**: 可执行文件名为 `adb.exe`

代码会根据 `process.platform` 自动判断并查找对应的文件。

### 1.3 实现代码位置

- **文件**: `/src/core/adb-executor.ts`
- **方法**: `AdbExecutor.getBundledAdbPath()`
- **调用时机**: 构造函数初始化时

---

## 二、实现机制

### 2.1 ADB 路径优先级

`AdbExecutor` 按以下优先级选择 ADB 可执行文件：

1. **用户自定义路径** - 通过配置文件 `adbPath` 字段指定
2. **打包路径** - 应用资源目录中的内置 ADB
3. **系统路径** - 系统 PATH 环境变量中的 `adb` 命令

```typescript
constructor(adbPath?: string, resourcesPath?: string) {
  this.adbPath = adbPath || this.getBundledAdbPath(resourcesPath) || 'adb';
}
```

### 2.2 PATH 环境变量增强

为了确保 ADB 及其依赖工具能够正常运行，`AdbExecutor` 会自动扩展 PATH 环境变量：

```typescript
const extraPaths = [
  '/usr/local/bin',
  '/opt/homebrew/bin',
  `${process.env.HOME}/Library/Android/sdk/platform-tools`,
];

// 如果使用打包的 ADB，将其目录加入 PATH
if (this.adbPath !== 'adb' && existsSync(this.adbPath)) {
  const adbDir = join(this.adbPath, '..');
  extraPaths.unshift(adbDir);
}
```

**作用**：
- 支持 Homebrew 安装的工具（macOS）
- 支持标准 Android SDK 路径
- 确保打包的 ADB 能够访问其依赖库（如 `libusb`）

### 2.3 调试日志

当找到内置 ADB 时，会输出日志：

```typescript
console.log(`Found bundled ADB at: ${path}`);
```

未找到时：

```typescript
console.log(`No bundled ADB found in resources: ${resourcesPath}`);
```

---

## 三、打包实施步骤

### 3.1 下载 ADB Platform Tools

从官方下载对应平台的工具：

- **macOS**: https://dl.google.com/android/repository/platform-tools-latest-darwin.zip
- **Windows**: https://dl.google.com/android/repository/platform-tools-latest-windows.zip
- **Linux**: https://dl.google.com/android/repository/platform-tools-latest-linux.zip

### 3.2 提取必要文件

解压后的 `platform-tools` 目录包含以下文件：

- **macOS/Linux**:
  - `adb` (核心可执行文件)
  - `fastboot` (可选)
  - 依赖库文件（如果有）

- **Windows**:
  - `adb.exe`
  - `AdbWinApi.dll`
  - `AdbWinUsbApi.dll`

**推荐：仅打包必要文件**

```
resources/
└── bin/
    ├── adb (或 adb.exe)
    ├── fastboot (可选)
    └── *.dll (Windows 必需)
```

### 3.3 配置 electron-builder

在 `package.json` 中配置资源打包：

```json
{
  "build": {
    "files": ["dist/**/*"],
    "extraResources": [
      {
        "from": "resources/bin",
        "to": "bin",
        "filter": ["**/*"]
      }
    ],
    "mac": {
      "target": "dmg"
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

### 3.4 设置可执行权限（macOS/Linux）

打包前确保文件有执行权限：

```bash
chmod +x resources/bin/adb
```

在 `package.json` 中添加打包前脚本：

```json
{
  "scripts": {
    "prepack": "chmod +x resources/bin/adb"
  }
}
```

---

## 四、Electron 主进程集成

### 4.1 获取资源路径

在 Electron 主进程中，使用 `app.getPath('resources')` 获取资源目录：

```typescript
import { app } from 'electron';
import { AdbExecutor } from './core/adb-executor';

const resourcesPath = app.getPath('resources');
const adbExecutor = new AdbExecutor(undefined, resourcesPath);
```

### 4.2 开发环境 vs 生产环境

- **开发环境**: `app.getPath('resources')` 指向项目根目录
- **生产环境**: 指向打包后的 `app.asar/resources` 或 `resources` 目录

**建议**：在开发环境中也创建 `resources/bin/adb` 以保持一致性。

### 4.3 完整初始化示例

```typescript
import { app, BrowserWindow } from 'electron';
import { AdbExecutor } from './core/adb-executor';
import { JsonConfigStore } from './core/config-store';
import { DeviceManager } from './core/device-manager';

async function createManager() {
  const resourcesPath = app.getPath('resources');
  const configDir = app.getPath('userData');
  
  const store = new JsonConfigStore(configDir);
  const config = await store.load();
  
  // 传入 resourcesPath 以启用打包工具检测
  const adb = new AdbExecutor(config.adbPath, resourcesPath);
  const manager = new DeviceManager(adb, store);
  
  await manager.init();
  
  console.log(`Using ADB at: ${adb.getAdbPath()}`);
  
  return manager;
}
```

---

## 五、用户自定义 ADB 路径

### 5.1 配置存储

用户可以通过配置文件指定自定义 ADB 路径：

**配置文件位置**：
- macOS: `~/Library/Application Support/adb-manager/adb-manager.json`
- Windows: `%APPDATA%\adb-manager\adb-manager.json`
- Linux: `~/.config/adb-manager/adb-manager.json`

**配置格式**：

```json
{
  "adbPath": "/path/to/custom/adb",
  "devices": [],
  "activeDeviceId": null,
  "theme": "system",
  "terminalApp": "terminal"
}
```

### 5.2 动态修改

可以通过 `AdbExecutor.setAdbPath()` 动态修改：

```typescript
adbExecutor.setAdbPath('/custom/path/to/adb');
```

修改后需要重新执行命令才会生效。

---

## 六、常见问题

### 6.1 macOS 安全限制

**问题**: macOS Gatekeeper 阻止未签名的可执行文件运行。

**解决方案**：

1. **签名 ADB 工具**（推荐）：

   ```bash
   codesign --force --deep --sign "Developer ID" resources/bin/adb
   ```

2. **用户手动授权**：

   首次运行时，用户需要在"系统偏好设置 > 安全性与隐私"中允许运行。

3. **使用系统 ADB**：

   引导用户安装 Homebrew 版本：

   ```bash
   brew install android-platform-tools
   ```

### 6.2 Linux 依赖问题

**问题**: 缺少 `libc++` 或 `libusb` 等依赖库。

**解决方案**：

1. **提示用户安装依赖**：

   ```bash
   # Debian/Ubuntu
   sudo apt-get install libc++1 libusb-1.0-0
   
   # Fedora/RHEL
   sudo dnf install libc++ libusb
   ```

2. **打包依赖库**（不推荐，可能引起兼容性问题）

3. **使用 AppImage 格式**，自动处理依赖

### 6.3 Windows DLL 缺失

**问题**: Windows 需要 `AdbWinApi.dll` 和 `AdbWinUsbApi.dll`。

**解决方案**：

确保打包时包含所有 DLL 文件：

```json
{
  "build": {
    "extraResources": [
      {
        "from": "resources/bin",
        "to": "bin",
        "filter": ["adb.exe", "*.dll"]
      }
    ]
  }
}
```

### 6.4 打包后路径错误

**问题**: 生产环境中 `app.getPath('resources')` 返回的路径不正确。

**调试方法**：

```typescript
console.log('Resources path:', app.getPath('resources'));
console.log('User data path:', app.getPath('userData'));
console.log('ADB path:', adbExecutor.getAdbPath());
```

**常见原因**：

- Electron 版本差异
- 打包配置中 `asar: false` 未设置
- 文件未正确复制到资源目录

---

## 七、测试验证

### 7.1 检查打包结果

打包完成后，检查输出目录：

```bash
# macOS
cd release/mac/ADB\ Manager.app/Contents/Resources
ls -lh bin/adb

# Windows
cd release\win-unpacked\resources
dir bin\adb.exe

# Linux
cd release/linux-unpacked/resources
ls -lh bin/adb
```

### 7.2 运行时验证

在应用中添加调试代码：

```typescript
import { existsSync } from 'fs';

const adbPath = adbExecutor.getAdbPath();
console.log('ADB path:', adbPath);
console.log('Exists:', existsSync(adbPath));

// 测试执行
const result = await adbExecutor.listDevices();
console.log('Devices:', result);
```

### 7.3 手动测试

在终端中直接调用打包的 ADB：

```bash
# macOS/Linux
/path/to/app/resources/bin/adb version

# Windows
C:\path\to\app\resources\bin\adb.exe version
```

---

## 八、最佳实践

### 8.1 版本控制

在应用中记录 ADB 版本信息：

```typescript
async function getAdbVersion(): Promise<string> {
  const { stdout } = await execAsync(`${adbPath} version`);
  return stdout.trim();
}
```

显示在"关于"页面，方便用户报告问题。

### 8.2 降级策略

当内置 ADB 不可用时，提示用户安装系统版本：

```typescript
if (!existsSync(adbPath)) {
  dialog.showMessageBox({
    type: 'warning',
    title: 'ADB 未找到',
    message: '请安装 Android SDK Platform Tools 或配置 ADB 路径',
    buttons: ['打开官网', '手动配置', '取消'],
  });
}
```

### 8.3 更新策略

定期更新内置 ADB 版本：

1. 订阅 Android SDK 更新通知
2. 测试新版本兼容性
3. 在发布说明中注明 ADB 版本

### 8.4 许可证合规

确保遵守 Android SDK Platform Tools 的许可证：

- 在应用中包含 `NOTICE.txt` 或 `LICENSE` 文件
- 在"关于"页面注明使用的第三方工具

---

## 九、安全考虑

### 9.1 文件完整性

打包前验证 ADB 工具的完整性：

```bash
# 使用 SHA-256 校验
shasum -a 256 resources/bin/adb
```

### 9.2 避免路径注入

在执行命令时，始终使用绝对路径：

```typescript
// 安全
const cmd = `${this.adbPath} devices`;

// 不安全（可能被环境变量劫持）
const cmd = `adb devices`;
```

### 9.3 权限最小化

只打包必要的工具，不要包含整个 SDK：

```
✅ resources/bin/adb
❌ resources/android-sdk/
```

---

## 十、参考资料

### 10.1 官方文档

- [Android SDK Platform Tools 发布说明](https://developer.android.com/studio/releases/platform-tools)
- [electron-builder 打包配置](https://www.electron.build/configuration/contents)

### 10.2 相关代码

- `src/core/adb-executor.ts` - ADB 命令执行器
- `src/core/config-store.ts` - 配置管理
- `src/main/index.ts` - Electron 主进程入口

### 10.3 命令参考

```bash
# 查看 ADB 版本
adb version

# 列出设备
adb devices

# 连接网络设备
adb connect 192.168.1.100:5555

# 断开设备
adb disconnect 192.168.1.100:5555
```

---

## 十一、故障排查

### 11.1 启用调试日志

在 Electron 主进程中启用详细日志：

```typescript
process.env.DEBUG = 'adb:*';
```

### 11.2 常见错误码

| 错误信息 | 原因 | 解决方案 |
|---------|------|---------|
| `command not found: adb` | ADB 不在 PATH 中 | 检查打包路径或安装系统版本 |
| `Permission denied` | 无执行权限 | 运行 `chmod +x` |
| `no devices/emulators found` | 未连接设备 | 检查 USB 连接或网络连接 |
| `device unauthorized` | 未授权 USB 调试 | 在设备上确认授权提示 |

### 11.3 日志收集

建议实现日志收集功能：

```typescript
import { appendFile } from 'fs/promises';
import { join } from 'path';

async function logAdbCommand(command: string, result: any) {
  const logPath = join(app.getPath('userData'), 'adb.log');
  const entry = `[${new Date().toISOString()}] ${command}\n${JSON.stringify(result)}\n\n`;
  await appendFile(logPath, entry);
}
```

---

## 结语

通过内置 ADB 工具，ADB Manager 可以为用户提供开箱即用的体验。请根据本文档的指导完成打包和集成，并充分测试各平台的兼容性。

如有问题，请参考故障排查章节或查看相关代码实现。
