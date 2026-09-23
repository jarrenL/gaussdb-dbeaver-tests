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
