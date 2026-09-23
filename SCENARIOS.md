# 场景清单与层级

最新补充：表 DDL 读取批次 **870 项，855 通过、15 跳过、零失败/错误**（普通权限配置，`results/run-qRnIdr`）。新增 PostgreServerGaussDBTest 5 项直接调用生产 readTableDDL，断言原生文本含分布子句/中文原样保留、OID 参数绑定、不支持时不打开会话，以及空结果/权限拒绝/prepare 失败的降级和资源关闭。初次编译测试常量误写 ORA，改为仓库实际 ORACLE 枚举后完整通过；未修改生产代码。报告 `docs/gaussdb/test-results-20260923-table-ddl-reader.json`。这不是真实导出重建或 GUI 验收，其他范围仍按覆盖计划执行。

最新执行摘要：分布式批次在普通账号、临时监控管理员两个配置下，各 **865 项，850 通过、15 跳过、零失败/错误**。正反权限测试分别在对应配置通过，不能将两个计数相加。ROUNDROBIN 当前被服务端拒绝，仍未通过。下文按时间保留各历史批次，不应将旧批次计数当最新总数。Linux GUI 变量修改/非法值拒绝/变量名监视/修改值参与 OUT 计算/回滚/F10 首次暂停终止的独立证据见 [GUI_PROGRESS.md](GUI_PROGRESS.md)，不并入 JUnit 数量。

最新新增真库方法：`closingConnectionRollsBackUncommittedRowsAndRejectsFurtherStatements`、`enablingAutocommitCommitsPendingRowsButLaterManualRollbackRemainsIsolated`、`readOnlyTransactionRejectsWritesAndNormalConnectionRemainsWritable`。分别验证关闭回滚及已关闭连接拒绝使用、自动提交切换的提交边界、只读事务 SQLSTATE 25006 与恢复后提交。均以其他连接观察实际数据，使用测试随机 schema 并清理。结果 `docs/gaussdb/test-results-20260923-connection-lifecycle.json`，本地执行 `results/run-fIxeiF`。不是连接池、SSL、异常认证或自动重连验收。

此表映射用户提供的场景摘要，不替代未取得的原始方法断言。测试 ID 以 DBeaver JUnit 类名、方法名为准。

| 范围 | 实际入口 | 本轮状态 |
|---|---|---|
| 参数模式、绑定、安全文本、默认值及 OUT 位置 | GaussDBDebugArgumentsTest | 单元测试已通过 |
| 包批次 ALL/SPEC/BODY、失败停止、取消、诊断保留 | GaussDBPackageCompileBatchTest / GaussDBPackageCompilerTest | 单元测试已通过；本轮未重跑集中式包真库 |
| 注释、字符串、CASE、嵌套查询、分布式 SQL 拆分 | GaussDBDialectTest | 单元测试已通过；不代表每种语法在服务端可执行 |
| IN/OUT/INOUT、OUT 首中尾、NULL、带引号名称、函数 | GaussDBHistoricalJdbcLiveTest | 507 分布式 ORA 真库通过 |
| 同名重载过程 | GaussDBHistoricalJdbcLiveTest.overloadedProceduresResolveByExplicitInputType | 当前服务端拒绝创建，明确跳过，不算通过 |
| numeric、bigint、中文、NULL 往返 | GaussDBHistoricalJdbcLiveTest | 真实 JDBC 通过，不代表 GUI 渲染 |
| 提交、回滚及独立观察连接，保存点 | GaussDBHistoricalJdbcLiveTest | 真库通过，不代表调试结束对话框 |
| 主键/非空错误、连接复用、引号元数据、视图和序列 | GaussDBHistoricalJdbcLiveTest | 真库通过 |
| 断点、变量、栈帧、事务竞态及资格门控 | 既有 DebugSession / Routing / Snapshot / Eligibility 测试 | 本轮单元回归通过；既有 Live 测试未全部启用 |
| 数据导出、SQL 历史、连接配置持久化 | DBeaver 对应通用模块 | 待补完整场景映射，不能算覆盖完成 |
| Windows 快捷键、桌面云输入、SWT 控件 | 平台 GUI 测试 | 本轮未执行 |
| HA、扩缩容、Roach、安装升级、运维平台告警 | 不属当前 DBeaver 客户端实现 | 不执行内核或系统破坏性脚本；客户端断线恢复另列测试 |

本轮 71 模块回归共 707 项：695 通过、12 跳过、0 失败/错误。计数包含既有用例，不是本轮新增数量，也不是原历史测试覆盖率。本轮新增 18 个单元测试及 16 个真库测试，其中真库 15 通过、1 跳过。

OUT 修复尚需新的产品打包与 GUI 回归，旧发布安装包不包含该修复。核对依据：DBeaver 仓库 `docs/gaussdb/HISTORICAL_TEST_MIGRATION.md` 与逐项结果 `docs/gaussdb/test-results-20260923.json`。

## 第二批增量（2026-09-23）

上述 707 项是前批次运行快照，不是新增代码的全量验收结果。第二批新增 25 项单元测试及 7 项真库测试：

- SQL 拆分/别名边界 4 项，表分区元数据 5 项，异常分类 3 项，变量监视 7 项，分区边界解析 6 项：已通过。
- DEFAULT、跨 schema 同名过程、保存点失败恢复、批处理回滚、fetchSize 完整取数、二进制/时间戳、DDL 后元数据：7 项已编译，真库待验证。

本次 Docker 和 JDBC 连接均受执行环境权限限制。显式真库运行在建立连接阶段报 `Operation not permitted`，不是通过。后续独立离线回归 289 项：258 通过、31 跳过、0 失败/错误。该筛选不包含完整平台测试；跳过不代表已验证。源仓库记录 `docs/gaussdb/test-results-20260923-offline-followup.json` 仅包含该次新生成的报告。

当前不能标记全部完成或上传为全通过版本；需在允许连接测试库的执行环境完成第二批真库验证，并继续补齐其余适用场景。

## 权限恢复后的第二批复验

权限恢复后实际执行真库，发现并修正两处测试假设：分布式默认分布键不能删除，元数据测试改为删除普通列并保留分布键；供应商驱动批量计数返回 `[4,0,0,0]`，验证总计数并逐行核对四行数据及回滚，不要求每项都为 1。另新增 5 项生产 ExecuteBatchImpl 回归，验证聚合计数、零行匹配、失败关闭、取消和不重复执行；无执行时 DBCStatistics 的哨兵是 -1，不是 0。

最新完整执行：**744 项，732 通过、12 跳过、0 失败/错误**。历史 JDBC 类 23 项中 22 通过、1 因服务器拒绝过程重载创建而跳过；第二批新增 7 项真库已全部通过。结果为 `docs/gaussdb/test-results-20260923-live-followup.json`，原始错误仍保留在本地日志。此结果不关闭 [覆盖计划](COVERAGE_PLAN.md) 中的其他未完成场景，目标仍在执行，未上传为最终验收版本。

## CSV 导出补充

新增 6 项实际 DataExporterCSV 输出断言：SQL NULL/空串/文字 NULL、带分隔符的自定义 NULL 标记、CRLF 行分隔与内嵌换行、引号与换行替换同时存在、长 Unicode 不截断、前导零标识符不丢失。

首次 112 项 CSV 测试中 1 项失败，复现引号转义错误地重新读取原字符串，覆盖换行替换结果。生产修复仅将引号转义输入改为已处理的字符串。完整回归 **750 项：738 通过、12 跳过、0 失败/错误**；其中 CSV 112 项全部通过。不是文件导入、GUI、Excel 或所有历史导出场景完成。证据：`docs/gaussdb/test-results-20260923-csv-followup.json`。

## 执行计划补充

新增 3 项真库测试（聚合排序、连接、UNION ALL），直接执行生产生成的 EXPLAIN XML SQL，将真实 XML 经 DBeaver 会话适配后交给生产解析器，独立按 DOM 逐层比对类型、节点数量、顺序、父引用、总成本与估算行数。为了暴露实际子节点，在独立测试连接设置 `enable_fast_query_shipping=off`，连接关闭即结束；不代表默认下推策略或所有计划节点均验收。

首次聚合计划发现生产 `PostgrePlanNodeXML` 为子节点传入空 parent。已改为当前节点，并新增 3 项 PostgreSQL XML 单元回归（兄弟节点、三级层次、非 ANALYZE 代价属性）。最初空表和默认下推可产生单节点计划，现补数据并强制断言至少两个节点，避免树关系测试空跑。

完整回归 **756 项：744 通过、12 跳过、0 失败/错误**。新增 6 项全部通过，历史 JDBC 类 26 项中 25 通过、1 重载能力跳过。结果：`docs/gaussdb/test-results-20260923-plan-followup.json`。尚未进行执行计划 GUI 及向量/递归节点全面验收。

## 连接与执行器补充

新增 5 项真库场景：查询超时及 SQLSTATE 57014、主动取消及时间边界、Statement 关闭连带关闭 ResultSet 但保留连接、缺失表 42P01 后恢复、maxRows 不改变实际行数。超时和取消均随后用同一连接执行 SELECT 验证复用，不只断言抛异常。取消仅针对本测试 Statement，定时任务有退出和等待机制。

另新增 1 项真实供应商驱动 URL 契约（不连接无关协议），4 项生产 provider 地址格式测试（空项、缺省端口、IPv6、URL 组件注入）。完整回归 **766 项：754 通过、12 跳过、0 失败/错误**。历史 JDBC 类 32 项中 31 通过、1 重载能力跳过。结果：`docs/gaussdb/test-results-20260923-connection-followup.json`。不代表连接向导、SSL、密码存储或 UI 取消按钮已经验收。

## 对象管理补充

新增 7 项真实 JDBC 场景，其中 6 项通过：复合主键名称/KEY_SEQ/唯一性；索引列/非唯一标记及删除刷新；CHECK 23514 且不破坏已有数据；视图重命名与结果不变；依赖阻止 DROP、CASCADE 删除依赖而保留无关表；序列 START/INCREMENT 取值。

1 项序列 RESTART 因当前服务端明确返回 0A000（只支持修改 MAXVALUE/OWNER）而跳过，不算通过；原失败记录保留。原组合测试拆成递增正向测试和独立 RESTART 能力测试。生产共享 PostgreSequenceManager 有生成 RESTART 的路径，尚需 GaussDB 能力门控核实，不能宣称该操作适配完成。

完整回归 **773 项：760 通过、13 跳过、0 失败/错误**。历史 JDBC 类 39 项中 37 通过、2 服务端能力跳过。证据：`docs/gaussdb/test-results-20260923-objects-followup.json`。本批不替代对象编辑器、批量删除向导或其他部署形态验收。

## 序列 DDL 导出边界

确认 GaussDB 没有专属 sequence manager 注册，共享 PostgreSQL 模型/编辑链路。RESTART 的服务端能力门控尚未解决，不能据此关闭所有 PostgreSQL 或其他版本的编辑功能。

源码审查发现 `PostgreSequence.getSequenceBody` 仅输出正增量和非负起点，且用默认边界替换已加载的负边界。修复为保留非零增量，以及已加载元数据中的实际 MINVALUE/MAXVALUE/START（含 0 和负值）。新增 4 项生产 DDL 生成测试：降序增量、负边界/起点、零上界、升序缓存与 CYCLE。首轮测试编译因监视器 API 使用错误失败，已修正；未声称首轮红测复现成功。

完整回归 **777 项：764 通过、13 跳过、0 失败/错误**。新增 4 项通过。证据：`docs/gaussdb/test-results-20260923-sequence-ddl-followup.json`。这是 DDL 文本生成验证，尚未完成降序序列跨库重建或 UI 编辑验收。

## 类型与结果补充

新增 7 项真实 JDBC 测试全部通过：整数数组的 NULL/顺序/边界、JSON 中文与嵌套、SQLXML 转义、布尔 false 与 SQL NULL 的 wasNull 区分、闰日和 TIME 微秒、窗口函数排名/分组、聚合 NULL 计数与十进制精度。

日期初始 SQL 使用 ISO 日期字面量，被当前 ORA 会话的日期格式拒绝；改用显式 `to_date(...,'YYYY-MM-DD')` 测试日期值。没有宣称 ISO 字面量在当前配置通过，也未修改全局 NLS 设置。原失败保留。

完整回归 **784 项：771 通过、13 跳过、0 失败/错误**，历史 JDBC 类 46 项中 44 通过、2 能力跳过。证据：`docs/gaussdb/test-results-20260923-types-followup.json`。本批不等于数据网格、JSON/XML 编辑器、GB18030 或时区验收。

## DML、查询与函数结果补充

新增 6 项真实 507 ORA 分布式 JDBC 场景全部通过：MERGE 匹配更新、未匹配插入及事务回滚；ON DUPLICATE KEY UPDATE 仅更新冲突行；关联 EXISTS/NOT EXISTS 与含 NULL 的 NOT IN；LEFT JOIN/GROUP BY/HAVING 和带空格别名；中文长度/截取/替换/引号/大小写/拼接；abs/ceil/floor/round/mod/power 精确数值断言。

测试调用真实厂商 JDBC，每个场景独占随机 schema，设置查询超时，核对完整有序结果行，结束清理自己创建的对象。对应方法名位于 `GaussDBHistoricalJdbcLiveTest`，不是原内网测试源码迁移，也不代替编辑器补全/高亮验证。

完整回归 **790 项：777 通过、13 跳过、0 失败/错误**；历史 JDBC 类 52 项中 50 通过、2 能力跳过。结果 `docs/gaussdb/test-results-20260923-sql-followup.json`，运行目录 `results/run-mD5B9C`。GUI OUT 过程、参数校验、F8/F9、提交/回滚独立证据另见 `GUI_PROGRESS.md`，不叠加到 JUnit 数量。

## 方言分类及转义补充

新增 5 项生产方言单元测试：配置后的 GaussDB 关键字大小写分类、类型/函数/未知词分类、类型集合修改隔离、带引号标识符往返、标准字符串字面量转义往返（中文/单引号/换行/反斜杠/语句分隔符）。

首次运行 `results/run-Dg3LyJ` 有 1 项失败：测试错误地期待 YEAR 分类为 TYPE。源码 AbstractSQLDialect.addKeywords 明确保留既有 KEYWORD 优先，避免标识符漏加引号。修正断言为 YEAR 属于类型枚举且分类仍为 KEYWORD；没有为使测试通过改生产行为。

复跑 `results/run-m1qfVB`：**795 项，782 通过、13 跳过、0 失败/错误**。GaussDBDialectTest 的 24 项全部通过。证据 `docs/gaussdb/test-results-20260923-dialect-followup.json`。这是方言 API 契约，不代表全部模式、实时语法检查或编辑器高亮均通过。

## CSV 导入边界与缺陷修复

通过生产 DataImporterCSV.runImport 新增 5 项：短行补 NULL + trim；引号逗号/双引号/多行中文；空串与显式 NULL 标记；未闭合引号返回带 IOException 的 DBException；trim + emptyStringNull + 缺列组合。接收器采集生产结果集的实际值，正常结束校验 fetchEnd/close。数据库会话使用 mock，这不是文件向导或数据库写入端到端验收。

首轮红测明确复现 DataImporterCSV.java 的 NullPointerException：短行补齐 null 后直接 trim。生产修复仅跳过 null 元素的 trim，不把缺失值变成空字符串。复跑 CSVImporterTest 12 项全部通过；全量 **800 项，787 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-import-followup.json`，本地运行 `results/run-iHicdy`。新修复尚未装入正在运行的 GUI 副本或发布包。

### 编码、上限及取消

新增 5 项生产导入器测试：GB18030 中文及扩展字符、无表头 UTF-16LE BOM 去除和前导零保留、maxRows 只计数据行、读取前取消、首行后取消。接收器 fetchEnd/close 断言移入 finally，既有未闭合引号异常路径也验证释放。未声称取消后数据库事务已回滚；接收器仍是 mock。

CSVImporterTest **17 项全部通过**；完整回归 **805 项，792 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-import-lifecycle.json`，本地运行 `results/run-CA0qP0`。金融字符集覆盖限于本地 CSV 字节解码，不代表数据库连接 client_encoding 或客户金融版本验证。

## JDBC 警告、元数据与生命周期

新增 4 项真实 507 测试全部通过：过程 RAISE WARNING 能通过 Statement.getWarnings 读取和 clearWarnings 清除且继续查询；结果元数据保留中文/空格别名、列序、numeric(18,4) 精度与标度、varchar(37) 长度；ResultSet/Statement 关闭后操作抛 SQLException，但连接 isValid 且能继续查询；参数化插入含分号/引号/DROP 文本/中文/换行/反斜杠，按完整原文取回且表仍在。

历史 JDBC 类 56 项，54 通过、2 能力跳过。完整回归 **809 项，796 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-jdbc-contracts.json`，运行 `results/run-idizTN`。仅证明所用厂商驱动和 507 的契约，不代表所有驱动版本或 GUI 警告显示已经验证。

## 连接配置复制隔离

新增 ConnectionConfigurationHistoricalTest 4 项，使用生产 DBPConnectionConfiguration/Bootstrap/ShellCommand：复制后的驱动/provider 属性独立；认证属性从外部 Map 防御复制、复制后移除不影响原值；初始化 SQL、默认 schema 和自动提交配置保留且独立；连接事件命令深复制、修改/清除不影响原对象。命令仅为未执行的测试文本，没有执行外部程序或使用真实凭据。

完整回归 **813 项，800 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-configuration.json`，运行 `results/run-kdwAWV`。这是配置模型行为，不等于连接文件导入导出、安全存储加密或 SQL 历史持久化验收。

## 查询历史执行记录模型

QueryHistoryExecutionTest 新增 6 项：SELECT 的文本/schema/catalog/取数计数及生命周期；DML 影响行与取数行分离；META 查询不会仅凭方言判定标为修改事务；SQLException 保留厂商错误码/文本并标记事务失败；恢复记录的执行+取数耗时；清除错误不丢 SQL 文本。

首轮因模型和测试 OSGi 类加载器不同，包内 API 直接访问触发 IllegalAccessError（测试接入问题）。改为测试中反射调用实际包内方法，没有扩大生产接口。6 项复跑通过；完整回归 **819 项，806 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-history-model.json`，运行 `results/run-wXjdB7`。没有通过数据库持久化/重启恢复/固定收藏/清理 SQL 历史的证据，这些仍未完成。

## CSV 解析与真实 JDBC 写入衔接

新增 3 项：生产 DataImporterCSV 解析中文、引号、跨行和缺列后经厂商 JDBC 写入，独立观察连接验证提交前不可见、提交后完整值；未闭合引号发生在已写入一行后，显式回滚后无数据；重复主键保留 SQLSTATE 23505，显式回滚后无数据。正常及异常路径均检查接收器 fetchEnd/close，关闭断言失败不能被预期异常测试掩盖。

测试启动曾因未初始化 Query Manager 和不支持静态 mock 失败。最终使用应用测试基类并通过 DBWorkbench 正常初始化平台，没有静态 mock 或修改生产日志服务。最新完整回归 **822 项，809 通过、13 跳过、0 失败/错误**，历史 JDBC 类 59 项中 57 通过、2 能力跳过。证据 `docs/gaussdb/test-results-20260923-csv-jdbc.json`，运行 `results/run-1KSrvf`。

边界：接收器是测试 JDBC 写入桥接器，不是生产 DatabaseTransferConsumer；回滚由测试显式执行。因此这些结果不证明导入向导、自动取消回滚、字段映射 UI 已验收。

## 权限 SQL 生成与实际授权范围

PostgrePrivilegeCommandTest 新增 7 项：角色引号及限定对象名、REVOKE 不附带转授权、单项转授权、全部权限转授权、DDL 导出显式 ALL、混合转授权拆分、相反操作合并抵消。首轮红测证实全部权限路径丢失 WITH GRANT OPTION。修复生产 PostgreCommandGrantPrivilege：展开显式 ALL，并将可转授权和普通权限分为独立 GRANT，避免提升其他权限；枚举集合确保输出顺序稳定。权限编辑器和对象 DDL 导出使用该共享入口。

真库新增 productionGrantCommandsPreservePerPrivilegeGrantabilityInDatabase：普通对象拥有者执行生产命令生成的 SQL，向预建 NOLOGIN 测试角色赋 SELECT（可转授权）及 INSERT（不可转授权），用 has_table_privilege 检查两项基本权限、两项转授权和未赋予的 UPDATE；执行生产 REVOKE 后逐项确认为 false。对象元数据为测试 mock，SQL 生成器、厂商 JDBC 和数据库权限检查是真实实现；这不是权限编辑器 GUI 或第二用户实际访问验收。

夹具校正：507 对 NOLOGIN 角色仍要求密码；由管理员在服务器生成符合策略的随机密码。pg_roles 对普通用户过滤其他角色，因此不能以普通用户查不到角色判断不存在；管理员确认 NOLOGIN，测试验证真实授权结果。运行结束删除临时角色并确认角色计数 0，随机 schema 由测试清理。

完整回归 **830 项，817 通过、13 跳过、0 失败/错误**；历史 JDBC 类 60 项中 58 通过、2 能力跳过。证据 `docs/gaussdb/test-results-20260923-privileges.json`，运行 `results/run-lj7A5H`。新修复尚未打入发布包。普通用户拒绝访问、权限 UI、默认权限和列级权限仍待继续覆盖。

### 列级权限边界修复

新增 3 个命令测试：多个权限分别保留带引号列名、默认权限 schema/授权者/接收者正确引用、重复合并幂等。测试夹具最初有嵌套 Mockito stubbing 错误，修正后真正红测确认生产输出 `GRANT SELECT, UPDATE(column)`，SELECT 实际不受列限制。

扩展现有真库授权测试，使用 id 和 restricted_value 两列；修复前数据库明确返回 restricted_value 的 SELECT 权限为 true，与预期 false 不符。生产修复改为每一项权限均附列名：`GRANT SELECT(id), UPDATE(id)`。修复后真库逐项验证两列的 SELECT/UPDATE/INSERT，只有 id 的 SELECT/UPDATE 为 true；生产 REVOKE 后全部 false。仍是生产 SQL + JDBC + 数据库权限函数验证，不等于另一登录用户执行查询或 GUI 验收。

命令测试 10 项全部通过；完整回归 **833 项，820 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-column-privileges.json`，运行 `results/run-TEF5rG`。临时 NOLOGIN 角色已删除并确认计数 0。默认权限目前只验证生成 SQL，未完成真库新对象继承权限验证；发布包尚未更新。

### 默认权限继承与 ACL 名称解析

新增 productionDefaultPrivilegesApplyOnlyToFutureObjectsAndRevocationIsNotRetroactive 真库场景：生产生成的 ALTER DEFAULT PRIVILEGES 仅向专用随机 schema 中以后创建的表赋 SELECT；旧表不追溯授权；撤销后新表无 SELECT，之前已继承权限的表仍保留 SELECT。各阶段同时验证 INSERT 和 SELECT WITH GRANT OPTION 均未意外获得。使用普通对象拥有者连接与预建 NOLOGIN 角色，生产 SQL 生成器、厂商 JDBC、has_table_privilege 均真实执行，元数据对象为 mock。不是第二登录用户访问或 GUI 验收。

PostgreAclParsingTest 新增 4 项：含等号及转义双引号的角色名、授权者名称和逐项转授权标记、PUBLIC/重复角色/无分隔符输入、默认 ACL 的授权者与未授予项。红测发现 ACL 按第一个等号截断引号内角色名，且授权者引号和名称内部双引号未正确还原。生产修复识别引号外分隔符，并用方言的反转义入口处理授权双方名称。名称边界仅为模型测试，不声称已在真库创建特殊名称角色。

完整回归 **838 项，825 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-default-acl.json`，运行 `results/run-yva6Xu`。管理员删除临时角色并核对计数 0。权限 UI、独立用户拒绝访问等未完成项继续保留。

### JDBC ACL 数组进入生产解析器

扩展既有 productionGrantCommandsPreservePerPrivilegeGrantabilityInDatabase：授权后从 pg_class 读取真实 relacl JDBC Array，交给 PostgreUtils.extractPermissionsFromACL（Array 入口），检查目标角色恰好一项、SELECT 含转授权、INSERT 不含转授权、UPDATE 未授予；撤销后该角色不再出现在解析结果，最后释放 JDBC Array。使用实际 PostgreServerGaussDB 类型识别，其他对象元数据为 mock。修复测试接入时遗漏的服务端类型对象后通过；本轮没有新增生产修改，也没有靠拆分测试增加用例计数。

尝试在 507 创建含等号和双引号的专用角色被服务端以 Invalid name 拒绝，随后以该不存在角色运行的两项权限测试也失败。这不算通过。改用合法 NOLOGIN 测试角色后完整链路通过；特殊角色名仍只有解析器单元证据，不能对当前 507 承诺该名称受支持。

最新回归 **838 项，825 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-jdbc-acl.json`，运行 `results/run-GD5bCR`。临时合法角色已删除，管理员核对测试角色前缀计数为 0。

## 对象搜索范围、绑定与关闭

PostgreStructureSearchTest 新增 5 项，通过生产 findObjectsByMask 入口验证：含引号/分号的名称 mask 只作绑定值且使用指定 LIKE/上限；SQLException 保留原因并关闭资源；全局 schema 过滤器全部不匹配时不发起不受限查询；部分匹配仅绑定保留 schema 的 OID，注释 mask 与 OID 参数顺序正确；取消时不读结果行并关闭结果集/语句/会话。

红测确认原逻辑将“过滤后没有 schema”转换为“不限制 schema”并打开查询会话。修复在启用过滤器且零匹配时直接返回空结果。这是客户端可见范围过滤，不是数据库访问权限控制。测试使用 mock JDBC 和元数据，不等于搜索 UI/真库搜索验收。

完整回归 **843 项，830 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-search-scope.json`，运行 `results/run-XIyhgq`。本次仍预建角色执行两项权限真库场景，结束删除并确认计数 0。搜索结果类型与对象解析、schema 搜索过滤、多类型选择、包/同义词支持情况仍需继续核实。

### 关系类型与跳转目标

新增 5 个关系类型参数化场景（r/p/f/v/m）及 1 个缺失 schema 场景。生产搜索入口必须保留结果类型和名称，通过 schema+OID 解析正确对象；对象随后被删除时抛 DBException；无法解析所属 schema 时不发布无效引用。最初红测证实 p（分区表）和 f（外部表）都被标为 PostgreMaterializedView，修复分别映射为 PostgreTable 与 PostgreTableForeign。r/v/m 原行为保持。

搜索类 11 项全部通过；完整回归 **849 项，836 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-search-types.json`，运行 `results/run-4zUrtE`。本组为 mock JDBC 目录行的生产搜索入口测试，尚非真库元数据或 GUI 跳转验收。权限回归临时角色已删除且计数 0。

### 507 真库表/视图搜索

新增两项真库测试，调用 PostgreStructureAssistant.findObjectsByMask，JDBCSession/Statement/ResultSet 接口通过测试桥接器转发到厂商驱动。SQL 与绑定顺序由生产实现生成，查询真实 pg_class/pg_namespace，非手写等价搜索 SQL。上下文/schema 元数据对象为 mock，不算完整连接注册或搜索 UI 验收。

productionTableSearchUsesRealCatalogCaseCommentsAndLimit 验证表/视图名称和结果类型、LIKE/ILIKE 大小写差异、LIMIT、开启/关闭注释搜索、含引号分号文本无匹配且不破坏对象。productionSearchKeepsSameNamedTablesInTheirRequestedSchema 验证两个随机 schema 的同名表各返回一项，删除其中一个后该 scope 无结果、另一个仍保留。测试结束清理各自创建的 schema。

完整回归 **851 项，838 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-live-search.json`，运行 `results/run-jfsml2`。权限回归临时角色再次清理并确认计数 0。函数/过程、列、约束、类型、schema 搜索和 GUI 仍需补齐。

### 507 列、约束和复合类型搜索

新增 productionColumnSearchExcludesSystemDroppedAndIndexAttributes，真实建表带主键、删除一列、添加列注释，再调用生产列搜索。修复前结果包括已删除列占位名、ctid/xmin/xmax 等系统列以及来自主键索引的重复 id，红测准确复现。生产查询增加正 attnum、非 attisdropped 和表/视图关系类型条件，修复后仅返回 id/search_col，注释搜索也只返回目标列。新增一个无数据库测试固定查询过滤条件。

productionConstraintAndCompositeTypeSearchFindNamedCatalogObjects 验证真实命名主键/CHECK 约束，以及 CREATE TYPE AS 复合类型搜索（隐式数组类型不混入结果）。测试复用生产搜索 SQL→真实 JDBC 的桥接器，目录数据真实，仍不代表 GUI 或对象元数据缓存整体已验收。

完整回归 **854 项，841 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-column-search.json`，运行 `results/run-JCIkr0`。历史 JDBC 类 65 项中 63 通过、2 能力跳过。临时角色删除并确认计数 0；随机 schema 由用例清理。

### schema 搜索范围和列引用类型

新增 schemaSearchHonorsTheSameEnabledSchemaFilter 与 columnSearchReferenceIsTypedAsAColumn 两个入口测试。修复前红测分别显示 schema 搜索 SQL 没有 n.oid 过滤和列引用被标记为 PostgreTableBase。生产修复向 schema 查询传递已计算的 namespace 范围，保留 has_schema_privilege 检查并绑定 schema OID；列引用改为 PostgreTableColumn。

新增真库 productionSchemaSearchExecutesNamespaceIdBinding，验证生产 schema 查询能执行 mask/OID 参数绑定、返回目标 schema 类型和名称、不存在 mask 返回空。mock 测试证明过滤 SQL 与绑定，真库证明该 SQL 可执行及结果；未声称完整全局搜索 UI 已验收。

完整回归 **857 项，844 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-schema-search.json`，运行 `results/run-mNVHZn`。临时权限角色删除后计数 0。更多搜索对象类型、跨 catalog、结果上限组合及 UI 仍需覆盖。

### 分布策略、跨节点读取与权限

- `compositeHashKeysIncludingNullPreserveRowsAndAggregation`：复合 HASH 键包含 NULL、中文和单引号，40 行准确保留；count(id)=32、sum=50.00、两组各20行；目录 locator=H，删除 NULL 键后回滚、观察连接仍40行。
- `replicatedLookupJoinDoesNotMultiplyRowsAcrossDataNodes`：复制维表2行与 HASH 事实表100行 JOIN，每组50行，不因多 DN 放大；目录 locator=R，独立查询维表仍2行。
- `roundRobinDistributionReturnsEveryRowExactlyOnce`：保留101行唯一性、和、目录断言；当前创建返回 SQLSTATE 0A000，能力跳过，不算通过。初始红测记录 `results/run-HgeN6f`。
- `ordinaryAccountCannotBypassCoordinatorWithExecuteDirect`：实际普通账号收到42501，随后连接仍可查询，通过 `results/run-xZvUBe`；不是向账号静默提权。
- `executeDirectOnActualTableNodesReconstructsTheCoordinatorRows`：从测试表 nodeoids 枚举真实 DN，逐节点查询并排序，精确等于1至100，没有丢失或重复；授权配置通过 `results/run-KIRyep`。起初普通账号尝试被明确拒绝（`results/run-2sBV8G`），因此建立两种配置分别验证。

完整回归两次各865项/850通过/15跳过/零失败错误。报告分别为 `test-results-20260923-distribution-ordinary.json` 和 `test-results-20260923-distribution-monitor.json`。两报告的权限正反用例互补，不能要求同一账号同时拥有和不拥有权限，也不能把环境跳过当通过。测试前确认专用账号 rolsystemadmin=false/rolmonitoradmin=false，授权配置临时 MONADMIN，结束 NOMONADMIN 后再次确认两个字段 false；临时 grantee 删除后计数0。随机 schema 自动清理。

以上为真实厂商 JDBC/507 分布式 SQL 与结果验证，不证明分布策略 GUI 编辑、DDL 导出后重新建表或其他内核版本。ROUNDROBIN 仍是未覆盖能力约束，不能因本机拒绝而宣布历史场景全覆盖。
