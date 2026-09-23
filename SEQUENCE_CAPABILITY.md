# 序列管理验证边界

## 生产入口

GaussDB当前复用PostgreSequence模型和PostgreSequenceManager管理器，并非另有独立序列编辑实现。

- 创建、删除分别由管理器生成CREATE SEQUENCE、DROP SEQUENCE。
- 修改按命令中实际变化的属性生成ALTER SEQUENCE，包括步长、上下界、起始值、当前值、缓存和循环。
- 当前值lastValue非空时生成RESTART；PostgreSequence.AdditionalInfo.getLastValue目前标记为可更新，没有GaussDB专用门控。

## 不一致与修复状态

集中式及分布式507实测均拒绝ALTER SEQUENCE RESTART，SQLSTATE为0A000。检查发现客户端此前仍能生成该语句；测试生成了预期SQL不等于该SQL在GaussDB上可执行。

已加入服务端扩展能力supportsSequenceRestart，默认true以保持其他PostgreSQL适配器行为，GaussDB当前适配器为false（依据507集中式/分布式实测，不宣称未来全部版本均不支持）。当前值仍可查看，编辑/更新表达式按此能力控制；命令校验和生成SQL两处均拒绝非空lastValue修改，附中英文说明。混合修改也在生成动作前完整拒绝，避免只执行部分属性变更。其他属性单独修改不受影响。

未用setval替代RESTART，避免改变事务和并发语义。其他目标版本若确认新增RESTART能力，应更新版本/能力策略并补相应正向测试。目前仅代码/属性表达式层已验证，最终GUI点击和发布包仍待验证。

## 本轮新增验证

- 管理器SQL单元断言：完整负步长/负下界/零上界/负起始值/负重启值/缓存/非循环组合；仅启用循环不改变其他属性；空命令或仅说明变化不生成空ALTER；lastValue为NULL不生成RESTART NULL。
- 真库场景分别配置集中式及分布式连接，执行实际管理器生成的创建/删除SQL。使用随机schema和中文空格序列名，验证nextval为1/2、目录类型S、删除后访问42P01、重建从1开始、再次删除后目录残留0。
- SQL生成单测不替代属性编辑UI；本轮不声称已验收序列重命名、注释、UI修改、并发取号或GaussDB全部ALTER选项。

## 执行结果

run-jQcTUO：993项，971通过、22跳过、零失败/错误。新增4项管理器单元用例和2项真实数据库生命周期用例全部通过；集中式测试schema/其他连接残留0，分布式临时授权角色已删除。公开报告为DBeaver仓库docs/gaussdb/test-results-20260923-sequence-manager.json。

前序run-Tzs86q因本分支无VoidProgressMonitor.INSTANCE而编译失败；run-3o1Jqn因OSGi不能mock受保护内部命令类失败。测试夹具改为构造monitor和实际命令对象后重跑通过，不属于生产缺陷修复。

能力门控批次run-r7TVsA：998项，976通过、22跳过、零失败/错误。新增5项覆盖命令验证、直接生成动作拒绝且动作列表为空、其他属性不受影响、真实PostgreSequence实例的属性表达式false/true、Gauss扩展/模型委托与默认PG能力。run-hQQHVD最初用Mockito代理作为表达式对象，JEXL未认可代理类型；改为真实生产模型后通过。报告docs/gaussdb/test-results-20260923-sequence-restart-gate.json。原有两条RESTART服务端正向测试仍跳过，不因客户端正确禁用而改算通过；临时grantee已删除。
