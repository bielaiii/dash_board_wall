# Pulse · 个人状态台

本机运行的动态仪表盘。界面由 HTML、CSS 和 SVG 构建，无前端依赖。

## 启动

需要 Node.js 20 或更新版本。在仓库根目录运行：

```bash
npm start
```

在 `pulse-dashboard` 子目录运行同一命令也可以。

浏览器打开 `http://127.0.0.1:4173`。服务默认只监听本机，按 `Ctrl+C` 停止。可用 `PORT=5000 npm start` 修改端口。

桌面布局默认填满浏览器窗口。鼠标移到右侧边缘可展开设置和全屏按钮；触屏设备可点边缘把手展开。`F` 或 `F11` 可切换全屏，`Esc` 可退出。柔和的背景、卡片和天空会随本地时间在清晨、白昼、黄昏、夜晚之间逐渐过渡。

## 数据来源

- CPU：在 WSL 中优先读取 Windows 主机的物理核心拓扑与每个逻辑处理器的占用，并按物理核心汇总。左侧大方块与右侧小方块分别显示两种核心，Intel 风格蓝色从底部填充；页面不显示分组名称及每核数字。主机接口不可用时回退到 Linux `/proc` 与 WSL 可见拓扑，页面会标明来源。
- 内存和网络：本机 Linux `/proc` 统计。网络会在首次采样后显示速率。
- GPU：参考 [NVIDIA 官方 RTX 5090 Founders Edition 正面图](https://www.nvidia.com/content/nvidiaGDC/us/en_US/support/warranty/_jcr_content/root/responsivegrid/nv_container_103187363/nv_container/nv_teaser_copy.coreimg.jpeg/1784126828684/gf-5090-1920x1080.jpeg)手绘 SVG 轮廓，保留中空挡板、接口、两侧鳍片和中央交叉结构。绿色从底部按实时负载填充。温度、功耗和时钟显示在图右侧；窄屏时排在图下方。型号文字始终是实际检测到的显卡。没有 NVIDIA 接口时尝试 Linux DRM `gpu_busy_percent`。
- Git：默认统计主目录下一级仓库，以及 `dashboard` 内的 Git 仓库，范围为过去一年。默认按全局 `git config user.email` 筛选自己的提交；未设置邮箱时统计全部提交。若要指定仓库，设置 `DASHBOARD_GIT_DIRS`，多个路径使用系统路径分隔符 `:`。可用 `DASHBOARD_GIT_AUTHOR=邮箱` 覆盖作者。
- Codex：从当前用户的 `~/.codex/sessions` 本地记录提取最近一次额度快照，显示 5 小时、7 天窗口、重置时间和 credits 余额。会话过旧或窗口已重置后，额度显示“待更新”，直到 Codex 产生新记录。本服务不读取或发送登录令牌。
- 下一次充值：从右侧边缘展开设置后手动填写，保存在浏览器本地。额度窗口重置与账户充值是不同的时间。

本页面不向外部服务传输这些指标。Google Fonts 加载失败时会使用系统字体。
