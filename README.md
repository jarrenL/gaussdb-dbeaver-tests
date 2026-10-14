# GaussDB / DBeaver 客户端回归测试

根据已提供的历史场景摘要独立编写，不包含内网 TPDSS 或数据库内核测试源码，不声称与原七千多条用例逐条等价。

## 仓库职责

- 本仓库：测试范围、执行入口、结果审计与环境说明。
- DBeaver 仓库：依赖 Eclipse/OSGi 及内部模型的 JUnit 测试、生产修复。
- 内网连接信息、密码、原始 JDBC 日志及本地运行结果不得上传。

DBeaver 源码：https://github.com/jarrenL/dbeaver 。本仓库与 DBeaver 源码仓分别维护，执行或复现结果时必须记录两边实际使用的分支和提交号，不能只凭仓库默认分支推断测试代码与生产代码相互匹配。

本次交付配套的 DBeaver 源码公开分支为 `codex/gaussdb-26.1.5`，最终基线提交为
`3a20ec0742936c1bcfa861e2f0470b1eb980e8d4`。

## 运行

定向脚本要求显式设置 `DBEAVER_REPO`，避免同一工作区的其他检出被静默当成交付基线；它必须
指向上述公开分支和提交对应的检出。`dbeaver-common` 默认取本仓库同级目录，Maven 本地仓库
默认取当前用户目录，Java 默认使用 `PATH` 中的工具链；目录布局不同时可显式设置：

```sh
export DBEAVER_REPO=/path/to/dbeaver
export DBEAVER_COMMON_REPO=/path/to/dbeaver-common
export MAVEN_REPO_LOCAL="${HOME}/.m2/repository"
export JAVA_HOME=/path/to/jdk-21-or-newer
# 默认从主仓 Tycho 生成的 config.ini 解析 bundle；仅在需要改用独立 JAR 目录时设置：
export DBEAVER_RESOLVED_PLUGINS=/path/to/resolved/plugins
```

`DBEAVER_MAVEN_REPOSITORY` 仍作为 `MAVEN_REPO_LOCAL` 的兼容别名；两者同时设置时以后者为准。
OSGi 运行器会从当前操作系统和 CPU 架构推导 Eclipse 平台参数；非标准环境可使用
`OSGI_OS`、`OSGI_WS`、`OSGI_ARCH` 覆盖。

### JDK 版本要求

- Package/GUI 夹具沿用 DBeaver 26.1.5 的构建基线，必须使用 **JDK 21 或更高版本**编译和运行；
  GaussDB 505 服务端使用什么 JDK 与客户端夹具的 JDK 要求无关。只有 JDK 8 的 GRT 节点应安装
  独立 JDK 21，或把 Package 夹具放到具备 JDK 21 的执行节点，不得把编译失败记作数据库失败。
- `HeadlessTransactionTerminationTest` 特意保持 **Java 8 兼容**，可直接在 JDK 8 的内网 GRT
  节点编译运行。建议执行前分别用 `java -version`、`javac -version` 记录实际工具链。

### 包界面测试的可重复夹具

用于支持 Package 的 O/A/ORA 专用测试库。`integration/GuiPackageFixture.java` 会先探测服务端
能力，再选择 `structured`、`source-replay` 或 `unsupported` 模式。夹具使用固定 schema
`dbv_pkg_gui_repeatable`，创建正常包 `gui_valid` 和故意含无效类型引用的 `gui_bad`。它不替代
DBeaver 界面测试：先 setup，再在客户端刷新模式树并执行编译、错误查看或跳转、保存或批量
删除。verify 同时检查两包存在、正常包返回 42，并按当前能力模式验证错误诊断路径。

```sh
export GAUSSDB_HISTORY_ALLOW_DDL=YES
export GAUSSDB_PACKAGE_URL=jdbc:gaussdb://test-host:port/test_database
export GAUSSDB_PACKAGE_USER=test_owner
export GAUSSDB_PACKAGE_DRIVER=com.huawei.gaussdb.jdbc.Driver
export GAUSSDB_PACKAGE_PASSWORD_FILE=/absolute/private/password.txt
export GAUSSDB_HISTORY_JDBC=/absolute/private/version-matched-jdbc.jar
export GAUSSDB_PACKAGE_ALLOW_SESSION_SETTINGS=YES
fixture_classes=$(mktemp -d)
javac --release 21 -d "$fixture_classes" integration/GuiPackageFixture.java \
  integration/GuiPackageFixtureTest.java integration/GuiPackageCapabilityContractTest.java \
  integration/GuiPackageDegradedCapabilityContractTest.java
java -cp "$fixture_classes" GuiPackageCapabilityContractTest
java -cp "$fixture_classes" GuiPackageDegradedCapabilityContractTest
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiPackageFixture probe
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiPackageFixture setup
# 完成界面测试后清理；界面已经删掉两个包时也可以执行：
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiPackageFixture cleanup
# 独立验证夹具保护与重复执行能力（先确保上面的清理成功）：
package_log=$(mktemp)
set +e
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" GuiPackageFixtureTest >"$package_log" 2>&1
package_status=$?
set -e
node scripts/verify-package-fixture.mjs "$package_log" "$package_status"
```

密码文件只包含密码，限制文件访问权限；不得提交该文件或原始驱动连接日志。
`probe` 会在执行任何 DDL 前输出部署形态、兼容模式、包目录、两个会话参数和
`DBE_PLDEVELOPER.GS_ERRORS/GS_SOURCE` 的能力结果。集中式 O/A/ORA 且结构化诊断能力完整时
使用 `structured`：从服务端错误目录读取准确错误行。O/A/ORA 且同时具备 `gs_package` 与
`GS_SOURCE`、但缺少 `GS_ERRORS` 时使用 `source-replay`：正常包必须返回 42；夹具从
`GS_SOURCE` 读取并重放无效包体，要求再次获得服务端直接错误，并按源码中唯一错误 token
给出明确标记的客户端推断行。重放前按照产品相同契约，仅把源码开头（允许前置空白和
行/块/嵌套块注释）的 `CREATE PACKAGE [BODY]` 改为 `CREATE OR REPLACE PACKAGE [BODY]`；已有
`OR REPLACE` 保持原样，字符串和注释内容不改写。错误 token 必须在源码中只出现一次，零次或
多次时行号均为未知，不能选择首次出现位置冒充可靠定位。缺少 Package 或源码目录、或兼容模式不适用时才输出
`RESULT UNSUPPORTED ...`。

GaussDB 505.2.1.SPC0800 分布式 ORA（1 CN、1 分片 × 3 DN）真库验证中，能力探测进入
`source-replay`：存在 `gs_package` 和 `GS_SOURCE`，缺少 `GS_ERRORS` 及两个集中式私有参数；
原生 `ALTER PACKAGE ... COMPILE` 返回 SQLSTATE `42809`、vendor code `10531` 后进入降级路径。
两轮保护生命周期及严格 verifier 均通过：正常包返回 42，非法 Body 的 create/replay 均返回
SQLSTATE `42601`、vendor code `11019`，`GS_SOURCE` 保留 invalid 源码，唯一错误 token 推断为
第 3 行；最终只输出一个 PASS 终态并完成清理。该证据证明服务端/JDBC 降级路径和可重复夹具，
不等同于 DBeaver Package 编辑器、菜单、错误窗或源码跳转的 GUI 验收。

分布式 Package 的并发刷新另有独立 Java 21 夹具
`integration/PackageCatalogConcurrencyFixture.java`。连接 A 先按包 OID 读取并保留返回 42 的旧
`GS_SOURCE`，连接 B 将同一包 Body 更新为返回 84；连接 A 随后必须按原 OID 重新查询目录，且
只能重放刷新后的源码。夹具还检查 schema/package owner、包 OID，以及 `pg_object` 中 S/B
对象的 OID 与 valid 状态保持稳定。它使用固定隔离 schema `dbv_pkg_catalog_refresh`，不接管
同名既有 schema，清理前再次核对所有权，只执行精确 `DROP PACKAGE` 和
`DROP SCHEMA ... RESTRICT`，禁止 CASCADE。执行命令如下（复用上面的私有环境变量和口令文件）：

```sh
fixture_classes=$(mktemp -d)
catalog_log=$(mktemp)
javac --release 21 -d "$fixture_classes" integration/GuiPackageFixture.java \
  integration/PackageCatalogConcurrencyFixture.java
set +e
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" PackageCatalogConcurrencyFixture \
  >"$catalog_log" 2>&1
catalog_status=$?
set -e
node scripts/verify-package-catalog-concurrency.mjs "$catalog_log" "$catalog_status"
```

严格门禁要求 13/13、旧/新源码不同 SHA-256、四阶段使用同一包 OID、刷新标记
`staleSelected=false`、重放后仍返回 84、身份/状态稳定、唯一清理标记及唯一 PASS 终态。
GaussDB 505.2.1.SPC0800 分布式 ORA 真库已完成 13/13 及严格 verifier：A 读取返回 42 的旧
源码，B 更新同一包 Body 为返回 84，A 按原包 OID 重新读取 `GS_SOURCE` 并重放后仍返回 84；
schema/package owner、package OID、S/B object OID 与 valid 状态均保持，RESTRICT 清理通过。
该证据范围明确为 `server/JDBC/catalog`、`gui=false`、`osgi=false`；夹具不调用 DBeaver
Package GUI，也不经过产品 OSGi 服务，不能替代编辑器刷新、Compile 菜单或界面并发验收。

`GAUSSDB_PACKAGE_ALLOW_SESSION_SETTINGS=YES` 只授权 `structured` 模式使用集中式专有参数。
未设置时该模式的 setup 输出 SKIP，不会悄悄修改会话；授权后程序会先打印即将设置的
`enable_force_create_obj=on` 和 `plsql_show_all_error=off`，两项均使用 `SET LOCAL`，仅在
setup 事务内有效，不修改数据库全局配置。`source-replay` 模式既不要求该变量，也不会设置
上述两个参数。

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

#### 华为云集中式隔离验收库准备

集中式云实例必须先形成一份受控资源清单；不能只把一个实例 ID 写进任意连接文件。清单中的
`centralized.instance_id`、`phase=bound`、`endpoint.host` 和 `endpoint.port` 必须来自同一次实例
查询，并与源连接文件的 `url/host/port` 完全一致。清单不含账号或口令，示例结构如下：

```json
{
  "centralized": {
    "instance_id": "<cloud-instance-id>",
    "phase": "bound",
    "endpoint": {"host": "<instance-endpoint-host>", "port": 8000}
  }
}
```

源连接文件必须指向该端点的 `postgres` 库，并包含 `url`、`host`、`port`、`database`、
`driverClass`、`user`、`password`。源文件、资源清单和生成文件都只能保存在仓库外并设为 0600。
准备脚本会拒绝端点不一致、清单未绑定、重复关键字段、带凭据的 URL 和覆盖输入文件；输出还
包含由实例 ID 与规范化端点共同计算的 SHA-256 绑定值，后续 Java 入口会重新计算，防止连接
文件被替换后仍沿用原实例身份。

```sh
chmod 600 /absolute/private/source.properties /absolute/private/centralized-manifest.json
node scripts/prepare-centralized-review-connection.mjs \
  /absolute/private/source.properties \
  /absolute/private/centralized-manifest.json \
  /absolute/private/centralized-review.properties \
  review_0917_50520080_

review_classes=$(mktemp -d)
javac --release 21 -d "$review_classes" integration/IsolatedReviewDatabase.java \
  integration/IsolatedReviewDatabaseContractTest.java
java -cp "$review_classes" IsolatedReviewDatabaseContractTest
java -cp "$review_classes:/absolute/private/version-matched-jdbc.jar" \
  IsolatedReviewDatabase status /absolute/private/centralized-review.properties \
  /absolute/private/version-matched-jdbc.jar
java -cp "$review_classes:/absolute/private/version-matched-jdbc.jar" \
  IsolatedReviewDatabase create /absolute/private/centralized-review.properties \
  /absolute/private/version-matched-jdbc.jar
# 完成集中式真库回归后必须回收：
java -cp "$review_classes:/absolute/private/version-matched-jdbc.jar" \
  IsolatedReviewDatabase drop /absolute/private/centralized-review.properties \
  /absolute/private/version-matched-jdbc.jar
```

`create/status/drop` 在任何建库、删库操作前都会连接 `postgres` 并执行
`pg_catalog.gs_deployment()`；仅接受服务端明确的集中式枚举（`centralized`、
`BusinessCentralized`、`single-centralized` 的大小写/单词分隔形式），`Distribute` 等其他结果
立即失败，不会把分布式端点冒充集中式验收。`create` 拒绝接管同名库，`drop` 仅允许删除当前账号拥有、O/A/ORA 兼容且无其他
活动会话的精确隔离库。该安全入口要求 POSIX 文件所有权与 0600 权限，应在 Linux/macOS
验收节点执行；Windows 客户端验收可使用最终生成的专用连接信息，但不能绕过这一步的绑定和
服务端部署形态检查。

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

### 会话取消、终止目标程序的结果门禁

`GuiSessionTarget` 和 `GuiTransactionTarget` 是等待 DBeaver 界面操作的后台目标，日志中的
`TARGET` 或 `BEFORE` 只表示目标已准备好，不能作为成功依据。外层执行器必须等待 Java
进程自然结束并取得退出码；只在退出码为 0 且完整终态日志存在时才允许通过。

普通取消/终止证据使用：

```sh
node scripts/verify-session-actions.mjs cancel target.log target-ui.txt confirm-ui.txt refreshed-ui.txt 0
```

最后一个参数是目标 Java 进程的真实退出码，不能填写预期值代替。事务终止证据使用：

```sh
node scripts/verify-transaction-target.mjs transaction-target.log 0
```

事务门禁要求同一轮日志同时包含唯一 `TARGET`、`BEFORE`、终止 SQLSTATE、最终 `PASS` 和
相同随机 schema 的 `CLEANED`。两个门禁都会拒绝非零退出、缺少终态、重复终态、
`FAIL` 行和未捕获异常。内网 GRT 若采用 `TOTAL CHECKS`，还必须校验
`total = pass + fail + skip/unsupported`，任何 `FAIL` 行均不能与 `FAIL 0` 同时被判成功。

#### 无界面 GRT 的会话终止测试

无桌面的 GRT 不应运行 `GuiTransactionTarget` 后用 shell `timeout` 杀掉 Java 进程，也不能把
只有 `TARGET`/`BEFORE` 的日志记为通过。该目标程序仍专门保留给 DBeaver 会话管理页面或
SWTBot 验收。纯 headless 环境改用 `HeadlessTransactionTerminationTest`：它创建随机 schema、
提交基线并写入一条未提交记录，然后由独立控制连接在 `pg_stat_activity` 中同时核对本轮随机
`application_name`、完整 PID、数据库、用户、`active` 状态和准确的 `pg_sleep` SQL。只有全部
一致才使用参数绑定调用 `pg_catalog.pg_terminate_backend(?)`，且要求服务器明确返回 true。
它不会按 application name 模糊匹配或批量终止会话。异常清理也必须用独立连接重新读取同一
PID，并再次精确匹配上述全部身份和等待 SQL；目标已变化时测试失败关闭，不发送终止请求。

执行账号必须仅在隔离测试库拥有创建/删除本测试 schema、表和数据的权限，能够在
`pg_stat_activity` 中看到自己目标会话的 `pid/application_name/datname/usename/state/query`，
并能调用 `pg_terminate_backend` 终止**自己的**目标连接。执行前可先做只读探测：

```sql
SELECT pid, application_name, datname, usename, state, query IS NOT NULL AS query_visible
FROM pg_catalog.pg_stat_activity
WHERE pid = pg_catalog.pg_backend_pid();

SELECT n.nspname, p.proname,
       has_function_privilege(current_user, p.oid, 'EXECUTE') AS executable
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'pg_catalog' AND p.proname = 'pg_terminate_backend';
```

第二条只证明目录级 `EXECUTE` 权限，服务端仍可能进行角色级检查；最终以夹具对本轮自建连接的
精确终止结果为准。不要为了通过测试授予 SYSADMIN、超级用户或宽泛监控权限；若目标版本要求
额外最小角色，由数据库管理员按该版本权限模型授予专用测试账号，并在验收后回收。

该源码保持 Java 8 语法，便于内网 GRT 使用；公开仓也可这样执行：

```sh
export GAUSSDB_HISTORY_ALLOW_DDL=YES
fixture_classes=$(mktemp -d)
target_log=$(mktemp)
javac -source 8 -target 8 -d "$fixture_classes" integration/HeadlessTransactionTerminationTest.java
set +e
java -cp "$fixture_classes:$GAUSSDB_HISTORY_JDBC" HeadlessTransactionTerminationTest \
  "$GAUSSDB_HISTORY_CONNECTION" >"$target_log" 2>&1
target_status=$?
set -e
node scripts/verify-headless-transaction-termination.mjs "$target_log" "$target_status"
```

测试只终止自己刚创建并再次精确确认的目标连接。成功日志必须包含 9 个逐项 `PASS`、
`TOTAL CHECKS 9 PASS 9 FAIL 0`、同一随机 schema 的 `CLEANED`，以及
`RESULT PASS test=transaction-termination scope=server-jdbc gui=false`。门禁拒绝取消 SQLSTATE
`57014`、false/错 PID 响应、缺失清理、非零退出、重复终态和任何异常行。

该结果证明服务端/JDBC 的会话终止、未提交事务回滚和新连接可用性；`gui=false` 是结果契约，
不能据此声明 DBeaver 菜单、会话行选择、确认框、刷新或 GUI 自动化通过。无桌面矩阵中的 GUI
终止项应明确标为 `SKIP/UNSUPPORTED: headless-no-swt`，不能降级为“目标成功启动”。

同一 GaussDB 505.2.1.SPC0800 分布式 ORA（1 CN、1 分片 × 3 DN）环境中，Java 8 headless
termination 9/9 及严格 verifier 通过：完整 64 位 PID 被精确匹配，目标以 SQLSTATE `57P01`
断开，未提交记录回滚，新连接提交成功，随机 schema 清理完成。该结果仍只属于服务端/JDBC
和无界面夹具证据，不冒充 DBeaver 会话管理页面的 Terminate 操作验收。

本轮离线门禁共 337/337 通过；新增台账包括 PackageReplay 协作锁/重放序列化合同 31/31、
集中式连接准备合同 6/6、定向脚本路径可移植性合同 8/8；Package 能力合同 9/9、降级合同
19/19 通过。离线合同、真库夹具和 DBeaver GUI 是三层不同证据，汇总时不得相互替代。

GB18030数据库场景另需管理员在隔离实例预建专用数据库：存储编码GB18030，兼容模式ORA，所有者为测试账号；保持JDBC默认UTF8，不设置客户端编码初始化SQL。配置 `GAUSSDB_HISTORY_ENCODING_DATABASE` 为该库名称（仅小写字母、数字、下划线）。连接主机/端口/认证沿用私有连接文件，测试只替换URL中的数据库路径，并创建、清理该库内随机schema，不自行建删数据库。管理员应按已有密码认证方式仅放行测试账号/该库/测试客户端地址，结束后移除临时访问规则。缺少变量时此项跳过，不算通过。创建库的DBCOMPATIBILITY标记需以目标版本为准，本地507使用ORA而非A。

本地日志、结果写入被忽略的 `results/`。脚本拒绝将旧 JUnit 报告当作当前结果。公开结果仅包含测试 ID、状态和汇总，不包含环境属性、连接信息或标准输出。

提交前须人工检查覆盖范围、跳过原因、失败处理和敏感信息。构建成功不能替代 GUI 或目标金融版本验收；当前没有完成七千条等价迁移。验证通过后推送公开测试仓，DBeaver 生产修改提交源码仓。

当前场景范围和已知限制见 [场景清单](SCENARIOS.md)。

完整历史清单的逐组登记和剩余工作见 [覆盖计划](COVERAGE_PLAN.md)。该表未完成项不因某一批回归成功而自动关闭。
