# 真库专项结果校验

`run-live-plan-focused.mjs` 在 Java 正常退出后调用 `verify-live-selection.mjs`，严格核对当前 JUnit Console legacy XML 输出。独立临时目录保存本次报告，不复用历史报告目录。

## 必须满足

- 所有报告时间不早于本次 Java 启动。
- XML suite 有结束标记，计数为有效非负安全整数。
- 实际 testcase 数与 suite 计数一致；逐项 failure/error/skipped 与汇总一致且全为零。
- 用例身份（类名＋方法及参数序号）不得重复，必须与预期集合完全一致。
- `--set-queries` 精确要求四项集合查询；默认执行计划模式精确要求六项，不能用其他用例凑数。
- 没有报告、只产生空引擎报告、少跑、错误报告和跳过均拒绝。

这不是任意 XML 的通用验证器，输入限定为 JUnit Console 产生的 legacy XML。CDATA 和 XML 注释中的类似标签不会作为结果解析。Java 非零退出在读取报告前已使专项命令失败。

## 自测及实际失败报告

```sh
node --test scripts/verify-live-selection.test.mjs scripts/verify-regression-results.test.mjs
```

2026-09-29：新校验13项、原校验7项，合计 **20通过、0失败、0跳过**。覆盖两个正确选择集、无报告/零项、缺项、同数量错误身份、重复、过期、失败、错误、跳过、伪造汇总、截断/非法计数和CDATA。

另读取实际 `/tmp/live-plan-focused-Dyh5BN/reports`，正确拒绝四项 JDBC 建连权限错误报告。该拒绝检查通过只证明门禁有效，不代表真实 JDBC 用例通过。真实四项仍为0通过；全部连接成功的专项执行仍待网络条件恢复。

这些属于测试设施验证，不计入 DBeaver 功能通过数量，也不替代真库/GUI 验收。
