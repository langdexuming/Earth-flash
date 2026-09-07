# 本地网页与固定端口

浏览器科幻 RTS。端口登记于 `local-web.json`，总表在 `~/Projects/LOCAL-WEB-PORTS.md`。

| 模式 | 固定地址 / 端口 | 启动命令（本目录） |
| --- | --- | --- |
| dev | http://localhost:5173/ | `./scripts/web.sh dev` |
| preview | http://localhost:5173/ | `./scripts/web.sh preview` |

- `./scripts/web.sh status` 只查询监听者，不会停止进程。
- 启动前检查 IPv4 / IPv6 占用；冲突时退出，不递增端口、不杀占用者。
- 重启：在原终端 Ctrl+C 停止，再运行相同命令。若由 LaunchAgent 管理，使用原 LaunchAgent 重启，勿另开服务。
- dev 与 preview 共用网页端口，不能同时启动；preview 需先构建，只提供构建后的网页，Express/API 功能请使用 dev 或 production。
- 本地脚本锁定运行环境端口，拒绝额外参数。不要使用 `--port`、`PORT=0`、临时服务器或改端口绕过占用。
- 如确需改端口，同步本文件、`local-web.json`、Vite/服务端配置、桌面 devUrl、代理和总表。
- 已保存到浏览器或客户端的旧服务地址需手动改为本表地址；配置文件不能覆盖已有用户偏好。
- 检查端口和 HTTP 可达不等于业务联调通过；数据库、远程 API、模型凭据仍按项目说明配置。
