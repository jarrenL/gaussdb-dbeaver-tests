# 验收恢复检查点

## 状态与范围

目标未完成：按历史清单覆盖全部适用客户端场景，完成单测、507真库和可用Linux GUI分层验收、辅助审核，验证后推送。不能把目前离线测试数量替代该目标，也没有认定原始约7000条内网用例已逐条迁移。

当前交付关键路径受运行环境阻塞。继续增加同类模拟故障测试不能验证最新修复的真实目录、驱动、界面或安装包行为；接下来优先恢复实际验收，而不是继续扩大发布前未验收改动。

主仓：`/Users/lj/Documents/GaussDB/dbeaver-icbc-26.1.5`，分支`codex/icbc-gaussdb-26.1.5`，当前提交`8b08b313a0`。辅助仓当前基线`6a41ddf`。

## 本轮只读复核

| 入口 | 实际结果 | 影响 |
| --- | --- | --- |
| docker ps | Docker Unix socket permission denied | 不能进行现有507容器及Linux GUI操作 |
| --sessions真库专项 | 实际启动1项，SocketException: Operation not permitted；0通过、1失败 | 查询本身尚未执行，不算模型真库通过 |
| 辅助只读审核 | 初始化agent.log时Operation not permitted，进程exit 1 | 无审核报告，不能宣称审核通过 |
| GitHub ls-remote | 127.0.0.1:7897代理连接失败，exit 128 | 远程状态未确认，未尝试推送 |

真库专项目录`/tmp/live-plan-focused-ApZ6p0`；日志`/tmp/delivery-blocker-jdbc-20260929.log`。辅助审核日志`/tmp/delivery-blocker-hermes-20260929.log`。以上进程均已终止，不存在可继续等待的本轮任务。

最近73模块回归证据为主仓`docs/gaussdb/evidence/SESSION_FAILURE_MATRIX_REACTOR_20260929.json`：2723项，2548通过、174跳过、0失败、1错误。唯一错误是RestTest.restClientServerTest网络权限限制。跳过包含未开启真库的用例；独立门禁仍拒绝整体通过。

## 环境恢复后顺序

1. 先只读确认Docker、数据库连接和审核程序可用；不要终止旧记录中的数据库PID，编号可能已复用。
2. 在主仓当前源码基础上运行正式回归入口，不使用maven.test.failure.ignore。可设置DBEAVER_MAVEN_REPOSITORY为已存在的独立缓存目录，JDK25按Java21目标编译，并沿用启动时ByteBuddy代理和headless参数。执行辅助仓`scripts/run-dbeaver-tests.sh`，要求报告新鲜、必跑类完整且无失败错误；真实用例跳过仍不是通过。
3. 使用受保护的本地连接属性文件，运行`scripts/run-live-plan-focused.mjs --sessions`和`--set-queries`两项只读专项。需要真实大PID证据时记录实际返回值范围，小PID通过不能替代。不要把连接失败改为skip。
4. 重建一致的插件/安装包后进行Linux GUI回归，特别是过程调试、事务确认、包编译定位、界面中文，以及会话显示/取消结果。会话getPid返回类型已经改为long，不能混装旧二进制依赖。
5. 按COVERAGE_PLAN中的未验收项逐项补证，包括线程池会话双标识等尚未闭环边界；恢复验收不等于宣称这些项自动完成。辅助审核报告需逐条核实并处理。
6. 全部适用范围与验收条件满足后，再检查差异、凭据/日志脱敏、目标远程分支，然后推送并核对远程提交及安装包。不得因本地commit成功声称已经上传。

## 保留的未提交内容

主仓两处既有SWTBot改动未纳入近期提交：integration/swtbot/README.md和integration/swtbot/src/org/jkiss/dbeaver/gaussdb/acceptance/Bot.java（均位于调试测试模块）。继续保留；先审查、编译和验收，不能直接当成已验证工具安装或覆盖。

无需提供客户内网仓库或数据库凭据。当前首先需要恢复本机既有测试环境的必要访问；客户金融目标版本、平台范围及其余场景仍保持原验收要求，不因本地阻塞降级。
