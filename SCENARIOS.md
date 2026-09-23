# 场景清单与层级

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
