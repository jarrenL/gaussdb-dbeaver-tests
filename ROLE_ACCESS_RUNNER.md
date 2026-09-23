# 受限角色真库验证入口

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
