# 批量删除取消的界面证据校验

运行校验器自身测试：

```sh
node --test scripts/verify-atomic-delete-cancel.test.mjs
```

校验三份实际SWTBot快照：

```sh
node scripts/verify-atomic-delete-cancel.mjs confirmation.result waiting.result canceled.result
```

输入依次为：确认框列出专用fixture的两张目标表；后台任务处于执行中且取消按钮可用；操作取消后的稳定状态（错误详情已展开，可以读取SQLSTATE）。所有快照必须完整结束于OK且不含FAIL。

校验内容：只选择first/second而未选keep；存在隔离事务任务和可用取消入口；最终SQLSTATE57014；任务不再活动；主窗口可操作；错误窗口只有一个。数据库锁状态、是否提交/回滚和数据完整性**不由此脚本推断**，返回not_checked，必须另行独立数据库检查。

12项脚本测试涵盖正常单报告，以及双窗口、无错误窗口、其他SQL错误、仍在运行、取消禁用、选错表、多选表、无任务、主窗不可操作、命令失败、输出截断的反例。测试输入是合成快照，只证明校验器行为。

另外用上一轮实际1002/1003/1005快照执行负向校验，确定因重复错误窗口被拒绝，错误原因与现场一致。新单窗口补丁尚未装入GUI复验，因此不能把合成正例或旧记录反例算作修复后产品验收通过。JUnit回归统计与本脚本12项测试分别报告，不混加。
