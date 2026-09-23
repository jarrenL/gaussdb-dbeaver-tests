# TLS 测试方法与边界

仅在可重启的隔离数据库执行。不要在生产实例修改证书、认证规则或重启节点。

## 准备

- 使用现有真实 JDBC 测试的连接属性文件和厂商驱动；密码只放权限为0600的本地属性文件，不放命令行、仓库或报告。
- 测试服务端证书包含连接地址对应的 SAN（本次为 localhost、127.0.0.1），尚在有效期内。客户端信任此测试证书；这是隔离测试，不建议生产使用自签名服务端证书。
- 准备另一份有效但与服务端无信任关系的证书，不能用损坏文件替代错误 CA 场景。
- 507 本次环境要求服务端证书和私钥均0600、数据库运行用户所有，所在目录可访问。本次证书0644导致服务端 FATAL，客户端仅显示无法识别 SSL 消息；需同时查服务端日志。
- `ssl`、`ssl_cert_file`、`ssl_key_file` 在本实例为 postmaster 上下文，修改后需要重启 CN。保存原值及启动参数，验证完恢复。不要修改共享 HBA 以绕过认证。

## 执行

在已有运行器环境变量基础上设置：

```sh
export GAUSSDB_HISTORY_TLS_CA=/absolute/path/to/trusted-test.crt
export GAUSSDB_HISTORY_TLS_UNRELATED_CA=/absolute/path/to/unrelated-test.crt
bash scripts/run-dbeaver-tests.sh /absolute/path/to/dbeaver
```

这两个变量只引用证书，不引用私钥。未提供时相关测试明确跳过，不计通过。

## 断言

1. `strictTlsConnectsWithTrustedCertificateAndRejectsMissingTrustFile`：SHOW ssl=on，verify-full连接后查询中文/数值；不存在的信任文件必须报08类连接异常，不得明文回退；原连接仍能查询。
2. `strictTlsRejectsExistingUnrelatedCertificateWithoutDowngrade`：正确证书先连接成功；有效但无关的证书必须报08类错误且异常链包含SSLHandshakeException；再次使用正确证书查询成功。双向正向对照排除服务器不可用造成的假拒绝。
3. `requiredSslDoesNotSilentlyDowngradeWhenServerSslIsDisabled`：另在ssl=off时运行，require报08004；prefer允许明文回退。该结果绝不作为加密连接证据。

## 已验证与待验证

2026-09-23，GaussDB507分布式CN、厂商JDBC、上述1/2通过；第3在此前SSL-off批次通过。TLS-on批次第3跳过，两种互斥环境分开报告。

主机名不匹配、证书过期、双向客户端证书认证、DBeaver证书配置UI、其他目标版本尚未完成。配置映射单测也不能代替这些握手/UI场景。
