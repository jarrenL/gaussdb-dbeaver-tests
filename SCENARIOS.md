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
