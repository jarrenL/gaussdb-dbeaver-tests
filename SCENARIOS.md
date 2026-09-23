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
