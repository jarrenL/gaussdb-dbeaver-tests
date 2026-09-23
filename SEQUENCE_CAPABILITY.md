# 序列管理验证边界

## 生产入口

GaussDB当前复用PostgreSequence模型和PostgreSequenceManager管理器，并非另有独立序列编辑实现。

- 创建、删除分别由管理器生成CREATE SEQUENCE、DROP SEQUENCE。
- 修改按命令中实际变化的属性生成ALTER SEQUENCE，包括步长、上下界、起始值、当前值、缓存和循环。
- 当前值lastValue非空时生成RESTART；PostgreSequence.AdditionalInfo.getLastValue目前标记为可更新，没有GaussDB专用门控。

## 已知不一致，不视为已修复

集中式及分布式507实测均拒绝ALTER SEQUENCE RESTART，SQLSTATE为0A000。当前客户端仍能生成该语句，这是待处理的能力门控问题；测试生成了预期SQL不等于该SQL在GaussDB上可执行。

不能直接将RESTART替换为setval：这会改变事务和并发语义。需进一步确认各目标版本能力以及属性编辑入口，再实施明确的只读/拒绝提示策略；不能影响正常PostgreSQL的RESTART支持。

## 本轮新增验证

- 管理器SQL单元断言：完整负步长/负下界/零上界/负起始值/负重启值/缓存/非循环组合；仅启用循环不改变其他属性；空命令或仅说明变化不生成空ALTER；lastValue为NULL不生成RESTART NULL。
- 真库场景分别配置集中式及分布式连接，执行实际管理器生成的创建/删除SQL。使用随机schema和中文空格序列名，验证nextval为1/2、目录类型S、删除后访问42P01、重建从1开始、再次删除后目录残留0。
- SQL生成单测不替代属性编辑UI；本轮不声称已验收序列重命名、注释、UI修改、并发取号或GaussDB全部ALTER选项。

## 执行结果

run-jQcTUO：993项，971通过、22跳过、零失败/错误。新增4项管理器单元用例和2项真实数据库生命周期用例全部通过；集中式测试schema/其他连接残留0，分布式临时授权角色已删除。公开报告为DBeaver仓库docs/gaussdb/test-results-20260923-sequence-manager.json。

前序run-Tzs86q因本分支无VoidProgressMonitor.INSTANCE而编译失败；run-3o1Jqn因OSGi不能mock受保护内部命令类失败。测试夹具改为构造monitor和实际命令对象后重跑通过，不属于生产缺陷修复。
