# TLS 测试方法与边界

## 独立端点入口

后续动态端口修正：端点内部端口仍为55472/55482/55492，Docker宿主端口改为自动分配并且仅绑定127.0.0.1；运行器从实际NetworkSettings.Ports读取地址，不猜测、不使用HostConfig代替。独立探测已返回127.0.0.1:64095且容器清理；相关自测红1/16后绿16/16，非法/多重/非loopback绑定仍拒绝。新一轮三端点+编码实跑已启动，尚未将过期证书标为通过。以下静态宿主端口段落为旧运行记录。

当前扩展入口另有过期叶证书端点55492，尚在验证中：由当前有效CA签发、SAN为127.0.0.1、叶证书有效期固定为2020-01-01至2020-01-02。不能用过期的自签名信任锚替代这一场景。OpenSSL须支持`x509 -not_before/-not_after`（本机3.6.3）；不支持时准备失败，不计跳过或通过。运行时端口映射为空时最多等待30次，间隔1秒；错误接口/端口立即失败。

`--expiry-only`只准备过期证书端点，不能与`--encoding`同时使用。用于多端点准备失败时单独验证过期拒绝；其他TLS正向/主机名场景本轮缺少配置会跳过，不得算通过。当前Docker诊断可复现多端口配置的首端口无实际映射，即使有界等待仍失败；未放松loopback校验，也未重启已有服务。

运行 `node scripts/run-tls-live.mjs /absolute/path/to/dbeaver`，沿用历史运行器的JDK、Maven、厂商JDBC、分布式配置和显式DDL同意环境变量。入口创建专用容器，复制本地集中式507程序目录（不复制数据），默认初始化三个仅含合成测试账号的实例（正确证书、错误主机名、过期叶证书）。内部端口55472、55482、55492避开相邻内部端口；宿主端口由Docker动态分配且只绑定127.0.0.1，运行器严格读取实际映射，不接管已有服务。证书、私钥和随机口令配置均存放私有临时目录，有效CA有效期2天，过期叶证书单独使用固定历史日期。结束删除本轮容器及本地临时文件；强杀中断仍需核对遗留资源，不能直接用于业务环境。

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
4. `strictTlsRejectsTrustedCertificateWithWrongHostname`：独立端点使用SAN仅wrong.invalid的有效测试证书，通过GAUSSDB_HISTORY_TLS_WRONG_HOST_CA信任它。verify-ca前后查询1/2成功，verify-full必须报08类且明确hostname错误。当前运行器使用不同端点，能够与正确SAN正向测试同轮执行；旧的单端点手动方法才需要分批。
5. `strictTlsRejectsExpiredLeafWithoutDowngrade`：GAUSSDB_HISTORY_TLS_EXPIRED_CONNECTION和GAUSSDB_HISTORY_TLS_EXPIRED_CA指向专用端点及有效签发CA。verify-ca/verify-full必须报08类且异常链包含CertificateExpiredException或CertPathValidatorException的EXPIRED原因；前后通过非验证TLS查询证明端点可达。这一非验证设置仅是隔离测试对照，不能作为客户推荐配置。缺少独立配置时明确跳过，真库通过结果待登记。

## 已验证与待验证

过期叶证书新增轮未完成：多端点及`--expiry-only`均在Docker运行时映射检查超时后失败，未进入JUnit；各轮拥有容器已清理。不得将服务器启动、脚本自测或端口失败当作TLS握手验收。当前Java场景待可达端点实跑，既有三项TLS历史通过不变。

GB18030重复验收完成：run-vR3HNp与run-MsX8c4均2724项、2713通过、11跳过、零失败/错误，重复性校验逐项一致，临时容器/实例/角色/数据库清理。运行器支持`--encoding`，148项辅助脚本自测通过；上述待补边界仍保留。

2026-09-30：`--encoding`首轮run-vR3HNp通过，2724项中2713通过、11跳过、零失败/错误；GB18030数据库保持UTF8 JDBC的中文/扩展汉字/特殊字符/NULL往返通过。临时容器状态为running=true、OOM=false、exit=0后由运行器删除，其他夹具也清理。第二轮已启动。这不等于切换客户端编码后的扩展协议问题已经解决，也不等于编码配置UI验收通过。

脚本清理已补强：逐项删除本轮登记文件，单项失败继续清理并聚合异常；主故障保留。裸口令按实际值脱敏，容器口令文件显式0600。强杀/宿主机故障不会执行finally，需根据日志中的精确容器ID、标签和运行状态人工核查；禁止按标签批量删除可能仍在运行的验收任务。外层运行器暂无跨子进程的总超时回收保证，不能声称任意中断均可自动恢复。

重复验证run-JTZMwP完成：2724项中2712通过、12跳过、零失败/错误，与run-PQPfG3经过测试身份、结果及报告时间校验逐项一致；TLS容器、临时原生工具实例及专用角色/数据库均清理。中间端口查询失败尝试不计成功轮次。GB18030扩展已开始实跑，待结果。

独立入口重复运行时曾在`docker port`查询阶段失败（未进入JUnit），容器已清理，未算一次通过。入口现直接检查运行时NetworkSettings.Ports，必须恰有一个127.0.0.1及预期端口的映射，缺失/错误/非本机映射均拒绝；生命周期及映射自测共6项通过，重复真库回归仍在执行。

可选`--encoding`正在补充验证：只在新建的正确证书实例内创建`tls_encoding`（GB18030），使用`GAUSSDB_HISTORY_ENCODING_CONNECTION`指定独立连接文件。未指定该变量时仍兼容旧历史连接入口；这项扩展未完成实跑前不算编码验收通过。

2026-09-23，GaussDB507分布式CN、厂商JDBC、上述1/2通过；第3在此前SSL-off批次通过。TLS-on批次第3跳过，两种互斥环境分开报告。

主机名不匹配已在独立证书批次验证（run-7KYLa5）。证书过期、双向客户端证书认证、DBeaver证书配置UI、其他目标版本尚未完成。配置映射单测也不能代替这些握手/UI场景。
