# 受限角色真库验证入口

## 集中式与分布式联合重复验收

在同样环境变量基础上，可使用 `node scripts/run-centralized-live.mjs /absolute/path/to/dbeaver`。它面向固定本地容器 `gaussdb-507-ha-lab` 的55452端口，创建当天命名的专用集中式A兼容数据库与同名普通账号；如数据库或账号已存在则拒绝接管。每次使用随机口令和0600临时连接文件，不打印口令。仅为该库/账号和Docker网关172.17.0.1/32临时加入sha256认证规则，执行期间不修改旧测试账号密码。

执行结束恢复原HBA内容、所有者和权限并reload，校验内容哈希，删除本轮创建的数据库和角色，再删除临时凭据。若检测到HBA被其他任务修改则拒绝覆盖并返回失败，需要人工核对，不应直接重复执行。该入口同时调用受限角色入口，运行现有Maven验收门禁。运行器自测：`node --test scripts/run-centralized-live.test.mjs`。

可选 `--review --native`：前者创建独立随机 `dbv_debug_` SYSADMIN测试账号，用于真实调试器、提交响应故障及包编译验证，不提升普通账号；后者使用普通专用账号验证gs_dump/gsql/gs_restore。管理员账号只允许从原精确网关访问本轮专用库，结束随夹具删除。不会启用需要另建空集群的gs_dumpall测试。连续两轮 `run-f9ppjt`、`run-XeWWGy` 各2723项中2707通过、16跳过、零失败错误；独立查询专用库/普通及调试账号/HBA均0残留。

重复性门禁：`node scripts/verify-repeatability.mjs FIRST.json SECOND.json FIRST_START_MS SECOND_START_MS`。开始时间必须取各轮实际启动记录，不能为了通过校验回填成旧时间；校验每份底层报告时间、唯一测试身份、结果一致及失败为零，单独列出跳过项，不将其计为通过。该校验器24项自测，联合生命周期与其他门禁共59项自测通过。

该流程只适用于这里的隔离容器，不允许替换为业务环境执行。进程强杀、主机故障和SQL结果不确定仍需事后核查，不能声称这些情况下自动清理有保证。连续验证 `run-CCiTDy` 和 `run-MXUHCq`：各2723项中2700通过、23跳过、零失败错误，全部测试身份与结果逐项一致，专用数据库/角色和HBA恢复完成并独立查询0残留；跳过不计通过，两轮不累加。

`scripts/run-role-access.mjs` 仅面向本地隔离环境：容器 `gaussdb-507-cn-lab`、库 `distributed_acceptance`、测试账号 `distributed_lab`、节点组 `dual_group`。不应直接改成生产环境运行。

提供本地安全配置路径，不将凭据文件加入仓库：

```bash
JAVA_HOME=/path/to/jdk \
GAUSSDB_HISTORY_CONNECTION=/private/distributed.properties \
GAUSSDB_HISTORY_CENTRAL_CONNECTION=/private/central.properties \
GAUSSDB_HISTORY_JDBC=/path/to/gsjdbc200.jar \
GAUSSDB_HISTORY_ALLOW_DDL=YES \
node scripts/run-role-access.mjs /absolute/path/to/dbeaver
```

执行流程：生成随机专用 NOLOGIN 角色和口令，创建角色，授予测试账号成员关系与节点组 USAGE，启用实际访问分支运行原有全量测试，然后撤销授权并删除角色。口令通过管理员标准输入与子进程环境传递，不打印。返回值保留测试失败；清理失败也返回失败。脚本不会采用同名旧角色，创建失败时不删除任何角色。

运行器自身测试：`node --test scripts/run-role-access.test.mjs`。5项覆盖成功/失败退出清理、创建重名不删除、准备失败清理、异常/清理错误、非法标识符拒绝。

限制：强杀进程、宿主机崩溃、管理员 SQL 超时导致结果不确定时，不能保证 finally 已执行。应在隔离库审计 `dbv_hist_grantee_` 前缀角色，核实本次生成的精确名称后处理；不能批量删除其他测试角色。原始 Maven/Surefire XML 可能含进程环境，禁止发布；仅发布清洗后的测试结果。

## 已执行验证

2026-09-24：5项运行器测试通过；实际运行 run-AhPLgV 完成1543项回归（1520通过、23跳过、0失败/错误），包括受限角色表/列实际读写分支。随机角色正常删除，管理员独立查询确认该精确角色剩余0。运行器测试是独立的5项，不加入1543项JUnit总数。
