# TLS 测试方法与边界

## 独立端点入口（2026-09-30首轮通过，重复验收中）

新增 `node scripts/run-tls-live.mjs /absolute/path/to/dbeaver`，沿用历史运行器的JDK、Maven、厂商JDBC、分布式配置和显式DDL同意环境变量。入口创建专用容器，复制本地集中式507程序目录（不复制数据），初始化两个仅含合成测试账号的实例。宿主机仅绑定127.0.0.1的55472、55482端口；两个实例需避开相邻内部端口，端口被占用则失败，不接管已有服务。证书、私钥和随机口令配置均存放私有临时目录，证书有效期2天。结束删除本轮容器及本地临时文件；强杀中断仍需核对遗留资源，不能直接用于业务环境。

`GAUSSDB_HISTORY_TLS_CONNECTION` 指向匹配地址的TLS端点；`GAUSSDB_HISTORY_TLS_WRONG_HOST_CONNECTION` 指向可信但地址不匹配的另一端点。未配置新变量时兼容旧的历史连接文件入口。三项TLS测试的外层连接也执行相应verify-full/verify-ca校验，不用明文建测试schema。SSL-off场景继续连接原SSL-off端点，因此不需要重启原数据库，也不需要将互斥场景分批。

五项生命周期自测验证正常/异常退出、部分初始化失败、精确容器身份校验和清理失败传播。首轮run-PQPfG3：2724项，2712通过、12跳过、零失败/错误；三项TLS实际握手通过，原SSL-off场景同轮通过。临时TLS容器、全量导出临时实例和集中式/角色夹具均清理，独立容器列表确认无TLS残留。第二轮重复验收已启动；首轮不作为重复性证明。这里只证明厂商JDBC测试入口，不证明客户端证书配置向导已验收。

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
4. `strictTlsRejectsTrustedCertificateWithWrongHostname`：服务端另装SAN仅wrong-host.invalid的有效测试证书，客户端通过GAUSSDB_HISTORY_TLS_WRONG_HOST_CA信任它，不同时设置前两项TLS变量。verify-ca前后查询1/2成功，verify-full必须报08类且明确hostname错误，证明证书受信任仍执行主机名校验。此批次不能同时执行要求正确SAN的正向测试。

## 已验证与待验证

2026-09-23，GaussDB507分布式CN、厂商JDBC、上述1/2通过；第3在此前SSL-off批次通过。TLS-on批次第3跳过，两种互斥环境分开报告。

主机名不匹配已在独立证书批次验证（run-7KYLa5）。证书过期、双向客户端证书认证、DBeaver证书配置UI、其他目标版本尚未完成。配置映射单测也不能代替这些握手/UI场景。
