# GaussDB / DBeaver 客户端回归测试

根据已提供的历史场景摘要独立编写，不包含内网 TPDSS 或数据库内核测试源码，不声称与原七千多条用例逐条等价。

## 仓库职责

- 本仓库：测试范围、执行入口、结果审计与环境说明。
- DBeaver 仓库：依赖 Eclipse/OSGi 及内部模型的 JUnit 测试、生产修复。
- 内网连接信息、密码、原始 JDBC 日志及本地运行结果不得上传。

DBeaver 源码：https://github.com/jarrenL/dbeaver 。测试扩充已分批本地提交，但尚未推送发布；使用时应核对后续记录的源码提交，不直接假定远端已有新用例。

## 运行

先准备 DBeaver 26.1.5 GaussDB 适配源码及并列的 dbeaver-common 依赖，按其说明准备构建 JDK、Maven 和离线缓存。测试执行的是 Maven/Tycho 中的实际生产代码，不复制一套简化实现来验证自己。

```sh
export JAVA_HOME=/path/to/build-jdk
bash scripts/run-dbeaver-tests.sh /absolute/path/to/dbeaver
```

不配置真库时相关用例跳过，不能当作服务端验证通过。启用真库时，仅允许使用可建删对象的专用测试库：

```sh
export GAUSSDB_HISTORY_CONNECTION=/absolute/private/connection.properties
export GAUSSDB_HISTORY_JDBC=/absolute/private/vendor-jdbc.jar
export GAUSSDB_HISTORY_ALLOW_DDL=YES
bash scripts/run-dbeaver-tests.sh /absolute/path/to/dbeaver
```

另有集中式实例时，设置 `GAUSSDB_HISTORY_CENTRAL_CONNECTION` 指向另一份同格式的私有连接文件。
复合外键和序列重启分别执行集中式场景；间隔分区优先在该实例验证，未配置时沿用默认实例并明确记录能力限制。
默认实例的分布式场景不会因此全部切换到集中式。关闭连接后的清理也使用原用例选择的连接配置。
请只给专用普通用户在测试库内建删对象的权限，访问规则限定实际测试来源地址，不开放公共匿名访问。

连接文件需权限 0600，包含 `url`、`driverClass`、`user`、`password`。必须与供应商 JDBC jar 匹配，不提供真实凭据示例。新用例创建随机 `dbv_hist_` schema，仅清理自身成功创建的 schema；不要连接生产库。

权限 SQL 真库场景另需管理员预建专用 **NOLOGIN** 角色，名称须以 `dbv_hist_grantee_` 开头，然后设置 `GAUSSDB_HISTORY_GRANTEE_ROLE` 为该角色名。部分 GaussDB 版本即使 NOLOGIN 也要求符合密码策略的随机密码；不要使用真实业务角色或将密码写入仓库。测试只向自身随机 schema 中的表授权并核对 SELECT/INSERT 与转授权范围，随后撤销；不负责创建或删除集群角色。运行后确认测试 schema 已清理，再由管理员删除该专用角色。未配置角色时该项跳过，不计为通过。

## 结果与发布原则

### 本地隔离双向 TLS 回归

在已准备好的 507 实验环境中，保留上文私有 JDBC/连接文件和显式 DDL 开关，然后运行：

```sh
node --test scripts/run-tls-live.test.mjs
node scripts/run-tls-live.mjs /absolute/path/to/dbeaver --mtls-only
```

此入口依赖现有 `gaussdb-507-ha-lab`、`gaussdb-507-cn-lab` 和 `gaussdb507-arm64:507.0.0` 镜像，不是通用客户环境安装脚本。它新建短期证书和隔离容器，只向主机回环地址动态发布端口；覆盖基础镜像的旧 Docker Desktop 端口标签，拒绝非预期发布。随后运行完整客户端回归，结束时删除自身容器、证书、临时库和角色并恢复临时访问规则。不与其他使用同一固定实验夹具的回归并行运行。

新增用例 `mutualTlsRequiresTrustedClientCertificate` 使用供应商 JDBC，保持 `verify-full` 服务端认证，验证合法客户端证书成功、显式不提供证书被拒绝、不受信任客户端证书被拒绝，并在每个拒绝场景前后验证正常连接。测试私钥使用 PKCS#8 DER，限临时目录内 0600；不把证书、私钥或原始报告发布。账号即使因服务端策略设置了随机密码，mTLS 连接配置也不提供该密码，目标访问规则采用 `cert`，不以密码连接冒充证书验证。未配置专用 mTLS 变量时该 JUnit 用例跳过，不算通过。本测试不替代 DBeaver SSL 设置页面的 GUI 验收。

### 调试终止夹具的重复执行

`integration/gui-debug-termination.sql` 使用专用固定 schema `dbv_gui_f10_fixture`，用于在调试器中先写入、再进入长等待，检查终止是否保留已提交基线并撤销未提交写入。只能用于隔离测试库；存在同名 schema 时拒绝覆盖。调试权限由管理员单独临时授权并恢复，不由夹具自动扩大权限。

使用 Java 21 或更高版本，先将 `integration/GuiDebugTerminationFixture.java` 和 `integration/GuiDebugTerminationFixtureTest.java` 编译到临时目录。运行时 classpath 包含该目录及供应商 JDBC jar，设置 `GAUSSDB_HISTORY_ALLOW_DDL=YES`。不要把连接文件或驱动放入仓库。

```sh
java -cp "$FIXTURE_CLASSES:$GAUSSDB_HISTORY_JDBC" GuiDebugTerminationFixture \
  "$GAUSSDB_HISTORY_CONNECTION" setup integration/gui-debug-termination.sql
# 完成 GUI 调试后，分别核验和清理：
java -cp "$FIXTURE_CLASSES:$GAUSSDB_HISTORY_JDBC" GuiDebugTerminationFixture \
  "$GAUSSDB_HISTORY_CONNECTION" verify integration/gui-debug-termination.sql
java -cp "$FIXTURE_CLASSES:$GAUSSDB_HISTORY_JDBC" GuiDebugTerminationFixture \
  "$GAUSSDB_HISTORY_CONNECTION" cleanup integration/gui-debug-termination.sql
```

清理前核对所有者、仅保留基线 id=1、无目标 CALL。清理使用同一事务内的 `DROP ... RESTRICT`，额外对象或依赖会阻止操作，失败回滚保留夹具；不能改成 `CASCADE` 强行清理。此固定 schema 不支持并行测试，运行期间不得让其他人修改其中对象。

`GuiDebugTerminationFixtureTest` 接收连接文件、SQL 文件两个参数，验证重复创建拒绝、额外表及其数据保留、清理失败恢复原过程、两轮生命周期和最终无残留；它不是 GUI 自动化，也不证明断点或终止动作已执行。测试异常时应检查残留并人工确认，不自动接管已有 schema。

GB18030数据库场景另需管理员在隔离实例预建专用数据库：存储编码GB18030，兼容模式ORA，所有者为测试账号；保持JDBC默认UTF8，不设置客户端编码初始化SQL。配置 `GAUSSDB_HISTORY_ENCODING_DATABASE` 为该库名称（仅小写字母、数字、下划线）。连接主机/端口/认证沿用私有连接文件，测试只替换URL中的数据库路径，并创建、清理该库内随机schema，不自行建删数据库。管理员应按已有密码认证方式仅放行测试账号/该库/测试客户端地址，结束后移除临时访问规则。缺少变量时此项跳过，不算通过。创建库的DBCOMPATIBILITY标记需以目标版本为准，本地507使用ORA而非A。

本地日志、结果写入被忽略的 `results/`。脚本拒绝将旧 JUnit 报告当作当前结果。公开结果仅包含测试 ID、状态和汇总，不包含环境属性、连接信息或标准输出。

提交前须人工检查覆盖范围、跳过原因、失败处理和敏感信息。构建成功不能替代 GUI 或目标金融版本验收；当前没有完成七千条等价迁移。验证通过后再推送到用户指定的测试仓库，DBeaver 修复单独提交到其源码仓库。

当前场景范围和已知限制见 [场景清单](SCENARIOS.md)。

完整历史清单的逐组登记和剩余工作见 [覆盖计划](COVERAGE_PLAN.md)。该表未完成项不因某一批回归成功而自动关闭。
