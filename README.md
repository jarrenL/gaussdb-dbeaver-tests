# GaussDB / DBeaver 客户端回归测试

根据已提供的历史场景摘要独立编写，不包含内网 TPDSS 或数据库内核测试源码，不声称与原七千多条用例逐条等价。

## 仓库职责

- 本仓库：测试范围、执行入口、结果审计与环境说明。
- DBeaver 仓库：依赖 Eclipse/OSGi 及内部模型的 JUnit 测试、生产修复。
- 内网连接信息、密码、原始 JDBC 日志及本地运行结果不得上传。

DBeaver 源码：https://github.com/jarrenL/dbeaver 。当前工作区内的测试扩充尚未提交发布，使用时应核对后续记录的源码提交，不直接假定远端已有新用例。

## 运行

先准备 DBeaver 26.1.5 GaussDB 适配源码及并列的 dbeaver-common 依赖，按其说明准备构建 JDK、Maven 和离线缓存。测试执行的是 Maven/Tycho 中的实际生产代码，不复制一套简化实现来验证自己。

```sh
export JAVA_HOME=/path/to/build-jdk
bash scripts/run-dbeaver-tests.sh /absolute/path/to/dbeaver
```

不配置真库时相关用例跳过，不能当作服务端验证通过。启用真库时，仅允许使用可建删对象的专用测试库：

```sh
export GAUSSDB_HISTORY_CONNECTION=/absolute/private/connection.properties
export GAUSSDB_HISTORY_JDBC=/absolute/private/vendor-jdbc.jar
export GAUSSDB_HISTORY_ALLOW_DDL=YES
bash scripts/run-dbeaver-tests.sh /absolute/path/to/dbeaver
```

连接文件需权限 0600，包含 `url`、`driverClass`、`user`、`password`。必须与供应商 JDBC jar 匹配，不提供真实凭据示例。新用例创建随机 `dbv_hist_` schema，仅清理自身成功创建的 schema；不要连接生产库。

## 结果与发布原则

本地日志、结果写入被忽略的 `results/`。脚本拒绝将旧 JUnit 报告当作当前结果。公开结果仅包含测试 ID、状态和汇总，不包含环境属性、连接信息或标准输出。

提交前须人工检查覆盖范围、跳过原因、失败处理和敏感信息。构建成功不能替代 GUI 或目标金融版本验收；当前没有完成七千条等价迁移。验证通过后再推送到用户指定的测试仓库，DBeaver 修复单独提交到其源码仓库。

当前场景范围和已知限制见 [场景清单](SCENARIOS.md)。
