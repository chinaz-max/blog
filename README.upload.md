# Windows 博客上传指南：确认代理端口、修改端口并推送 GitHub

适用于本项目的 Windows PowerShell 和 `deploy.bat`。编写日期：2026-09-28。

- 项目目录：`C:\Users\primer\Desktop\blog`
- GitHub 仓库：<https://github.com/chinaz-max/blog>
- 上传分支：`main`
- 当前脚本默认代理：`http://127.0.0.1:7892`

`7892` 是本次确认可用的端口，不保证以后不变。更换代理软件或修改其设置后，应重新确认。

## 1. 先理解连接关系

```text
本地 Git → 127.0.0.1:代理端口 → 代理软件 → github.com:443
```

`127.0.0.1` 表示自己的电脑；`7892` 等端口由本机代理软件决定；`443` 是这里访问 GitHub 的 HTTPS 端口。配置 Git 时应填写本机代理的地址，不要把代理端口改成 `443`。

本次故障曾涉及三个端口：旧脚本使用 `7897`，全局 Git 配置仍指向 `7890`，后来实际运行的自由猫 `ziyoumaoCore` 监听的是 `7892`。端口变更后，旧配置不会自动更新。

## 2. 确认代理软件和端口

先启动代理软件，在设置中查找 **HTTP 代理端口** 或 **混合端口（Mixed port）**。不要只根据本指南的示例猜端口。

在 PowerShell 中进入项目并设置本次测试使用的地址。下面以 `7892` 为例；如果软件显示其他端口，修改第一行变量赋值即可：

```powershell
cd C:\Users\primer\Desktop\blog
$blogPort = 7892
$blogProxyUrl = "http://127.0.0.1:$blogPort"
```

查看端口是否能够建立 TCP 连接：

```powershell
Test-NetConnection 127.0.0.1 -Port $blogPort
```

- `TcpTestSucceeded : True`：端口可以连接，继续测试 GitHub。
- `TcpTestSucceeded : False`：检查代理是否已启动、端口是否填写正确。

如果想确认是谁在监听该端口：

```powershell
Get-NetTCPConnection -State Listen -LocalPort $blogPort |
    Select-Object LocalAddress, LocalPort, OwningProcess
```

将输出中的 `OwningProcess` 数字代入下面命令，查看进程名称：

```powershell
# 示例：假设 OwningProcess 是 12792，以你实际看到的数字为准。
Get-Process -Id 12792
```

端口监听只说明本地有程序接受连接，不能证明代理节点能正常访问 GitHub。下一步必须进行实际连接测试。

## 3. 验证代理能否访问 GitHub

先测试 HTTPS。以下命令不需要 Token，也不会上传文件：

```powershell
curl.exe --head --proxy $blogProxyUrl --connect-timeout 5 --max-time 15 https://github.com
```

输出可能先出现 `200 Connection established`，它只表示 HTTP 代理隧道建立成功；还应继续看到 GitHub 返回的最终 HTTP 响应，例如 `200 OK`。只有隧道建立、随后 TLS 失败，不算测试通过。

再用 Git 读取远程 `main` 分支，明确指定刚确认的代理，避免受到旧 Git 配置影响：

```powershell
git -c "http.proxy=$blogProxyUrl" ls-remote origin refs/heads/main
```

成功示例：

```text
一串提交编号    refs/heads/main
```

这证明当前 Git 到仓库的读取连接正常。本仓库是公开仓库，读取成功不代表 Token 具备推送权限。

若代理软件提供的是单独的 SOCKS5 端口，应使用 `socks5h://127.0.0.1:实际端口`，重新执行测试。HTTP/混合端口可使用本文的 `http://` 示例。

## 4. 更换端口后怎么上传

### 方法 A：临时指定端口，适合立即上传

假设代理软件当前使用 `7897`，先按前面的步骤验证该端口，再执行：

```powershell
cd C:\Users\primer\Desktop\blog
$env:BLOG_GIT_PROXY = "http://127.0.0.1:7897"
.\deploy.bat
```

`BLOG_GIT_PROXY` 会覆盖脚本默认端口。它只影响当前 PowerShell 及其启动的进程；从资源管理器双击脚本不会继承这里临时设置的值。

需要恢复脚本默认值时，在当前 PowerShell 中执行：

```powershell
Remove-Item Env:BLOG_GIT_PROXY -ErrorAction SilentlyContinue
```

### 方法 B：永久修改，适合以后双击脚本上传

1. 用文本编辑器打开项目根目录的 `deploy.bat`。
2. 找到下面这一行，将 `7892` 改成已经测试成功的新端口，然后保存：

```bat
if not defined BLOG_GIT_PROXY set "BLOG_GIT_PROXY=http://127.0.0.1:7892"
```

3. 同步更新这个仓库的 Git 配置，方便以后直接运行 `git push`。例如新端口是 `7897`：

```powershell
cd C:\Users\primer\Desktop\blog
git config --local http.proxy http://127.0.0.1:7897
git config --local https.proxy http://127.0.0.1:7897
```

Git 的 HTTPS 请求主要使用 `http.proxy`；这里同时更新项目已有的 `https.proxy` 项，保持历史配置与脚本一致，不能只修改 `https.proxy`。

4. 重新运行 `deploy.bat`。若当前 PowerShell 还设置了旧的 `BLOG_GIT_PROXY`，先按方法 A 清除或修改它。

`--local` 只修改当前仓库的 `.git/config`，不会改变其他项目。仅修改仓库配置不够：脚本的推送命令通过 `git -c` 显式指定代理，优先于仓库和全局配置。

### 当前项目的代理选择顺序

| 使用方式 | 实际使用的代理 |
| --- | --- |
| `deploy.bat`，且已设置 `BLOG_GIT_PROXY` | 环境变量中的地址 |
| `deploy.bat`，未设置 `BLOG_GIT_PROXY` | 脚本内的默认地址 |
| `git -c http.proxy=地址 push ...` | 这条命令显式指定的地址 |
| 普通 `git push` | Git 有效配置；本仓库配置优先于全局配置 |

检查相关配置：

```powershell
git config --show-origin --get http.proxy
git config --show-origin --get-regexp '^(http|https)\.proxy$'
Get-Item Env:BLOG_GIT_PROXY -ErrorAction SilentlyContinue
```

没有设置 `BLOG_GIT_PROXY` 时，最后一条命令没有输出是正常的。本次全局配置曾保留旧的 `7890`，而仓库配置为 `7892`；排查时要结合配置来源判断。

## 5. 日常上传与手动推送

### 使用脚本

确认代理软件开启、端口正确后，在 PowerShell 中运行：

```powershell
cd C:\Users\primer\Desktop\blog
git status --short
.\deploy.bat
```

也可以双击 `deploy.bat`。脚本会执行 `git add -A`，提交所有未被忽略的改动，再推送 `main`。没有新改动时，会直接推送已有提交。

先查看 `git status --short`，确认待提交内容都是准备上传的文件。`gcm-diagnose.log` 已加入 `.gitignore`，不应再随博客上传。

### 手动执行 Git 命令

有新的文章或图片改动时：

```powershell
cd C:\Users\primer\Desktop\blog
git status --short
git add -A
git commit -m "更新博客"
```

如果提示 `Author identity unknown`，需先为 Git 配置自己的 `user.name` 和 `user.email`；这是提交者信息，与 Token 权限无关。

随后明确指定可用代理推送，以下仍以 `7892` 为例：

```powershell
git -c http.proxy=http://127.0.0.1:7892 -c credential.gitHubAuthModes=pat -c credential.guiPrompt=false push origin main
```

若之前已经显示提交成功，只有 push 失败，不必重复 `add` 和 `commit`，修复连接或权限后直接重试 push 即可。`nothing to commit` 也不代表没有待推送的本地提交。

## 6. Token 输入、保存和 403 权限问题

当前脚本使用 Git Credential Manager，并选择终端 Token 输入方式。首次需要认证时可能显示：

```text
Enter GitHub personal access token for 'https://github.com/'...
Token:
```

粘贴 Token 后按回车，输入内容不会明文显示。如果提示用户名，填写 `chinaz-max`；如果提示 `Password`，填写 Token。成功认证后由凭据管理器安全保存，后续通常无需重复输入。

更换代理端口不会使 Token 失效。Token 到期、被撤销、权限变更、凭据被清除或更换电脑时，可能需要重新认证。

遇到 `403` 和 `Permission to chinaz-max/blog.git denied to chinaz-max` 时，到 [Fine-grained Token 设置页](https://github.com/settings/personal-access-tokens)检查：

1. Resource owner 为 `chinaz-max`。
2. Repository access 包含 `chinaz-max/blog`。
3. Repository permissions 中添加 **Contents**，Access 选择 **Read and write**。
4. 点击 **Update** 保存，并确认 Token 未过期。

本次截图中曾显示 `Repositories 0 / No repository permissions added yet`，选中仓库后还需要单独授予 Contents 写权限。**Copilot Editor Context** 不是仓库 Contents 权限，不能用于解决推送权限问题。

Token 只在生成时完整显示。如果没有保存，点击 **Regenerate token** 重新生成并立即保存；旧 Token 会失效，下一次认证需要使用新的 Token。不要把 Token 写进远程地址、脚本、文章或提交到仓库。

## 7. 判断是否上传和部署成功

成功推送会出现类似输出：

```text
旧提交编号..新提交编号  main -> main
```

`Everything up-to-date` 表示这次没有新的提交需要推送。可进一步检查：

```powershell
git status --short --branch
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

若只临时修改了脚本环境变量、没有同步 Git 配置，最后一条命令也要显式指定代理，例如：

```powershell
git -c http.proxy=http://127.0.0.1:7892 ls-remote origin refs/heads/main
```

`git status` 没有 `ahead` 只是基于本地远程跟踪记录的判断；本地 `HEAD` 和实际读取到的远程 `main` 提交编号一致，才能确认当前两端同步。

推送成功后，打开 [GitHub Actions](https://github.com/chinaz-max/blog/actions)，检查对应提交的 **Deploy to GitHub Pages** 工作流。构建和部署成功后再访问 <https://ctfer.cn>。上传成功不等于网站部署已完成。

## 8. 常见报错速查

| 提示 | 表示什么 | 下一步 |
| --- | --- | --- |
| `LF will be replaced by CRLF` | Git 提示文本换行符将转换 | 通常不影响提交或推送，继续看后续结果 |
| `Failed to connect ... via 127.0.0.1` | Git 无法通过所配置的本地代理建立连接 | 检查代理是否启动、端口是否正确，执行第 2、3 节测试 |
| `TLS ... unexpected eof` / `failed to receive handshake` | TLS 握手过程中连接中断 | 测试代理转发和节点；该错误本身不足以证明 Git 安装损坏，不要关闭证书校验 |
| `403 Permission ... denied` | GitHub 拒绝当前认证身份/Token 的写入请求 | 检查目标仓库、Contents 写权限及实际输入的 Token |
| `API rate limit exceeded` | 当前请求触发 GitHub API 限流，共享代理出口可能遇到 | 按限制重置时间等待或使用正常的已认证请求；不能据此认定 Git push 的仓库权限已修好 |
| `nothing to commit` | 工作区没有新内容需要提交 | 如果还有本地提交待上传，直接 push |
| `non-fast-forward` / `fetch first` | 远程存在本地尚未整合的提交 | 先获取并检查远程变化，按情况合并或 rebase；不要直接强制覆盖远程 |
| `Done!` | 脚本的 Git 推送命令返回成功 | 再查看 Actions 构建与部署结果 |

## 9. 每次换端口的最短流程

以下以已确认的 HTTP/混合端口 `7892` 为例。在同一个 PowerShell 窗口中逐步执行；前一步失败时，先排查，不要直接继续上传。

```powershell
cd C:\Users\primer\Desktop\blog
$blogPort = 7892
$blogProxyUrl = "http://127.0.0.1:$blogPort"

# 1. 确认本地端口能够连接。
Test-NetConnection 127.0.0.1 -Port $blogPort

# 2. 确认 Git 能通过该代理读取仓库。
git -c "http.proxy=$blogProxyUrl" ls-remote origin refs/heads/main

# 3. 将验证成功的地址交给上传脚本。
$env:BLOG_GIT_PROXY = $blogProxyUrl
git status --short
.\deploy.bat
```

准备长期使用该端口时，再按第 4 节方法 B 修改脚本默认值和仓库配置。

## 参考

- [Git 配置文档](https://git-scm.com/docs/git-config)
- [GitHub：管理 Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
- [Git Credential Manager 配置](https://github.com/git-ecosystem/git-credential-manager/blob/main/docs/configuration.md)
