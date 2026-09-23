# SQL 历史能力与验证边界

## 实现核对

2026-09-23事务历史补查：416快照有独立“回滚”事件，417还显示后续切换自动提交产生的“提交”事件。新增三个生产模型测试确认回滚后切自动提交不会把旧事务改为提交、提交关闭当前事务并建立独立新事务、关闭连接历史将未完成事务标记回滚。run-SnfyTy：967项/947通过/20跳过/零失败错误；不代表全部事件收集/UI都通过。

**已修复、GUI复验待补**：回滚事件显示1月1日，源码QMMCollectorImpl.handleTransactionRollback使用sessionInfo.getCloseTime()而不是oldTxn.getCloseTime()构造END事件；连接仍打开时前者为0。QueryLogViewer经QMUtils读取事件timestamp并格式化。新增测试调用生产collector.handleTransactionRollback和事件创建，隔离后台dispatcher但检查实际eventPool及QMUtils返回时间；run-dBCwoc红测得到真实结束时间vs0，修复为oldTxn.getCloseTime()后run-hHlYz3为968项/948通过/20跳过/零失败错误。报告test-results-20260923-rollback-timestamp.json。尚未安装新model包到GUI，不宣称GUI日期已复验。

- `QMRegistryImpl.getEventBrowser(true)` 使用 `DefaultEventBrowser`，读取 collector 当前内存事件。
- `getEventBrowser(false)` 尝试适配 `QMEventBrowser`，没有适配器时回退到同一默认浏览器。本仓 Java 源码检索只找到此实现；这不是所有发行版/外部扩展均不支持持久化的结论。
- 默认浏览器按对象类型、查询用途、文本和自定义过滤器处理，反向输出最新事件。不能仅因 `QMEventCriteria` 存在日期/状态等字段就声称这些条件在默认路径生效。
- `QMLogFileWriter` 是另一条文件日志路径。落盘及追加通过，不代表查询管理器能在重启后重新读取这些文件。

## Linux GUI 已验证（2026-09-23）

环境：既有隔离 Linux x86_64 DBeaver 26.1.5 GUI，厂商 JDBC 连接 GaussDB507 分布式数据库，普通账号。此副本尚未更新最近模型/游标修复，不能用于声称新游标修复已做GUI回归。

1. 打开查询管理器视图 `org.jkiss.dbeaver.core.queryManager`。
2. 新建独立 SQL 编辑器，不覆盖原脚本，执行只读语句：

   ```sql
   SELECT 'hist_gui_20260923_中文' AS marker, 42 AS value;
   ```

3. 查询管理器出现新记录，SQL全文、SQL/User、成功状态、1行、连接及 `SQLEditor <Script-1.sql>` 来源均可见。结果面板也显示中文标记。
4. 搜索 `HIST_GUI_20260923_中文`，等待异步加载后只剩该SQL记录，原事务记录被过滤；验证大小写不敏感及中文文本。
5. 搜索 `history-no-match-20260923`，等待后列表无行。
6. 清空搜索，等待后原SQL记录和事务记录重新出现，确认搜索未删除历史。

证据：隔离SWTBot队列373–386。有效状态分别为378（新记录）、380（命中）、382（无匹配）、386（清空恢复）。379的即时快照仍显示旧行，不能用它断言过滤结果；383键盘清空未生效，385直接设空后386确认恢复。操作返回OK不作为验收依据。

未执行删除历史、修改业务数据或清空原脚本。本次GUI场景不加入JUnit方法数量。

## 尚未闭环

日期/状态筛选的实际可用入口、跨重启读取、固定/收藏能力、永久删除历史、历史条数上限、取消加载，以及最新模型包安装后的GUI回归。保持这些项目未完成，不能以当前会话搜索通过替代。

## 失败 SQL、运行中取消及恢复

同一隔离客户端与本轮 Script-1，队列394–402：

1. 查询专用schema内不存在的 `history_missing_20260923` 表，结果面板显示42P01、对象不存在和Position15；查询管理器记录失败SQL及错误，不标为成功（395）。随后执行中文标记查询返回1行，历史同时保留失败和成功记录（396）。
2. 首次 `pg_sleep(30)` 已正常执行结束（398），不能计为取消通过。
3. 再执行 `SELECT pg_sleep(120) /* hist_cancel_long_20260923 */;`（399）。独立管理员只读查询pg_stat_activity，确认专用普通账号匹配此标记的active会话数为1。
4. 点击“SQL 编辑器 → 取消活动查询”（400），不是底部已禁用的“取消当前操作”。独立查询匹配active会话数降为0；401历史记录显示执行14秒、厂商错误10490及 `Statements of the current request are canceled`。未等待120秒自然完成，未手工杀会话。
5. 同一编辑器执行 `SELECT 'hist_cancel_recovery_20260923_中文' AS marker, 45 AS value;`（402），成功1行且结果面板中文标记正确；历史同时保留取消错误和后续成功记录。

这些是只读SQL的GUI运行中取消与后续编辑器可用性证据；不推导事务内DML取消回滚、网络阻塞、等待任务调度、历史加载取消或连接PID始终不变。未修改业务数据，不增加JUnit方法数。

## 清除日志按钮：仅清空当前显示

另行执行队列387–393：

- 387确认查询管理器有原SQL和事务两条记录，搜索框为空。
- 388点击“清除日志”后，无确认弹窗，当前列表立即为空。
- 389在本轮专用Script-1执行 `SELECT 'hist_after_clear_20260923_中文' AS marker, 43 AS value;`，新记录显示成功/1行，说明清空未停止后续记录。
- 390–391搜索旧标记 `hist_gui_20260923_中文`，原SQL再次出现。
- 392–393清空搜索后，新SQL、旧SQL、原事务三条全部显示。

与源码一致：`QueryLogViewer.clearLog()`仅`logTable.removeAll()`和`objectToItemMap.clear()`，并未清空collector或删除持久化数据。**不能将此按钮描述为永久删除SQL历史。** 本次只清空显示，记录已重新读取恢复；没有删除业务数据或文件日志。TPDSS的删除/清理历史持久化语义仍不能直接判为迁移通过。
