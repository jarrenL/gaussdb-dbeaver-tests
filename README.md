# GaussDB / DBeaver 客户端回归测试

根据已提供的历史场景摘要独立编写，不包含内网 TPDSS 或数据库内核测试源码，不声称与原七千多条用例逐条等价。

## 仓库职责

- 本仓库：测试范围、执行入口、结果审计与环境说明。
- DBeaver 仓库：依赖 Eclipse/OSGi 及内部模型的 JUnit 测试、生产修复。
- 内网连接信息、密码、原始 JDBC 日志及本地运行结果不得上传。

DBeaver 源码：https://github.com/jarrenL/dbeaver 。本仓库与 DBeaver 源码仓分别维护，执行或复现结果时必须记录两边实际使用的分支和提交号，不能只凭仓库默认分支推断测试代码与生产代码相互匹配。

本次交付配套的 DBeaver 源码基线为分支 `codex/icbc-gaussdb-26.1.5`、提交 `b09ba1a0409e05d483fd600031b0f71c72430781`。

## 运行

### 包界面测试的可重复夹具

仅用于支持 Package 的集中式 O/A 专用测试库。`integration/GuiPackageFixture.java`
使用固定 schema `dbv_pkg_gui_repeatable`，创建正常包 `gui_valid` 和故意含无效类型引用的
`gui_bad`。它不替代 DBeaver 界面测试：先 setup，再在客户端刷新模式树并执行编译、
错误跳转、保存或批量删除。verify 只检查两包存在及正常包返回 42；修复后的错误包不要求仍 Invalid。

```sh
export GAUSSDB_HISTORY_ALLOW_DDL=YES
export GAUSSDB_PACKAGE_URL=jdbc:gaussdb://test-host:port/test_database
export GAUSSDB_PACKAGE_USER=test_owner
export GAUSSDB_PACKAGE_DRIVER=com.huawei.gaussdb.jdbc.Driver
export GAUSSDB_PACKAGE_PASSWORD_FILE=/absolute/private/password.txt
export GAUSSDB_HISTORY_JDBC=/absolute/private/version-matched-jdbc.jar
fixture_classes=$(mktemp -d)
javac --release 21 -d "$fixture_classes" integration/GuiPackageFixture.java integration/GuiPackageFixtureTest.java
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiPackageFixture setup
# 完成界面测试后清理；界面已经删掉两个包时也可以执行：
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiPackageFixture cleanup
# 独立验证夹具保护与重复执行能力（先确保上面的清理成功）：
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiPackageFixtureTest
```

密码文件只包含密码，限制文件访问权限；不得提交该文件或原始驱动连接日志。
上述 classpath 分隔符适用于 Linux/macOS，Windows 使用分号。驱动类必须与外部 JDBC 匹配。
setup 不接管已存在的 schema；cleanup 要求当前用户拥有 schema，只删除两个固定测试包，
最后用 `DROP SCHEMA ... RESTRICT`，全程处于同一事务。若存在额外对象，清理失败并回滚，
不得改成 CASCADE 绕过保护。测试程序自身创建的保护表会自行移除；其他额外对象须人工核对。
界面外部建包后要刷新模式树，不要依赖旧对象 OID；编译错误核验按当前 OID 而非仅按包名。

### 调试事务 GUI 复测夹具

复用上节的 JDBC、账号、私有口令文件环境变量（变量名保留 `GAUSSDB_PACKAGE_*`）。
本夹具只适用于专用 O/A 测试库，固定 schema 为 `dbv_debug_gui_repeatable`。
不会自动授予调试权限；GUI 调试账号须由管理员按服务器版本配置所需权限，
若临时授权，验收后恢复原状态。不要使用业务账号或生产库。

```sh
fixture_classes=$(mktemp -d)
javac --release 21 -d "$fixture_classes" integration/GuiPackageFixture.java integration/GuiDebugFixture.java integration/GuiDebugFixtureTest.java
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiDebugFixture setup
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiDebugFixture baseline
```

在 DBeaver 中刷新模式树，进入调试配置，选择 `write_row(integer)`，将 `p_id` 填为 `2`，
按 Enter 确认参数单元格后启动。切换调试透视图，选择栈帧及变量页，应显示 `p_id=2`、
`v_value=10`；F8 后应显示 `12`，F9 继续至完成。事务选择框出现时，另开终端执行
`GuiDebugFixture baseline`，应仍只看到原记录 `1`。

第一次选择“回滚”，再次执行 baseline 应通过。重新启动同一配置，F9 完成后选择“提交”，
执行下列 committed 应通过（恰好两行 `1` 和 `12`）。若额外调试并提交过，应先核对数据，
不要修改断言掩盖多次提交。

```sh
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiDebugFixture committed
# 结束全部调试会话并关闭对象编辑器后：
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiDebugFixture cleanup
# 单独验证夹具及其独立连接断言（不是 GUI 调试验证）：
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiDebugFixtureTest
```

setup 拒绝已有 schema；cleanup 仅删除固定过程和表，再以 RESTRICT 删除 schema，
遇到额外对象整体回滚，不用 CASCADE。测试程序每次执行两轮生命周期，包含重复创建拒绝、
提交前不可见、回滚与提交断言、额外对象阻止清理并恢复过程和数据。清理失败须调查，不能当作通过。

### 调试 E2E 夹具与工作流证据

`integration/GuiDebugE2EFixture.java` 在两个不同的专用测试数据库中创建同名 schema 和过程，
用于验证 A→B→A 数据库切换、同名对象隔离、大源码、64 个局部变量、运行中终止及重新启动。
两个连接文件均须为 0600，且必须指向不同数据库；夹具使用固定 schema
`dbv_debug_e2e_repeatable`，因此不能并行运行，也不能连接业务库。

```sh
export GAUSSDB_HISTORY_ALLOW_DDL=YES
export GAUSSDB_HISTORY_JDBC=/absolute/private/version-matched-jdbc.jar
export GAUSSDB_DEBUG_DATABASE_A=/absolute/private/database-a.properties
export GAUSSDB_DEBUG_DATABASE_B=/absolute/private/database-b.properties

fixture_classes=$(mktemp -d)
javac --release 11 -d "$fixture_classes" \
  integration/GuiDebugE2EFixture.java integration/GuiDebugE2EFixtureTest.java

java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiDebugE2EFixture \
  setup "$GAUSSDB_DEBUG_DATABASE_A" "$GAUSSDB_DEBUG_DATABASE_B"
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiDebugE2EFixture \
  verify "$GAUSSDB_DEBUG_DATABASE_A" "$GAUSSDB_DEBUG_DATABASE_B"

# 在夹具仍存在时执行 DBeaver GUI 调试；完成后必须清理：
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiDebugE2EFixture \
  cleanup "$GAUSSDB_DEBUG_DATABASE_A" "$GAUSSDB_DEBUG_DATABASE_B"

# 离线保护契约；追加两个连接文件参数后会执行两轮真实生命周期：
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiDebugE2EFixtureTest
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiDebugE2EFixtureTest \
  "$GAUSSDB_DEBUG_DATABASE_A" "$GAUSSDB_DEBUG_DATABASE_B"
```

setup 拒绝接管已有 schema；verify 检查数据库专属源码标记、基线数据、源码规模和过程集合；
cleanup 先核对所有权及对象白名单，再逐项 `DROP ... RESTRICT`。任一数据库预检失败时不会先删除另一个数据库的夹具。

`scripts/debug-workflows.mjs` 是 DBeaver GUI 操作证据的语义编排和校验器，不会自己点击界面，
也不能把人工构造的 JSON 当成 GUI 通过证据。先查看支持的工作流：

```sh
node scripts/debug-workflows.mjs --list
node scripts/debug-workflows.mjs breakpoint-step-continue-relaunch \
  --trace /absolute/private/gui-trace.json
node scripts/debug-workflows.mjs terminate-relaunch \
  --adapter /absolute/private/dbeaver-ui-adapter.mjs
```

`--trace` 校验已有的脱敏事件记录；`--adapter` 模块必须导出
`executeDebugStep(step, context)`，逐步驱动真实 DBeaver 并返回带目标身份、会话、断点、变量、
调用状态和清理结果的事件。三个内置工作流分别验证断点/变量/单步/继续/重启、运行中终止/回滚/连接复用，
以及 A→B→A 同名大过程隔离。脚本只输出脱敏汇总；原始截图、连接文件和日志不得提交。

### 调试能力矩阵

`integration/DebugCapabilityProbe.java` 读取私有连接文件，核对实际 JDBC 驱动是否接受 URL，
并从服务端读取版本、兼容模式、`DBE_PLDEBUGGER` 精确签名及当前用户执行权限。
它只输出这些脱敏能力维度，不输出 URL、用户名或密码。通常通过
`scripts/run-debug-matrix.mjs` 使用；该脚本会自动以 Java 11 编译探针并逐个串行执行矩阵单元。

矩阵文件放在 `private/` 或仓库外，不能提交。最小格式如下，版本字段为正则表达式，
`signatureFingerprint` 可选，用于固定精确服务端调试协议：

```json
{
  "entries": [
    {
      "id": "central-a-native",
      "connection": "/absolute/private/central-a.properties",
      "jdbc": "/absolute/private/gaussdb-jdbc.jar",
      "expect": {
        "driverClass": "com.huawei.gaussdb.jdbc.Driver",
        "driverVersionPattern": "^9\\.",
        "serverVersionPattern": "^GaussDB",
        "compatibility": "A",
        "debugSupported": true
      }
    }
  ]
}
```

```sh
# 只探测并核对声明的能力：
node scripts/run-debug-matrix.mjs /absolute/private/debug-matrix.json --probe-only

# 每个能力单元探测通过后，再执行同一条真实回归命令：
node scripts/run-debug-matrix.mjs /absolute/private/debug-matrix.json -- \
  bash scripts/run-dbeaver-tests.sh /absolute/path/to/dbeaver

# 编排器、矩阵和夹具的离线自测：
node --test scripts/debug-workflows.test.mjs scripts/run-debug-matrix.test.mjs
```

连接文件在非 Windows 系统必须为 0600。M 模式作为明确的调试不支持单元仍会执行其负向回归；
缺签名、签名无执行权限、驱动/版本/兼容模式偏移或重复能力单元都会在运行回归前失败关闭。

### DBeaver 模型和真库回归

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

本地 507 隔离容器还可使用集中式临时库入口：

```sh
export GAUSSDB_HISTORY_CONNECTION=/absolute/private/source.properties
export GAUSSDB_HISTORY_JDBC=/absolute/private/version-matched-jdbc.jar
export GAUSSDB_HISTORY_ALLOW_DDL=YES
node scripts/run-centralized-live.mjs /absolute/path/to/dbeaver --review --central-only
```

`--central-only` 只执行集中式及独立 review 账号可启用的门禁，不串接受限分布式角色入口，
不能据此声明分布式场景通过。运行器优先读取源连接文件中的 `driverClass`，缺失时才使用
`GAUSSDB_HISTORY_DRIVER_CLASS`；`org.postgresql.Driver` 自动使用 `jdbc:postgresql:`，
`com.huawei.gaussdb.jdbc.Driver` 自动使用 `jdbc:gaussdb:`。其他驱动保留源连接 URL 的 scheme，
必要时可用 `GAUSSDB_HISTORY_JDBC_SCHEME` 显式指定仅含小写字母和数字的 scheme。
驱动类、URL scheme 和实际 JDBC jar 必须相互匹配，否则在创建测试凭据或执行回归前失败。
该入口依赖固定的本地 `gaussdb-507-ha-lab` 容器、端口和容器内目录，不是通用客户部署脚本。

分布式 `EXECUTE DIRECT` 同时验证权限边界和管理员正向路径。默认连接必须保持普通账号；另准备仅用于测试的 monitor/system admin 账号，将同格式的私有连接文件路径设置为 `GAUSSDB_HISTORY_MONITOR_CONNECTION`。正向用例使用管理员连接在自身随机 schema 建表，并逐个访问表实际所在 DN；负向用例仍用默认普通账号断言 SQLSTATE `42501`。不要临时提升默认账号，否则负向场景会失真。未配置管理员连接时正向项跳过，不计为通过。

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
