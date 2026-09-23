# 场景清单与层级

日期偏移新增6项：X/XX/XXX/Z自动与显式解析保留偏移和微秒、引用Z保持本地时间、xxx旧格式限制负向断言。修复contains-Z类型推断为parseBest后run-aIRTsG 1407项/1383通过/24跳过/零失败错误。grantee删除；DATE_OFFSET_PARSING_20260924.md记录首次3失败1错误与正向矩阵调整。xxx依旧不支持，不能算功能通过。

小数秒补4项：fff/ffffff/fffffffff各测0/1ms/123456789ns的现代与JDBC日期显示及显式/自动解析，另测引用fff字面量。run-i2YJVL四失败；修复f转S保留位宽/引用后run-x8mLQ4 1401项/1377通过/24跳过/零失败错误。grantee删除；主仓DATE_FRACTION_PRECISION_20260924.md；GUI及可选小数格式另验。

日期输入新增10项：六种非法日期/时间/尾随文本覆盖显式与自动类型、两种年份格式合法闰日偏移、仅日期/时间旧格式往返。run-nJcWDC复现5失败；STRICT+默认ERA及回退完整校验修复后run-O64tLN 1397项/1373通过/24跳过/零失败错误。grantee删除；主仓DATE_INPUT_VALIDATION_20260924.md。GUI错误提示尚未验。

日期格式器补6项：四种Java/JDBC日期值法英月份显示、法语文本往返、NULL。run-LLTM6J复现4失败1解析错误，修复DateTimeFormatter未传Locale后run-5ENTGA 1387项/1363通过/24跳过/零失败错误，grantee删除。主仓DATE_FORMAT_LOCALE_20260924.md；是生产格式器回归，不是GUI菜单翻译验证。

日期时间补2项真库：集中式/分布式分别验证纽约春季跳时、秋季重复01:30对应不同Instant，三会话时区下JDBC微秒往返一致及NULL/wasNull。run-qAhbau 1381项/1357通过/24跳过/零失败错误；隔离schema自动清理，grantee删除。主仓JDBC_DAYLIGHT_SAVING_20260924.md及脱敏报告；不代替GUI日期展示。

编码预编译补6项真库：集中式/分布式各extended+threshold0/1/5，同语句8次INSERT及参数SELECT，中文/𠀀/特殊字符/NULL逐值/wasNull及独立连接8行验证，UTF8会话保持；run-CAtm7A1379项/1355通过/24跳过/零失败错误，grantee删除。当前驱动javap显示扩展参数硬编码Utils.encodeUTF8而会话流可改编码，记录GB18030扩展协议限制，不算修复。主仓JDBC_ENCODING_BOUNDARY_20260924.md及脱敏报告。

麒麟GUI672–683补ONLY多语句：UPDATE确认、DELETE取消，独立查2行original，验证预执行确认未提前写入；再运行首框全部为是，UI Queries=2/Updated Rows=4，独立0行，覆盖ONLY正向执行。两截图已检视保存。schema精确清理目录0，未选不再询问，编辑器恢复SELECT；手动事务/混合DROP另验。主仓SQL_SAFETY_GUI_20260924.md。

GUI657–671同步model.sql1858（SHA a4319ab1…b5cd，宿主/容器一致），正常退出后重启。UPDATE ONLY和DELETE FROM ONLY都出现真实确认，分别取消后独立查2行原值/2行，专用schema清理0，截图已存。通用“多行数据/SQL”提示无精确表名为展示限制；未测ONLY确定执行，其他最新插件未同步，不算全新包验收。主仓SQL_SAFETY_GUI_20260924.md。

麒麟GUI639–656补DELETE/DROP：隔离表2行，无WHERE DELETE中文确认取消后2行、重试确认后0行；DROP取消目录仍1表、重试确认后0表。两张截图核验保存，未选不再询问；schema清理目录0、编辑器恢复SELECT。主仓SQL_SAFETY_GUI_20260924.md追加证据，JUnit未增；多语句/手动事务/ONLY新包另验。

麒麟GUI629–638补SQL安全确认：普通账号对隔离表无WHERE UPDATE→中文确认→取消，独立gsql2行原值；重试→确认，2行变更。截图已保存；schema/table删除且目录计数0，编辑器恢复SELECT文本。当前model.sql仍09220932，不代表ONLY修复GUI；JUnit数量未加。其他9条TPDSS质量规则仍待能力核实，不能以解析/执行通过替代告警。

对象过滤匹配补8项：精确包含/排除大小写各2、包含/排除缓存双向切换各1、列表替换1、副本隔离1。run-iKMA0d复现4项失败；修复敏感精确字面量及切换缓存后run-fbwx8P1373项/1349通过/24跳过/零失败错误。grantee删除，主仓OBJECT_FILTER_MATCHING_20260924.md及脱敏结果。导航按方言设敏感性，不宣称独立UI开关或树端到端已验。

兼容凭据存储补5项：替换移除主密码/token、清空单节点保留其他范围、清空末节点与重复清理、profile键、secret-storage模式跳过。run-CtYjF0复现4项旧内容残留；生产saveSecuredCredentials新map替换后run-QICTYu1365项/1341通过/24跳过/零失败错误。grantee删除，主仓CREDENTIAL_REPLACEMENT_20260924.md及脱敏报告。实际文件加密覆盖、GUI及保留字段冲突未覆盖。

认证profile安全存储接口补7项：保存开关往返2、开到关替换旧记录、set/flush/get故障、缺失记录。run-l3QNro复现false仍保存主密码及旧密码未移除；persistSecrets按savePassword加入主密码后run-cKhsKy1360项/1336通过/24跳过/零失败错误。虚构凭据+内存控制器，不是真实钥匙串/文件加密；grantee删除。主仓AUTH_PROFILE_STORAGE_20260924.md及脱敏结果，GUI未同步。

凭据模型/序列化补11项：三类来源保存选项6、属性隔离/只读2、自身集合及视图2、空值1。run-0aLfX9复现4项属性问题；run-tBLu1k复现profile不保存仍输出密码；复制Map及按选项保留主密码后run-wG7ema1353项/1329通过/24跳过/零失败错误。grantee删除，全部虚构凭据；主仓CREDENTIAL_SNAPSHOT_20260924.md与脱敏结果。persistSecrets/既有存储清理/GUI/加密另验。

连接过滤配置补9项：中文/换行/引号及大小写敏感往返2、空用户配置、旧格式、多个对象范围隔离、无效JSON3、父配置省略空字段。run-aMCmNT复现大小写标志丢失与空JSON关闭失败；修复读写case-sensitive、独立空数组及UTF-8解码。run-dckZMU1342项/1318通过/24跳过/零失败错误，grantee删除。主仓CONNECTION_FILTER_CONFIG_20260924.md及脱敏报告；非完整配置向导、凭据安全或GUI验收。

SQL历史过滤补3项：无类型/文本时独立过滤器、组合条件仅调用一次、tr-TR区域下INSERT匹配insert。run-JCpXDW三项复现失败，修复共享DefaultEventBrowser过滤执行及区域相关转换。run-V9xGeT1333项/1309通过/24跳过/零失败错误，临时grantee删除。本类8项全通过；GUI尚未部署本轮模型。主仓SQL_HISTORY_FILTER_20260924.md与脱敏报告；默认内存历史不等于跨重启持久化。

SQL历史日志补3项：过期命名目录/符号链接不删除、flush失败停止后续写、close失败不重复关闭。run-M8RJGQ复现空目录误删，增加NOFOLLOW_LINKS普通文件过滤。run-r3O4Jp1330项/1306通过/24跳过/零失败错误，临时grantee删除。主仓SQL_HISTORY_CLEANUP_20260924.md及脱敏报告；仅JUnit临时目录，未碰用户日志；非历史GUI/重启/Windows链接权限验收。

XLSX列分组补6项：单列1/重复值/NULL、-1/0/越界、两列首末分组及组内顺序。run-SJsBa6首列不能选择；改1基编号/0禁用，中英文说明同步。run-smJkv21327项/1303通过/24跳过/零失败错误，本类60+真库2，grantee删除。旧非零任务配置需复核，GUI仍1817未含分组修复；主仓XLSX_EXPORT_20260924.md与grouping脱敏报告。

麒麟GUI619–628空结果补验：SELECT两列WHERE false，界面无数据；实际XLSX向导默认表头导出到独立新文件，XML严格1行2列表头id/label、0数据行，通过。主仓XLSX_EXPORT_20260924.md含截图/哈希。无数据库写入，JUnit计数不变；无表头/追加/取消/失败GUI仍待验。

Linux GUI603–618：隔离客户端原无Office扩展，正常退出备份后加入Office1817与POI/压缩/lang依赖。普通分布式账号SELECT高精度数值/Long.MIN/中文𠀀/NULL→实际XLSX向导SINGLE_QUERY新连接→输出，ZIP/XML独立断言2行4列/值类型全通过。主仓XLSX_EXPORT_20260924.md与截图；JUnit计数不变。扩展汉字界面缺字但文件正确，非客户实机/发布包/全部GUI场景验收；609定位错误610纠正。无数据库写入。

XLSX空结果/SQL文本补4项：空结果有无表头、独立SQL Sheet整段/按行。run-l9DfHU空结果两项失败（合成全NULL数据行）；footer改只初始化sheet/表头，真实NULL行测试保留。run-jxjvAh1321项/1297通过/24跳过/零失败错误，本类54项另真库2项；grantee删除。主仓XLSX_EXPORT_20260924.md与empty脱敏报告，GUI/超长SQL仍待验。

XLSX接真实JDBC补2项：集中式/分布式507隔离表写numeric38,18/Long.MIN/中文𠀀引号换行/NULL，getObject先对比输入，原样交生产导出器，XLSX逐格类型/值/表头/行列数验证。run-ECvtcg1317项/1293通过/24跳过/零失败错误，无生产修改；两库xlsx_values残留0/grantee删除。主仓XLSX_EXPORT_20260924.md及jdbc脱敏报告；绑定和site仍模拟，不代表GUI向导或办公软件验收。

XLSX输出失败清理补2项：0/512字节后IOException，要求异常传播、workbook/sheet引用清空、再次dispose不重写。run-cPnfVE两项复现write异常跳过关闭/清理；改try-with-resources与finally。run-hcvL7P1315项/1291通过/24跳过/零失败错误，本类50项，grantee删除。主仓XLSX_EXPORT_20260924.md与output-failure脱敏报告；未模拟真实磁盘满/句柄统计/GUI，不自动删除调用方输出路径。

XLSX内容/资源补5项：真实Reader多块中文读取文件往返、二进制占位不打开流、缺失storage标签、读取/打开异常保留且释放。run-hTYMBb修正spy StringReader锁为空的测试装配问题，无生产修改。run-QfJhtG1313项/1289通过/24跳过/零失败错误，本类48项，grantee删除。主仓XLSX_EXPORT_20260924.md及content脱敏结果；二进制不是原文保存，真实JDBC LOB/磁盘失败/GUI另验。

XLSX默认日期格式补4项：空串/空格/默认/null配置。run-T01Wi2前三项复现历史日期整格空白和默认值与界面不一致；共享导出器默认改MM/dd/yy且空白回退。run-Etbjwr1308项/1284通过/24跳过/零失败错误，本类43项，grantee删除。主仓XLSX_EXPORT_20260924.md与date-default脱敏报告；默认格式不包含时间/完整年份，完整历史时间需显式格式，不扩大为GUI或全部时间格式验收。

XLSX日期/类型NULL/行号再补8项：1900边界/闰日/毫秒日期数值格格式及本地时间相等、1899日期文本回退、数值布尔NULL空文本、有无表头行号偏移不覆盖。run-RKbqWt1304项/1280通过/24跳过/零失败错误，本类39项，无生产修改，grantee删除。主仓XLSX_EXPORT_20260924.md与date脱敏报告。时区/DST/亚毫秒/默认空日期格式/JDBC取数/GUI未覆盖。

XLSX稀疏/多Sheet/空Sheet追加4项：第0和5/100行文件追加后保留空隙且新行位于6/101；两个已有Sheet限额3分别追加；空Sheet从第0行表头开始。run-dDuEPC两项稀疏追加异常，修复物理行数误作位置，改为原Sheet末行+1。run-jwlnvs1296项/1272通过/24跳过/零失败错误，本类31项。主仓XLSX_EXPORT_20260924.md与sparse脱敏报告，grantee删除。公式/最大行数/GUI仍待验。

XLSX追加文件再补2项：实际importData后分别复用单Sheet/新建Sheet，旧两行保留、新两行位置与表头准确，输入文件字节不变。run-FlET8c复用策略footer越界；修复sheetIndex计数误用并处理全部复用sheet。run-f0FJvz1292项/1268通过/24跳过/零失败错误；本类27项。主仓XLSX_EXPORT_20260924.md与append脱敏结果；grantee删除。稀疏行/公式/多sheet、同路径覆盖和GUI仍待验。

XLSX生产导出器补25项文件往返：中文/公式形状文本/NULL/布尔、普通和高精度数值、表头开关、拆Sheet行数、trim和长文本限制。run-djsmdS修正测试编译；run-VoOFmZ复现7项数值丢精度/溢出。共享导出器对无法安全表示的BigDecimal/BigInteger/Long改为原值文本，普通数值保持数值。run-2cP8aw1290项/1266通过/24跳过/零失败错误，grantee删除。主仓XLSX_EXPORT_20260924.md与脱敏报告；不是GUI/真库取数或Excel软件验收，追加工作簿等另验。

原生恢复追加失败重试阶段：除零后DELETE不执行，count3/sum6保留，错误无密码；后续正常INSERT进程成功count4/sum10。run-eCRNx8错误文案大小写断言失败，直接gsql确认Division by zero/退出3后修正。run-XDMUEZ1265/1242通过/23跳过/零失败错误，已有test内部扩展不加计数。主仓NATIVE_RECHECK_20260924.md及错误脱敏报告，schema/grantee清理，无生产修改。

原生工具复验run-cc4Ush：普通隔离账号实际gs_dump→gsql plain恢复（4MB级输出）及custom→gs_restore，生产输出重定向/密码管道、无PGPASSWORD、恢复count3/sum6通过。全1265/1242通过/23跳过/零失败错误，本轮未启用上轮六项review，不能混合计数。schema/grantee清理。主仓NATIVE_RECHECK_20260924.md与脱敏报告，GUI/Windows/dumpall空集群另验。

review权限复验：一次性独立sysadmin+专用库/账号/网关窄HBA入口，普通账号不变。run-qwuWKN因HBA所有权未加载而6项连接失败；修正后run-3oeAQZ1265/1247通过/18跳过/零失败错误，断点并发/标记删除与其余5项真库全通过。账号/凭据/grantee删除、schema无残留、HBA恢复hash一致、普通账号systemadmin=false。主仓SKIPPED_REVIEW_AUDIT_20260924.md和复验报告。18跳过继续不算通过。

跳过审计补跑review6项：入口兼容当前隔离central库命名+显式DDL允许，原规则保留。run-mNPloL1265/1246通过/18跳过/1错误，**不是全绿**。包编译诊断2项、重载与COMMIT故障3项新增真库通过；断点测试turn_on需system admin被普通账号拒绝，待独立调试账号，不提升普通账号。五schema无残留、grantee清理。主仓SKIPPED_REVIEW_AUDIT_20260924.md及脱敏结果。

转义脚本提取→执行：集中式/分布式507各7类非空E字符串脚本，每个实际解析3条、原样JDBC执行、精确核对0/目标字符串/2和每条单行。run-1NeeUG1265/1241通过/24跳过/零失败错误。主仓PREDICATE_SCANNER_20260924.md和真库脱敏报告；无生产修改，schema/grantee清理，不替代GUI高亮事件验收。

实际SQLScriptParser提取补8类E/e字面量，每类EOF/后接语句/前置语句三种位置，整句列表原文与顺序断言。含分号、单双引号转义、注释样式、真实/转义换行中文。run-F0JQsw1263/1239通过/24跳过/零失败错误。主仓PREDICATE_SCANNER_20260924.md与脚本提取脱敏报告；无生产修改、grantee清理，非服务端执行或GUI验收。

转义规则非零offset12项：5类SQL前缀成功且保留分号，7类标识符后缀/未闭合失败后恢复起点，两种真实扫描器均断言。run-P5TdrH1255/1231通过/24跳过/零失败错误。主仓PREDICATE_SCANNER_20260924.md及非零offset脱敏报告，无生产修改、grantee清理。非完整SQL脚本拆分或GUI验收。

转义字符串失败回退9项：空输入、E/e、未闭合/尾部反斜杠/双引号及非匹配输入，两种扫描器偏移与首字符恢复。run-2JGlEB7项偏移-1失败；改为记录起始offset按实际推进回退。run-KB7Qy41243/1219通过/24跳过/零失败错误。主仓PREDICATE_SCANNER_20260924.md和回退脱敏报告，grantee清理。非零起始位置与完整GUI另验。

转义字符串EOF追加8项：5合法末尾字符串、3分隔符保留。run-X1oQz7五项EOF失败，修复共享PostgreEscapeStringRule闭合引号后EOF被拒；同时校验片段与文档扫描器正确结束偏移。run-rz3aa81234/1210通过/24跳过/零失败错误，主仓PREDICATE_SCANNER_20260924.md和EOF脱敏结果。grantee清理；未闭合失败回退和实际GUI仍待验。

谓词扫描器补5项：CR/LF/CRLF列位置与回退、实际转义字符串规则、标识符后缀防误识别。run-RvrQvn3项复现getColumn未实现异常，另2项测试bundle加载修正；实现共享扫描器列偏移。run-ia05QF1226/1202通过/24跳过/零失败错误，对应异常栈435→0。主仓PREDICATE_SCANNER_20260924.md与脱敏报告，grantee清理；不算完整字符串语法/GUI高亮验收。

数值科学计数/配置刷新4项：1E-38、1E+38、高精度负小数、38位整数，真实handler普通→科学→普通三阶段生成INSERT整句断言。run-RQOp2W1221/1197通过/24跳过/零失败错误；主仓DML_GENERATOR_OPTIONS_20260924.md与脱敏报告。无生产修改，grantee清理；不是GUI首选项事件或真库存储范围验收。9.4台账同步近期DML证据。

INSERT数值/布尔新增10项：真实JDBC处理器，Long边界、38位整数/小数、极小小数、负数末尾零、数值NULL、布尔真/假/NULL完整SQL断言。run-TIGt381217/1193通过/24跳过/零失败错误。主仓DML_GENERATOR_OPTIONS_20260924.md及类型脱敏报告；无生产修改，grantee清理，不算真库类型范围及网格格式验收。

DML选项补6项：INSERT/UPDATE/DELETE完整限定名与多行格式三项；缺失绑定时数字/字符串/时间表达式默认值三项各断言INSERT和UPDATE，避免再次加引号。run-Dg3jMg1207/1183通过/24跳过/零失败错误。主仓DML_GENERATOR_OPTIONS_20260924.md及脱敏报告，grantee清理，无生产修改。限定名由模拟实体提供，不算真实schema名称生成/GUI/默认值元数据验收。

UPDATE生成真库：集中式/分布式507各依次写SQL NULL、字面NULL、引号、中文换行、SQL形状文本；每轮实际生成SQL影响1行，更新/回滚/重试提交后均逐行核对全部7行，其他6行不变，参考表7行。随机schema与grantee清理。run-DXB77F1201/1177通过/24跳过/零失败错误；主仓UPDATE_GENERATOR_20260924.md及脱敏报告，无生产修改，不算GUI菜单验收。

DELETE追加6项空键集合不可变性/多行顺序/隐藏伪列/空选择，run-0liDaJ1192/1168通过/24跳过。UPDATE追加7项键值分离、引号、NULL值与NULL键、多行、空选择及隐藏伪列过滤。最终run-CSH3cv1199/1175通过/24跳过/零失败错误；主仓DELETE_GENERATOR_20260924.md、UPDATE_GENERATOR_20260924.md及脱敏报告。本批无生产修改，grantee清理；不算UPDATE真库或GUI验收。

DELETE无键真库执行：集中式/分布式507各验证单引号、NULL、SQL形状文本，真实生成SQL不改写执行；每轮删除/回滚恢复/重试提交，重复行影响2行，其余各1行，剩余id严格为1/2/4/5，独立参考表7行不变。随机schema与grantee清理。run-z6y8CN1186/1162通过/24跳过/零失败错误。主仓DELETE_GENERATOR_20260924.md与脱敏报告；非GUI验收。

DELETE生成补3项（无键、单键、复合NULL键）。run-gBLYKJ复现无键追加不可修改列表异常，另两项测试未initGenerator的装配问题修正；生产无键分支使用局部ArrayList。run-3k7fre1184/1160通过/24跳过/零失败错误。主仓DELETE_GENERATOR_20260924.md及脱敏结果，grantee清理。共享修复，真库删除及GUI待验；无键可见列条件不保证唯一删除。

INSERT属性过滤再补3项：隐藏/伪列同步排除列和值且不读其单元格；缺少匹配绑定的字符串列生成默认空串而不误读。run-5i1HB3全1181/1157通过/24跳过/零失败错误，本类16项；主仓INSERT_GENERATOR_20260924.md与脱敏报告。grantee已清理，无生产修改；实体默认表达式、全部列排除及其他类型仍待验。

INSERT生成真库往返：集中式/分布式507各七类输入，实际生成SQL直接执行、读回并与独立PreparedStatement参考表比较。非空串还严格比较原值；空串不假定兼容模式语义。随机schema清理。run-5SrGpQ1178/1154通过/24跳过/零失败错误，主仓INSERT_GENERATOR_20260924.md及脱敏报告，提交3bbd55a9eb。不是生成菜单GUI验收。

INSERT生成新增6项选项测试：空选择、多行选择顺序、包含/排除自增列同步列和值、仅可见列、非紧凑分行。run-AIwX5G1176/1152通过/24跳过/零失败错误，本类13项。主仓INSERT_GENERATOR_20260924.md；非真库往返/GUI，全部列排除等仍待验，无生产修改，grantee清理。

9.4结果集INSERT生成新增7组：真实生成器/方言/字符串处理器/限定列名，整句断言NULL与字面NULL、空值、引号、中文、换行、SQL文本、前导零、可见列重排。两轮测试接入问题修正后run-8VzP1S1170/1146通过/24跳过/零失败错误。主仓INSERT_GENERATOR_20260924.md；非SQL真库执行/GUI验收，grantee清理，无生产修改。

Linux GUI591–602数据编辑器1635实际安装校验后，普通账号CHECK保存错误弹窗标题“数据错误”、摘要“将数据保存到数据库时出错”，原始23514/约束名保留；独立两行未变。关闭放弃/SELECT1/表清理完成，截图见主仓RESULTSET_EDITABILITY_20260924.md。生成脚本错误UI仍未执行，JUnit计数不变；非客户新发布包。

结果集保存/脚本错误三处硬编码英文改为NLS中英资源，新增3项实际bundle资源与NLS字段解析测试。run-5xSIx5全1163/1139通过/24跳过/零失败错误。GUI尚未安装此数据编辑器新bundle，未计中文弹窗验收；主仓RESULTSET_EDITABILITY_20260924.md。grantee清理，9.8台账补入已执行GUI场景并保留剩余项。

Linux GUI571–590复制行插入重复主键，真实23505、独立原两行不变；修正待插入id3重试成功，独立三行且UI插入1。删除id3未保存数据库仍三行，放弃界面恢复；重新删除保存独立仅原两行、UI删除1。fixture清理、SELECT1恢复；主仓RESULTSET_EDITABILITY_20260924.md含截图。不是手动事务/NULL/空白新增行全覆盖，JUnit数不变。

Linux GUI553–570结果编辑异常恢复：amount=-1保存23514，独立数据10/20不变；放弃恢复10。id改2实际42P10分布键不可改，不算重复键通过。放弃后amount22成功，独立1|22、2|20，UI更新1行保存禁用。仅自动提交失败恢复，不计手动事务回滚。fixture清理，JUnit数不变；主仓RESULTSET_EDITABILITY_20260924.md含截图。错误摘要英文列为后续本地化项。

Linux GUI539–552模型1613：实际查询混合*、计算amount、别名total；计算列内嵌/查看器editable=false且明确无表列提示，total正向editable=true。输入31保存后UI更新1行，独立gsql原表1|31、2|20，计算值32；保存禁用。专用表已删除、脚本恢复SELECT1。主仓RESULTSET_EDITABILITY_20260924.md含截图/版本hash，JUnit数量不变；不是客户桌面云或全部写回场景验收。

通配尾部别名及多通配前后明确列新增8项。run-K8w75a4项按total错查实体列；去掉旧的仅通配前还原限制，使用已映射投影，run-CeOSu4全部1160/1136通过/24跳过/零失败错误，本类37项。主仓RESULTSET_EDITABILITY_20260924.md记录证据，GUI写回/多通配中间歧义仍待补；覆盖计划9.8更新为部分。临时grantee清理。

通配/表达式绑定新增8项，旧run-NpsCr5首批4项中2项错误发起同名表列查找；修复结果序号与通配展开的映射，完整run-7nHq9P1152/1128通过/24跳过/零失败错误，本类29项通过。普通列及通配正向保留；多个通配中间歧义、GUI及真实写回仍待覆盖。详见主仓RESULTSET_EDITABILITY_20260924.md。临时grantee已删除。

属性绑定链路新增8项：常量/表达式/CASE/CTE/派生UNION等无驱动物理来源的查询，生产bindAttributes不生成实体列或行标识、后续编辑门控只读。真实解析及绑定状态、会话元数据模拟；不是GUI或真实写回。run-b8woAn编译错误修正后run-rvX52y1144/1120通过/24跳过/零失败错误。主仓RESULTSET_EDITABILITY_20260924.md，本类21项全通过，grantee清理。

结果集编辑门控新增13项生产方法测试：元数据/驱动只读、行标识/有效键、修改能力、断开/权限/数据源只读及正向路径。初次run-4mvzpe测试mock类型编译失败已修；最终run-jHa7BJ1136项/1112通过/24跳过/零失败错误。对应9.8/9.9，GUI属性绑定和真实写回未因此标完成。详见主仓RESULTSET_EDITABILITY_20260924.md，临时grantee已清理。

JOIN混合来源18项补充通过：五种JOIN×三种实体/CTE/派生方向15项，递归/串联/嵌套CTE3项。同时断言实体来源正确、虚拟来源不伪造。run-Mnh4Ag1123/1099通过/24跳过/零失败错误；本类60项。无生产修改，不算18条真库或GUI写回全部通过。

CTE大小写8项：真实GaussDBDialect折叠未引用名、保留引用名，区分引用大写和未引用小写，schema限定实体不受CTE遮蔽。红run-x2VJmW4失败→绿run-fqH5Pu1105/1081通过/24跳过/零失败错误。两种507拓扑执行临时表脚本case1–7均1/1/1/1/2/3/1，回滚结束。GUI结果集编辑及更复杂作用域仍待验。

虚拟来源补充9项：5个CTE/派生查询旧代码返回虚拟表名失败，修复后返回未知基础来源，4个外层实体来源正向仍通过。run-ah8V9l1097总数/1073通过/24跳过/零失败错误。大小写折叠、引号组合、复杂作用域及GUI可编辑性仍待扩展，不能据此宣称整个CTE结果只读。主仓PROJECTION_METADATA_20260923.md记录红绿证据。

投影/别名元数据新增25项：12表达式别名、5种JOIN来源表、中文引用名、2实际通配列、5非通配星号。旧代码4项误判，修复为AST类型识别后run-YXma8k1088/1064通过/24跳过/零失败错误。主仓PROJECTION_METADATA_20260923.md记录范围；GUI模型尚未更新，不算结果集编辑端到端通过。

多语句确认GUI530–538：首条确定/第二条取消整批无执行，全部为是两条赋值再自增结果32，再执行仍警告且取消不改数据。fixture已清理，不等同数据库事务原子性，也不覆盖持久“不再询问”。详见主仓SQL_SAFETY_COVERAGE_20260923.md。

危险查询提示修复：518–529新版SQL编辑器1537真实验证ONLY更新/删除和普通UPDATE，SQL预览、中文目标/类型完整，三次取消数据不变，fixture清理。完整回归run-ArZXkO1063/1039通过/24跳过/零失败错误。上一条UNKNOWN/missing argument缺陷已修，不覆盖偏好开关、多语句或其他静态规则。

ONLY GUI链路：504–517新版模型实际普通账号操作，UPDATE/DELETE取消不改数据、确认执行符合2行更新/0行剩余，独立连接核实，fixture已清理。但弹窗UNKNOWN/missing argument缺陷新发现待修，不能标完整通过。详见主仓SQL_SAFETY_COVERAGE_20260923.md。JUnit数量未变。

ONLY安全检查修复已转绿：run-rAR5u0，1063总数/1039通过/24跳过/零失败错误，安全检查类51项。词法回退识别外层DML/WHERE，保留原执行文本；ONLY注释/子查询/CTE/引用名及非DML负例补齐。507集中式/分布式临时表真实UPDATE ONLY与DELETE FROM ONLY各影响2行，回滚并确认目录0。初次分布式ON COMMIT DROP准备失败已记录，最终统一脚本复跑通过。GUI确认仍待验证，见主仓SQL_SAFETY_COVERAGE_20260923.md。

SQL安全检查新增33项当前为红：run-y1bSnO，31新增通过，UPDATE ONLY/DELETE FROM ONLY无WHERE两项错误返回非危险。保留失败用例待修，不跳过不改预期；详见主仓SQL_SAFETY_COVERAGE_20260923.md和sql-safety-red.json。此前1012项绿灯不能覆盖本轮新增要求。

SQL折叠GUI补充：隔离Linux客户端已更新1.0.185.202609231515，489–503验证两条SQL正确折叠位置、20次长短替换最终无残留、恢复位置、实际鼠标折叠/展开；当前会话无原越界。截图及详细边界见主仓SQL_FOLDING_REVISION_20260923.md。JUnit计数不变，新安装包及更多并发仍待验。

最新SQL折叠版本一致性：1012项、988通过、24跳过、零失败/错误，results/run-mJkx7Z。实际生产策略新增6项确定性测试：缩短、等长替换、文档对象替换、编辑恢复原文、正常多行折叠、混合越界整批拒绝。前三项先在旧代码失败，再在修复后通过。GUI副本尚未更新该插件，不计GUI通过；详见主仓docs/gaussdb/SQL_FOLDING_REVISION_20260923.md及相应脱敏JSON。

最新序列名称字段补强：1006项，982通过、24跳过、零失败/错误，results/run-ianpRl。补齐属性页直接编辑名称的能力表达式：新建可命名、Gauss已持久化名称只读、支持重命名的PG保持可编辑；真实模型/生产属性描述符三分支验证通过。报告test-results-20260923-sequence-name-field.json。名称及重命名菜单GUI仍待更新副本验证，不能沿用此前最后值字段的GUI结果。

最新序列改名门控：1005项，981通过、24跳过、零失败/错误，results/run-ICN7IJ。Gauss扩展关闭rename能力、PG默认保持开启；管理器canRenameObject、提交命令及生成SQL三层控制；3项新增测试覆盖不入队、不产生动作、支持分支中文/双引号转义。真实服务端RENAME探测仍跳过不算支持。报告test-results-20260923-sequence-rename-gate.json；GUI菜单/属性页及新发布包待实测，详见SEQUENCE_CAPABILITY.md。

最新序列注释/改名批次：1002项，978通过、24跳过、零失败/错误，results/run-UWZjps。生产管理器注释SQL在集中式/分布式验证中文、引号、分号、换行原样保留，清空注释变NULL，号码连续1→2→3通过。两实例生产重命名SQL均被0A000及明确“不支持”拒绝，OID/连续性/冲突正向均未验证，不算通过；客户端重命名能力门控另有待办。报告test-results-20260923-sequence-comments.json，细节见SEQUENCE_CAPABILITY.md。无生产代码修改。

最新GUI序列门控：更新Linux测试副本PG/Gauss插件后，通过普通用户SQL创建序列并实际打开属性页；测试驱动只读诊断确认最后值editable=false、其他字段editable=true，描述编辑能使保存启用，撤销后恢复且数据库无修改。专用序列已删除。详细431–457操作及无效尝试见GUI_PROGRESS.md。本轮增强测试驱动诊断，不更改产品代码；JUnit总数仍998/976通过/22跳过，发布包及其他场景继续验证。

最新序列重启门控修复：998项，976通过、22跳过、零失败/错误，results/run-r7TVsA。Gauss扩展关闭RESTART能力，默认PostgreSQL保持开启；当前值查看保留、编辑/更新表达式受控，命令校验及SQL动作生成双重拒绝不支持的lastValue修改，混合属性不产生部分动作，其他属性正常。5项新增测试通过，报告test-results-20260923-sequence-restart-gate.json。详情和版本边界见SEQUENCE_CAPABILITY.md；GUI副本/发布包尚未更新验证。两条服务端RESTART正向仍为跳过，不算支持。

最新序列管理器批次：993项，971通过、22跳过、零失败/错误，results/run-jQcTUO。新增4项生产修改SQL单测覆盖负步长/零上界/NULL当前值/仅循环修改/空修改；新增集中式和分布式2项生产CREATE/DROP真实执行，中文空格名、取号1/2、目录S、删除后42P01、重建从1起及删除无残留均通过。详见SEQUENCE_CAPABILITY.md；报告test-results-20260923-sequence-manager.json。已确认lastValue属性仍会生成GaussDB507不支持的RESTART，能力门控未修；不能将生成SQL测试当作GaussDB支持该语法。本轮无生产代码变更。

最新集中式正向批次：987项，965通过、22跳过、零失败/错误，results/run-puJlJz。恢复507集中式并使用独立普通账号/专用库，月间隔分区生产DDL往返和自动扩展通过；复合外键生产DDL重建后的JDBC元数据、非法引用23503、更新/删除级联通过。集中式序列RESTART仍被服务端以0A000拒绝，未算通过；默认分布式的相应限制记录保留。明细见CENTRAL_ENVIRONMENT.md；报告test-results-20260923-central-partition-fk.json。随机schema/其他连接残留0，临时grantee删除；专用集中式测试库及窄范围密码认证规则保留供后续测试。并非GUI或全部历史场景已验收。

最新INTERVAL能力批次：985项，963通过、22跳过、零失败/错误，results/run-ZsqBtD。新增月间隔自动分区1→3、生产DDL往返后继续扩展至4的正向用例；当前507分布式在建表时明确拒绝“Interval partitioned table is only supported in single-node mode”，因此正向未执行，不能算通过。run-HN97Ku初次失败，run-NzR66V证明此限制并非通用0A000；仅精确限制消息触发跳过且记录实际SQLSTATE，其他异常仍失败。报告test-results-20260923-interval-capability.json；临时grantee清理，未切换数据库模式。docker清单发现停止的gaussdb-507/gaussdb-507-ha-lab，后续需核对其实际模式和可复用性，不能直接认定无单节点环境。

最新HASH分区真库批次：984项，963通过、21跳过、零失败/错误，results/run-6Jl9K4。生产readTableDDL读取四HASH分区表后删除本轮表/原样重建；21行含负数/零/NULL键分别读取p0..p3，合并排序恰好等于id0..20无重无漏，全表21行，NULL键仅id0，pg_partition四名称一致。不绑定服务器哈希算法的具体桶分配。报告test-results-20260923-hash-partitions.json；随机schema和临时grantee清理。未验证HASH分区扩展/合并、UI或跨版本哈希稳定性，无产品代码修改。

最新LIST分区真库批次：983项，962通过、21跳过、零失败/错误，results/run-47F3F0。507 ORA分布式建立中文LIST键分区，生产readTableDDL取DDL、删除本轮表、原样重建；华北/华南进入p_cn，海外进入p_other；新增西部p_west后写入定位正确；删除p_other只去掉海外行，目录只剩p_cn/p_west。报告test-results-20260923-list-partitions.json；随机schema与临时grantee清理。不是分区管理UI、默认分区/NULL键或全量分区类型验收，无产品代码修改。

最新分区DDL往返批次：982项，961通过、21跳过、零失败/错误，results/run-ZWJQVT。生产PostgreServerGaussDB.readTableDDL通过受控JDBC包装连接真实507读取pg_get_tabledef；限定随机schema的RANGE表删除后原样DDL重建。验证三个分区名、-1归负分区、0/99归中间分区、100/int最大值归MAXVALUE分区，以及pg_partition名称。报告test-results-20260923-partition-ddl.json；随机schema和临时grantee清理。不是UI导出向导、全部分区类型或回退DDL生成路径验收；无产品代码修改。

最新范围分区真库批次：981项，960通过、21跳过、零失败/错误，results/run-hIcoeP。新增HASH分布+RANGE分区真实DDL，id1/9进入p_low，10/19进入p_mid；ADD p_high后20/29进入新分区；pg_partition列出三分区；DROP p_mid后目录仅剩low/high，全表只保留1/9/20/29及对应文本。只操作随机schema且自动清理。报告test-results-20260923-range-partitions.json，临时grantee删除；未验证LIST/HASH/INTERVAL分区变更、移动表空间、分区编辑器或生产DDL导出往返，无产品代码修改。

最新不存在库连接批次：980项，959通过、21跳过、零失败/错误，results/run-kbErOR。新增随机不存在数据库连接场景，pg_database先确认不存在；初次run-an8Tb4期望3D000而得到28000。复查新增严格HBA消息断言确认访问规则先拒绝，失败后原连接SELECT11、新正常连接SELECT12均成功；3D000路径按明确HBA前置拒绝跳过，**未计为通过**。无扩大HBA/认证权限，无错误密码重试。报告test-results-20260923-missing-database.json；临时grantee删除。需允许该目标库进入认证/数据库查找流程的隔离环境才可完成3D000验收。

最新枚举/范围真库批次：979项，959通过、20跳过、零失败/错误，results/run-FepgQZ。507 ORA分布式真实建类型/表，枚举按声明顺序返回中文标签，NULL读取wasNull正确，非法枚举22P02且行数保持4。int4range验证[1,5)上下界/包含标记/1包含5不包含，empty非SQL NULL，NULL getObject/wasNull，缺省下界lower_inf，JDBC类型名int4range。报告test-results-20260923-enum-range.json；随机schema自动清理，临时grantee删除。无产品代码修改；不等同范围编辑器、枚举DDL管理器、任意用户定义range或多模式GUI通过。

最新复合/数组真库批次：977项，957通过、20跳过、零失败/错误，results/run-GKXrge。text[]经createArrayOf/setArray真实入表，getArray保留中文逗号、双引号、反斜杠、换行、字面NULL和null元素；空数组非null且长度0、SQL NULL数组getArray=null/wasNull=true。复合类型真实建表/参数写入，JDBC完整限定类型名、getObject非null、命名字段中文引号及numeric四位小数、NULL复合及字段读取通过。首轮run-jOCUmA短类型名预期错误，实际为带引号schema限定名；据实改成严格完整名断言，非生产缺陷。报告test-results-20260923-composite-array.json；随机schema与临时grantee已清理。未覆盖DBeaver复杂值编辑器、任意嵌套复合/多维数组或所有模式，无产品代码修改。

最新日期时区真库批次：975项，955通过、20跳过、零失败/错误，results/run-evsucb。507 ORA分布式/厂商JDBC新增三项：2024-02-28加一天到闰日保留123456微秒、2023年末加1微秒跨年、闰日date_trunc月首；timestamptz真实入表后UTC/Asia-Shanghai格式化分别15:30/23:30，epoch数值完全一致；to_char/date_trunc/extract对SQL NULL经JDBC读取null且wasNull=true。随机schema清理/连接关闭，无全局时区修改，无产品代码修改。报告test-results-20260923-date-timezone.json，临时grantee删除。不等同客户端本地日期格式、Java时区转换、DST全部边界或结果编辑器验收。

最新事件通知批次：972项，952通过、20跳过、零失败/错误，results/run-uL72tn。QueryHistoryCollectorTest新增失败监听器隔离及移除监听器两项：首个监听器抛异常不影响下个接收和历史入库（此处为内存列表，不是持久化数据库），空周期不重复发送；移除监听器后新事件继续保留但不通知已移除者。实际生产dispatcher单周期，非并发压力/网络消息队列测试；无生产代码修改。报告test-results-20260923-history-listeners.json，临时grantee已删除。

最新收集器保留批次：970项，950通过、20跳过、零失败/错误，results/run-9uGRc1。新增两项生产dispatcher单周期测试：超10000条保留最新记录、连续追加顺序/防御快照；关闭连接缓存清理同时保留重开对象。run-230CQa红测证实待关闭列表直接赋值再清空导致无清理，修复列表快照和关闭判断。报告test-results-20260923-history-retention.json；临时grantee删除，GUI仍1322模型包，不含本次清理修复。无长期并发/内存压测结论。

最新回滚时间戳批次：968项，948通过、20跳过、零失败/错误，results/run-hHlYz3。生产collector回滚事件红测run-dBCwoc确认timestamp=0，改为回滚对象结束时间后通过；不是改测试预期来绕过异常。测试隔离异步dispatcher，仍执行生产handler/private事件创建、检查eventPool及QMUtils事件时间。报告test-results-20260923-rollback-timestamp.json；临时grantee已删除，新model补丁尚未GUI安装复验。

最新事务历史模型批次：967项，947通过、20跳过、零失败/错误，results/run-SnfyTy。QueryHistoryExecutionTest新增回滚与后续自动提交独立性、提交后新事务、关闭连接回滚三个测试。报告test-results-20260923-history-transactions.json；临时grantee删除。另从GUI异常日期追到collector使用连接closeTime=0生成回滚事件，尚待独立修复，模型绿测不覆盖此路径。

最新历史游标批次：**964项，944通过、20跳过、零失败/错误**，`results/run-2eFOs7`。QueryHistoryCursorTest五项调用生产ListCursorImpl及QMRegistryImpl.DefaultEventBrowser：前/后定位、越界不改变当前位置、空游标；USER/META与query类型、中文大小写文本、自定义排除条件组合后按最新优先读取；无匹配结果为空。run-6gjHIV红测确认scroll只验证参数但不更新位置，定位第三条仍读取第一条；生产补this.position赋值。源QMUtils保持原CRLF。通过模拟collector隔离输入，未验证真实事件收集、UI翻页、日期/状态过滤或跨重启存储；默认当前会话浏览器源码并未实现全部criteria字段，仍待能力核实。报告test-results-20260923-history-cursor.json。临时grantee已删除，新修复未装入GUI/发布包。

最新SQL日志重配置批次：**959项，939通过、20跳过、零失败/错误**，`results/run-8maXxy`。QueryHistoryFileTest新增三项：切换日志目录关闭旧Writer并真实落盘中文SQL到新文件；目标是普通文件而非目录时打开失败，旧Writer关闭且后续不再写旧目的地；禁用日志关闭旧Writer并忽略后续事件。首轮run-j5KHi7因测试框架不支持静态mock而未进入断言，改用隔离OSGi测试运行时首选项、finally恢复值及默认状态。run-Qwf9jq红测证明启用状态下initLogFile不关闭旧Writer；修复在重配置开始先关闭/置空，失败时不保留旧目的地。报告test-results-20260923-query-log-reconfigure.json。验证生产初始化与文件IO，不等同客户首选项GUI操作或数据库历史分页验收。临时grantee已删除；GUI/发布包未更新。

最新SQL文件日志批次：**956项，936通过、20跳过、零失败/错误**，`results/run-ojWQ7W`。新增QueryHistoryFileTest四项：生产事件格式化/写入/flush实际临时文件并重新打开追加，中文SQL、SUCCESS与错误消息及两条记录保持；模拟IO异常关闭且第二次事件不再写；保留7天只删除匹配文件名且严格早于边界的日志，保留边界/当日/无关/格式错误文件；dispose幂等关闭且后续不写。run-3GUpxj红测确认dispose未关闭Writer且仍write/flush，生产修复同步关闭、置空并关闭enabled。该测试通过注入Writer/filter隔离全局工作区配置；证明文件日志生产路径，不等同Query Manager数据库历史重启读取、分页、UI清除/收藏或全局首选项初始化。报告test-results-20260923-query-log-files.json；临时grantee已删除，新修复未装入GUI/发布包。

最新网络属性别名批次：**952项，932通过、20跳过、零失败/错误**，`results/run-ETOZBk`。新增普通/安全属性两个测试，各覆盖外部Map复制后修改隔离、自身Map传回、只读视图传回、替换旧键及清空。run-2YYrwA红测确认两类自身Map被clear清空；DBWHandlerConfiguration改为先LinkedHashMap快照再替换。生产解析/网络配置加载会调用这些setter，但未证明当前UI实际传入自身Map，因此只声明API边界缺陷修复及单测，不宣称复现客户UI故障。报告test-results-20260923-network-property-alias.json。当前ssl=off，三项TLS专用环境测试跳过，其此前真库结果分别保留；临时grantee已删除。新模型修复尚未装入GUI/发布包。

最新TLS主机名批次：**950项，930通过、20跳过、零失败/错误**，`results/run-7KYLa5`。strictTlsRejectsTrustedCertificateWithWrongHostname以仅SAN=wrong-host.invalid的有效自签名测试证书运行507 CN；客户端信任此证书，verify-ca连接查询1成功，verify-full因hostname校验返回08类异常，再次verify-ca查询2成功。证明校验证书链与校验主机名有别，不以放宽校验作为修复。当前错误SAN环境未运行正确SAN/无关CA两项，另ssl-off场景跳过，均不算通过。报告test-results-20260923-tls-hostname.json，TLS_VALIDATION.md更新。测试后已恢复ssl=off，CSV目标表仍3行，临时grantee删除。无生产代码修改。

最新错误CA批次：**949项，931通过、18跳过、零失败/错误**，`results/run-DULzqA`。strictTlsRejectsExistingUnrelatedCertificateWithoutDowngrade先以正确证书verify-full连接并SELECT1，再以存在且不同的无关证书连接，断言08类SQLSTATE及异常链SSLHandshakeException，最后恢复正确证书SELECT2成功；排除连接不可达的假拒绝。报告test-results-20260923-tls-untrusted-ca.json。新增TLS_VALIDATION.md记录环境准备、参数、断言和未覆盖范围。验证后ssl恢复off，原CSV目标表3行，临时grantee已删除。无生产代码修改；TLS-on时ssl-off反向测试仍跳过，不算通过。

最新TLS真库批次：**948项，930通过、18跳过、零失败/错误**，`results/run-4WBfXG`。新增strictTlsConnectsWithTrustedCertificateAndRejectsMissingTrustFile，以GAUSSDB_HISTORY_TLS_CA指向隔离测试证书；507 CN临时启用SSL，厂商JDBC sslmode=verify-full受信任证书/SAN匹配127.0.0.1或localhost后执行中文/数值查询；信任文件缺失时08类异常，禁止明文回退，原控制连接仍可查询。初次run-NoH0WN握手报Unsupported or unrecognized SSL message，服务端日志明确certificate has group or world access；服务端证书从0644改0600后通过，属于测试配置纠正，非DBeaver修复。TLS-on时原ssl-off反向测试额外跳过，不能把两种互斥环境合并成单轮全通过。报告test-results-20260923-tls-verify-full.json。测试后CN已重启恢复ssl=off、默认server.crt/server.key，原csv_import_probe三行保留，临时grantee删除。仅命令行启动参数临时变化，未编辑gaussdb.conf/HBA。证书/私钥仅在临时目录，私钥0600，不入仓。尚未覆盖错误CA/主机名不匹配/过期证书、双向认证或SSL配置GUI；此用例不代表所有TLS场景完成。

最新网络配置凭据批次：**947项，930通过、17跳过、零失败/错误**，`results/run-2xoh7L`。ConnectionConfigurationHistoricalTest新增三项：复制的DBWHandlerConfiguration及普通/安全属性、用户名/密码、保存标志、启用状态互不影响，删除副本handler保留原对象；savePassword=false时saveToSecret返回空但运行时凭据仍在，切换true时合成凭据正确进入待保存内容；同ID更新仅替换目标handler、删除缺失ID无副作用。全部使用显式合成凭据，不连接真实认证服务；这是生产配置模型及持久化前的内容构造测试，不等于磁盘加密、安全存储后端或UI验收。报告`test-results-20260923-network-secret-copy.json`。临时grantee已删除，无生产代码修改。只读核实507的ssl/证书设置均为postmaster上下文，TLS启用需重启测试CN，本轮未改服务端配置。

最新SSL配置/连接导入批次：**944项，927通过、17跳过、零失败/错误**，`results/run-8w6LXg`。新增PostgreSSLPropertiesTest四项，通过生产getInternalConnectionProperties验证旧证书路径（空格中文）及verify-full、新版证书属性覆盖旧值/verify-ca/工厂、空选项省略、禁用handler不带保存的证书配置。纯配置映射层，假路径不读证书、不宣称TLS握手通过。初始测试使用setHandlers发现新配置不接收handler（run-WhJLse）；用updateHandler隔离后四项通过（run-XcUwup）。另在ConnectionConfigurationHistoricalTest加两项，run-T6wfNy红测确认setHandlers在初始null时忽略输入、自身列表传入时被clear清空；生产修复为new ArrayList复制，验证新建、调用方列表清空不影响配置、自身列表、替换及清空。ConfigImportWizard确实调用此生产入口，但导入向导GUI仍未验收。报告`test-results-20260923-ssl-config-import.json`；临时grantee已删除。GUI副本和发布包暂不含新模型修复；服务端SSL配置未改动。

最新角色权限/SSL批次：**938项，921通过、17跳过、零失败/错误**，`results/run-3ETAvm`。PostgreRoleMetadataTest增加三项：六个权限/登录标志64组合独立生成正/负选项（按一个测试方法统计，不虚增64项）、有效期及角色名内嵌双引号/注释单引号转义、不支持的权限选项即使模型为true仍省略。前一阶段`run-Chgt8T`937项/920通过/17跳过。另新增requiredSslDoesNotSilentlyDowngradeWhenServerSslIsDisabled，507真实厂商JDBC确认SHOW ssl=off后sslmode=require拒绝连接且SQLSTATE=08004，prefer明确允许回退并执行SELECT 1，原连接仍可查询。该场景不是TLS正向、证书校验、客户端SSL配置UI或凭据存储验证；未修改服务端SSL/HBA配置。报告`test-results-20260923-role-flags-ssl-required.json`，临时grantee已删除。无新增生产代码修改。

最新角色DDL批次：**934项，917通过、17跳过、零失败/错误**，`results/run-r2bXZs`。新增两个生产PostgreRole.getObjectDefinitionText单测，验证连接限制0/7/-1、中文空格角色名引用、LOGIN/NOCREATEROLE、服务器不支持时不导出SUPERUSER/REPLICATION以及不包含密码。红测`run-nFqYW9`捕获连接限制0被错误导出为-1；修复判断为非负数原样保留。报告`test-results-20260923-role-ddl.json`。该新增覆盖为生产DDL生成器mock层，不等同真实创建角色、角色权限UI或所有能力标记均验收。临时grantee已删除；现有GUI副本/发布包尚未包含此修复。

最新角色真库可见性批次：**932项，915通过、17跳过、零失败/错误**，`results/run-eirFpD`。productionRoleModelReadsLiveCatalogWithServerVisibilityRules以真实pg_roles结果集构造生产PostgreRole，对比OID、继承、建库/建角色/复制、登录、连接数和有效期。首次run-0P6bSi错误假设普通账号可读自身及NOLOGIN角色两行，实际只有自身一行；管理员只读检查确认两角色都存在，pg_roles视图明确定义“自身或CREATEROLE/SYSADMIN”。据此修正测试预期为按当前角色权限读取1/2行，当前普通账号一行通过，不提升账号权限。NOLOGIN在管理员查询中存在，但生产模型的真实NOLOGIN分支本轮未执行；此前mock测试不替代该分支。报告`test-results-20260923-role-live-visibility.json`；临时grantee已删除。无生产代码修改。

最新角色模型批次：**931项，914通过、17跳过、零失败/错误**，`results/run-u4KIQR`。新增PostgreRoleMetadataTest三项，调用生产PostgreRole构造/属性读取，验证长OID/中文空格名/描述、超级用户/建库/复制与其他false标记独立、无限连接数-1、有效期；可选boolean/有效期字段读取SQLException时保持false/null而非扩大权限；新建角色与用户仅按显式登录选择区分且均未持久化、默认非管理员。mock ResultSet层级，不等同GaussDB专有SYSADMIN/MONADMIN字段适配、真实创建用户或权限UI通过。报告`test-results-20260923-role-metadata.json`，临时grantee已删除。

最新搜索路径批次：**928项，911通过、17跳过、零失败/错误**，`results/run-dc12z9`。searchPathOrderResolvesShadowedTablesWithoutChangingQualifiedAccess使用两个随机schema各一同名表，数据11/22；不存在schema前缀被忽略，current_schema及不限定表随路径顺序切换，显式限定仍准确；路径只有不存在schema时不限定查询42P01但限定访问仍正确。localSearchPathRestoresAfterCommitAndRollback验证事务内SET LOCAL切到第二schema，分别rollback/commit后都恢复第一schema，finally恢复自动提交再清理。两个场景507真实厂商JDBC通过，不等同DBeaver活动schema下拉、连接初始化设置、SQL补全或路径权限过滤GUI验收。报告`test-results-20260923-search-path.json`；临时grantee已删除。

最新外键能力批次：**926项，909通过、17跳过、零失败/错误**，`results/run-TmXrWX`。新增compositeForeignKeyMetadataAndCascadeWhenServerSupportsForeignKeys：真实创建复制父/子表，支持时验证复合FK KEY_SEQ/列映射、UPDATE/DELETE CASCADE规则、孤儿行23503、级联更新/删除。**当前507分布式在CREATE子表时返回0A000、FOREIGN KEY ... REFERENCES constraint is not yet supported，因此正向路径跳过，未验证通过**。只对明确0A000跳过，权限/语法/其他错误仍失败；没有将外键本身列为项目不适用。先前人工探测在事务中回滚，两探测表计数0；自动用例随机schema按通用清理机制退出。报告`test-results-20260923-foreign-key-capability.json`；临时grantee已删除。需支持外键的目标实例继续验收，不能以此宣称全部约束支持。

最新表达式/部分索引批次：**925项，909通过、16跳过、零失败/错误**，`results/run-Y3bY3v`。productionTableDdlPreservesExpressionAndPartialIndexAfterRename在507分布式真库创建lower(label) WHERE active非唯一索引，重命名为含空格中文的Index 中文，通过生产readTableDDL读取、删除本轮表、原样DDL重建。目录独立核对索引名、表达式lower(label)、predicate=active；插入三行，过滤查询只返回匹配的active行；JDBC元数据新名存在/旧名不存在且NON_UNIQUE=true。删除该索引后JDBC元数据不再列出、表三行仍保留。不是证明优化器选择该索引，也不是索引编辑器/批量删除UI。报告`test-results-20260923-expression-index.json`；临时grantee已删除。

最新会话终止真库批次：**924项，908通过、16跳过、零失败/错误**，`results/run-TYJMOB`。terminatedOwnSessionRollsBackAndFreshConnectionCanWrite在507上创建随机schema/表及独立同账号writer，writer未提交插入1行且自身可见、controller不可见；controller仅对刚从writer获取的pg_backend_pid调用pg_terminate_backend并断言true。writer后续SELECT必须报57P01或08类连接SQLSTATE。再以独立观察连接确认0行，创建新连接写入id=2/reconnected，原controller也读取相同值。原连接终止、未提交数据不残留、重新连接读写通过，耗时0.188秒；不是整个服务停机/主备切换/网络断连，也不证明DBeaver自动重连弹窗或SQL重试策略。报告`test-results-20260923-session-termination.json`；临时grantee已删除。无产品代码修改。

最新异常关闭批次：**923项，907通过、16跳过、零失败/错误**，`results/run-rdF7uo`。新增红测直接准备待执行batch后调用生产close，旧实现未关闭batch，run-w8XGN7报Wanted but not invoked。closeExporter补充在会话关闭前释放残留batch并清空引用；batch.close异常记录日志但继续事务回滚和会话/独立连接清理。两个新测试验证正常关闭顺序/重复close仅一次，以及batch.close异常不阻断其余资源释放、不提交。反射只准备运行态，未声称GUI泄漏测量或所有JDBC资源已穷尽覆盖。报告`test-results-20260923-consumer-abort-cleanup.json`；临时grantee已删除。此共享组件补丁尚未装入GUI副本，后续集成验收需使用更新bundle。

最新收尾取消竞态批次：**921项，905通过、16跳过、零失败/错误**，`results/run-azbk3S`。新增红测在bulk.flushRows回调中设置取消，旧fetchEnd仍调用finishBulkLoad，run-C3qJgw报NeverWantedButInvoked（真实生产入口、确定性mock交错，不是GUI并发压测）。生产修复在最终刷新后及afterDataChange通知前重新检查源/目标监视器，避免沿用入口取消快照。最终三项新测试分别覆盖源端取消、目标端取消以及无取消对照；取消不得finish或通知，正常仍按flush→finish→close执行。报告`test-results-20260923-consumer-cancel-race.json`；临时grantee已删除。此补丁在共享数据传输组件内，不限于GaussDB；未安装进当前GUI隔离副本，不能声称GUI此竞态已复验，运行中工具栏取消仍待补。

最新接收器取消批次：**918项，902通过、16跳过、零失败/错误**，`results/run-3AHbLL`。DatabaseConsumerCleanupTest新增四项：源端已取消但目标端未取消、目标端已取消但源端未取消，都必须在fetchEnd关闭待执行batch且无execute/commit，随后close回滚；bulk模式取消不得flushRows或finishBulkLoad，close只释放bulk资源；空结果重复fetchEnd只关闭batch一次且不提交。断言直接调用生产入口，反射准备运行态、mock事务/批次，不算真实GUI运行中取消通过。报告`test-results-20260923-consumer-cancellation.json`。16项跳过包含本轮未启用的专用GB18030数据库场景；临时grantee已删除。日志中rollback failed/session close failed为异常注入用例预期路径，不是测试失败。

最新接收器清理批次：**914项，898通过、16跳过、零失败/错误**，`results/run-e1Mclr`。新增DatabaseConsumerCleanupTest五项直接调用生产DatabaseTransferConsumer.close：回滚→恢复自动提交→关闭会话/独立连接的顺序且重复关闭不重复释放；回滚失败仍释放资源且不启用自动提交；共享连接不关闭且恢复原手动模式；自动提交状态不发回滚；会话关闭失败仍关闭独立连接。反射只用于准备私有运行态，事务/会话为mock，不声称真实连接或完整取消流程。真实GUI错误停止与间隔提交证据另见GUI_PROGRESS 322–347。本次未配置专用GB18030数据库，因此比此前多1跳过，原通过证据保留但不并入本轮通过数。首次run-9mQp5b测试常量引用错误导致编译失败，修为本分支实际构造方式后完整重跑。报告`test-results-20260923-consumer-cleanup.json`。临时grantee已删除。

最新编辑器会话批次：**884项，869通过、15跳过、零失败/错误**，`results/run-f15Gje`，源码c2ed8205e6。未增加JUnit数量。GUI在同一客户端第二次调试复现仍显示旧源码，补充稳定的launch对象作为调试编辑器输入属性，使跨launch时重新加载文档、同一launch单步不反复刷新。已安装debug.ui 202609231021及GaussDB 202609231013实测两次启动：第一次v4，外部改为v3，第二次显示v3且line5正确；F8后line6与caretLine6一致；F9后回滚且独立表不变。证据GUI_PROGRESS 226–253。普通非调试编辑器F5及未保存文本保护仍需独立验证，不能由本场景推导通过。

最新调试源码新鲜度批次：**884项，869通过、15跳过、零失败/错误**，`results/run-9aFLah`，源码98932d5af6。新增debuggerSourceReloadsPersistedBodyInsteadOfCachedCatalogText：预置old_call目录缓存，两次生产调试源码请求必须分别读取new_call/newer_call，并关闭语句、结果和会话。红测run-DSwu6O准确返回old_call而失败；修复仅在调试正文读取时重新查询持久化prosrc，普通DDL缓存策略不改变。报告test-results-20260923-debug-source-freshness.json。GUI尚未安装该批次，不等同已打开编辑器文档刷新通过。

最新导航节点批次：**883项，868通过、15跳过、零失败/错误**，`results/run-di9NkY`。DebugUtils增加源码节点缺失时仅刷新所属容器并重新解析原OID一次的路径，避免沿用刷新前模型实例；使用普通来源事件而非FORCE_REFRESH，不强制丢弃其他编辑器本地修改。新增DebugSourceNavigationTest四场景：刷新后模型实例替换、已存在节点不刷新、取消不刷新、重试仍缺失不循环。报告`test-results-20260923-source-navigator.json`。单元/真库回归通过；GUI新函数热加载仍待重新安装插件后复验，旧父编辑器源码另需修复，不计为完成。

最新厂商目录类型批次：**879项，864通过、15跳过、零失败/错误**，`results/run-8Sf77R`。Linux GUI展开函数树真实报错 `Unsupported vector type: com.huawei.gauss200.jdbc.util.PGobject`。新增 `vendorCatalogVectorsAndArraysUseProductionUnwrapping`，在507创建含numeric/integer参数的函数，读取真实proargtypes对象，调用生产isPGObject/getIdVector/getIntVector；另读取真实bigint[]并验证生产isPGArray/getIdVector与资源释放，普通Object不能误识别。红测`run-PUYwu6`准确失败于厂商PGobject未识别，生产GaussDB server扩展补充gauss200命名空间，保留已有postgresql/gaussdb命名空间。报告`test-results-20260923-vendor-catalog-types.json`。该批次证明真实驱动类型解包，不直接等同完整函数模型或GUI通过；后续界面结果见GUI_PROGRESS。临时权限测试角色已删除。

最新调试缓存批次：**878项，863通过、15跳过、零失败/错误**，`results/run-G0sfud`。GUI外部新建子函数后F7进入两层栈但找不到源码；新增refreshesOnlyTargetRoutineCachesWhenCatalogConfirmsNewFunction，红测Routine42未找到（run-9u44Ml），修复为目录确认OID目标schema存在且第二次缓存查找仍遗漏时，仅重载该schema两类routine缓存一次。回归同时保留跨schema/OID不改变启动配置测试。报告`test-results-20260923-debug-cache-refresh.json`。源码GUI待换新插件复验，已有父编辑器旧文本是另一未闭环问题，不能用单测通过替代。

最新验证范围升级：同样 **877项/862通过/15跳过/零失败错误**，`results/run-rDu0i6`。两个序列往返方法现已移除手工填充 AdditionalInfo，改为生产 loadAdditionalInfo 实际 SQL经厂商 JDBC读取序列；生产 getSequenceBody复用加载结果后重建，连续值、边界、步长和缓存值实际比对通过。mock仍用于元数据对象和会话桥接，但目录值不再预置；生产缓存值必须大于0，结果/语句/会话各关闭一次。报告 `docs/gaussdb/test-results-20260923-sequence-live-loader.json`。下文“参数加载由测试完成”仅描述此前批次，最新加载路径已覆盖。未增加方法数量，未计作额外用例。

最新序列批次：**877项，862通过、15跳过、零失败/错误**，`results/run-E6f6jm`。新增真库升序/降序生产 getSequenceBody 重建：真实目录参数输入生成器，重建后连续值分别10/13/16与-2/-5/-8，min/max/increment保持，覆盖负起点/负步长/上界0。参数加载在这两个场景中由测试桥接完成，不冒充生产元数据加载真库联验。

同时新增旧目录/新版视图的生产 loadAdditionalInfo mock 回归。旧目录红测读取 cache_value=64 却得到0（`results/run-6GPe4x`），修复 PostgreSequence 旧分支误用 cache_size，改为 cache_value；新版仍使用 cache_size。两个分支生成 CACHE 64，且重复获取使用缓存、资源仅关闭一次。报告 `docs/gaussdb/test-results-20260923-sequence-roundtrip.json`。序列文件向导、RESTART、所有版本仍未完成；当前 GUI 副本/发布包不含本次修复。临时角色已删除确认0。

最新索引往返补充：**873项，858通过、15跳过、零失败/错误**，`results/run-1mBJvo`。新增 `productionTableDdlRebuildsUniqueAndOrderedCompositeIndexes`：HASH 表建复合唯一索引和 amount DESC/label ASC 索引，经生产读取 DDL、删除、原样重建；同 id 不同 label 可写，重复 id/label 返回23505；真实 JDBC 索引元数据断言列序和 DESC/ASC（D/A），不以查询 ORDER BY 替代索引定义验证。报告 `docs/gaussdb/test-results-20260923-index-roundtrip.json`。临时角色清理确认0；不代表表达式/部分索引、批量删除或 GUI 全覆盖。

当前最新：DDL 真库往返批次 **872项，857通过、15跳过、零失败/错误**，`results/run-Zf3fWA`；新增两个生产入口真库场景，见下方。

### 表 DDL 生产读取及重建（507）

- `productionTableDdlRebuildsHashDefaultsConstraintsAndComments`：真实建 HASH 表含默认中文值、PK、NOT NULL、CHECK、表/列中文注释；调用生产 `PostgreServerGaussDB.readTableDDL`，删除本轮表后原样执行返回 DDL。重建后的默认值和 numeric 值正确，重复键/负数/NULL 分别报23505/23514/23502，注释保留。
- `productionTableDdlRebuildsReplicatedQuotedIdentifiers`：真实建复制表，表名含空格、列名含中文/空格；同样经生产读取、删除、重建，带单引号数据正确返回，目录仍为复制策略R。

测试桥接仅 mock 对象/会话框架，生产 SQL、OID 绑定、真实厂商 JDBC 执行、DDL 返回及重建结果不是 mock；验证生产结果集、语句、会话关闭。capability fixture 明确提供 pg_get_tabledef，实际函数必须执行成功；不冒充服务器能力探测测试。只删除随机专用 schema 中本轮创建的表，测试结束清理 schema 和临时 grantee。报告 `docs/gaussdb/test-results-20260923-ddl-roundtrip.json`。不覆盖导出文件向导、整个 schema、分区/索引全部变体或无原生函数时的通用生成器。

最新补充：表 DDL 读取批次 **870 项，855 通过、15 跳过、零失败/错误**（普通权限配置，`results/run-qRnIdr`）。新增 PostgreServerGaussDBTest 5 项直接调用生产 readTableDDL，断言原生文本含分布子句/中文原样保留、OID 参数绑定、不支持时不打开会话，以及空结果/权限拒绝/prepare 失败的降级和资源关闭。初次编译测试常量误写 ORA，改为仓库实际 ORACLE 枚举后完整通过；未修改生产代码。报告 `docs/gaussdb/test-results-20260923-table-ddl-reader.json`。这不是真实导出重建或 GUI 验收，其他范围仍按覆盖计划执行。

最新执行摘要：分布式批次在普通账号、临时监控管理员两个配置下，各 **865 项，850 通过、15 跳过、零失败/错误**。正反权限测试分别在对应配置通过，不能将两个计数相加。ROUNDROBIN 当前被服务端拒绝，仍未通过。下文按时间保留各历史批次，不应将旧批次计数当最新总数。Linux GUI 变量修改/非法值拒绝/变量名监视/修改值参与 OUT 计算/回滚/F10 首次暂停终止的独立证据见 [GUI_PROGRESS.md](GUI_PROGRESS.md)，不并入 JUnit 数量。

最新新增真库方法：`closingConnectionRollsBackUncommittedRowsAndRejectsFurtherStatements`、`enablingAutocommitCommitsPendingRowsButLaterManualRollbackRemainsIsolated`、`readOnlyTransactionRejectsWritesAndNormalConnectionRemainsWritable`。分别验证关闭回滚及已关闭连接拒绝使用、自动提交切换的提交边界、只读事务 SQLSTATE 25006 与恢复后提交。均以其他连接观察实际数据，使用测试随机 schema 并清理。结果 `docs/gaussdb/test-results-20260923-connection-lifecycle.json`，本地执行 `results/run-fIxeiF`。不是连接池、SSL、异常认证或自动重连验收。

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

## 第二批增量（2026-09-23）

上述 707 项是前批次运行快照，不是新增代码的全量验收结果。第二批新增 25 项单元测试及 7 项真库测试：

- SQL 拆分/别名边界 4 项，表分区元数据 5 项，异常分类 3 项，变量监视 7 项，分区边界解析 6 项：已通过。
- DEFAULT、跨 schema 同名过程、保存点失败恢复、批处理回滚、fetchSize 完整取数、二进制/时间戳、DDL 后元数据：7 项已编译，真库待验证。

本次 Docker 和 JDBC 连接均受执行环境权限限制。显式真库运行在建立连接阶段报 `Operation not permitted`，不是通过。后续独立离线回归 289 项：258 通过、31 跳过、0 失败/错误。该筛选不包含完整平台测试；跳过不代表已验证。源仓库记录 `docs/gaussdb/test-results-20260923-offline-followup.json` 仅包含该次新生成的报告。

当前不能标记全部完成或上传为全通过版本；需在允许连接测试库的执行环境完成第二批真库验证，并继续补齐其余适用场景。

## 权限恢复后的第二批复验

权限恢复后实际执行真库，发现并修正两处测试假设：分布式默认分布键不能删除，元数据测试改为删除普通列并保留分布键；供应商驱动批量计数返回 `[4,0,0,0]`，验证总计数并逐行核对四行数据及回滚，不要求每项都为 1。另新增 5 项生产 ExecuteBatchImpl 回归，验证聚合计数、零行匹配、失败关闭、取消和不重复执行；无执行时 DBCStatistics 的哨兵是 -1，不是 0。

最新完整执行：**744 项，732 通过、12 跳过、0 失败/错误**。历史 JDBC 类 23 项中 22 通过、1 因服务器拒绝过程重载创建而跳过；第二批新增 7 项真库已全部通过。结果为 `docs/gaussdb/test-results-20260923-live-followup.json`，原始错误仍保留在本地日志。此结果不关闭 [覆盖计划](COVERAGE_PLAN.md) 中的其他未完成场景，目标仍在执行，未上传为最终验收版本。

## CSV 导出补充

新增 6 项实际 DataExporterCSV 输出断言：SQL NULL/空串/文字 NULL、带分隔符的自定义 NULL 标记、CRLF 行分隔与内嵌换行、引号与换行替换同时存在、长 Unicode 不截断、前导零标识符不丢失。

首次 112 项 CSV 测试中 1 项失败，复现引号转义错误地重新读取原字符串，覆盖换行替换结果。生产修复仅将引号转义输入改为已处理的字符串。完整回归 **750 项：738 通过、12 跳过、0 失败/错误**；其中 CSV 112 项全部通过。不是文件导入、GUI、Excel 或所有历史导出场景完成。证据：`docs/gaussdb/test-results-20260923-csv-followup.json`。

## 执行计划补充

新增 3 项真库测试（聚合排序、连接、UNION ALL），直接执行生产生成的 EXPLAIN XML SQL，将真实 XML 经 DBeaver 会话适配后交给生产解析器，独立按 DOM 逐层比对类型、节点数量、顺序、父引用、总成本与估算行数。为了暴露实际子节点，在独立测试连接设置 `enable_fast_query_shipping=off`，连接关闭即结束；不代表默认下推策略或所有计划节点均验收。

首次聚合计划发现生产 `PostgrePlanNodeXML` 为子节点传入空 parent。已改为当前节点，并新增 3 项 PostgreSQL XML 单元回归（兄弟节点、三级层次、非 ANALYZE 代价属性）。最初空表和默认下推可产生单节点计划，现补数据并强制断言至少两个节点，避免树关系测试空跑。

完整回归 **756 项：744 通过、12 跳过、0 失败/错误**。新增 6 项全部通过，历史 JDBC 类 26 项中 25 通过、1 重载能力跳过。结果：`docs/gaussdb/test-results-20260923-plan-followup.json`。尚未进行执行计划 GUI 及向量/递归节点全面验收。

## 连接与执行器补充

新增 5 项真库场景：查询超时及 SQLSTATE 57014、主动取消及时间边界、Statement 关闭连带关闭 ResultSet 但保留连接、缺失表 42P01 后恢复、maxRows 不改变实际行数。超时和取消均随后用同一连接执行 SELECT 验证复用，不只断言抛异常。取消仅针对本测试 Statement，定时任务有退出和等待机制。

另新增 1 项真实供应商驱动 URL 契约（不连接无关协议），4 项生产 provider 地址格式测试（空项、缺省端口、IPv6、URL 组件注入）。完整回归 **766 项：754 通过、12 跳过、0 失败/错误**。历史 JDBC 类 32 项中 31 通过、1 重载能力跳过。结果：`docs/gaussdb/test-results-20260923-connection-followup.json`。不代表连接向导、SSL、密码存储或 UI 取消按钮已经验收。

## 对象管理补充

新增 7 项真实 JDBC 场景，其中 6 项通过：复合主键名称/KEY_SEQ/唯一性；索引列/非唯一标记及删除刷新；CHECK 23514 且不破坏已有数据；视图重命名与结果不变；依赖阻止 DROP、CASCADE 删除依赖而保留无关表；序列 START/INCREMENT 取值。

1 项序列 RESTART 因当前服务端明确返回 0A000（只支持修改 MAXVALUE/OWNER）而跳过，不算通过；原失败记录保留。原组合测试拆成递增正向测试和独立 RESTART 能力测试。生产共享 PostgreSequenceManager 有生成 RESTART 的路径，尚需 GaussDB 能力门控核实，不能宣称该操作适配完成。

完整回归 **773 项：760 通过、13 跳过、0 失败/错误**。历史 JDBC 类 39 项中 37 通过、2 服务端能力跳过。证据：`docs/gaussdb/test-results-20260923-objects-followup.json`。本批不替代对象编辑器、批量删除向导或其他部署形态验收。

## 序列 DDL 导出边界

确认 GaussDB 没有专属 sequence manager 注册，共享 PostgreSQL 模型/编辑链路。RESTART 的服务端能力门控尚未解决，不能据此关闭所有 PostgreSQL 或其他版本的编辑功能。

源码审查发现 `PostgreSequence.getSequenceBody` 仅输出正增量和非负起点，且用默认边界替换已加载的负边界。修复为保留非零增量，以及已加载元数据中的实际 MINVALUE/MAXVALUE/START（含 0 和负值）。新增 4 项生产 DDL 生成测试：降序增量、负边界/起点、零上界、升序缓存与 CYCLE。首轮测试编译因监视器 API 使用错误失败，已修正；未声称首轮红测复现成功。

完整回归 **777 项：764 通过、13 跳过、0 失败/错误**。新增 4 项通过。证据：`docs/gaussdb/test-results-20260923-sequence-ddl-followup.json`。这是 DDL 文本生成验证，尚未完成降序序列跨库重建或 UI 编辑验收。

## 类型与结果补充

新增 7 项真实 JDBC 测试全部通过：整数数组的 NULL/顺序/边界、JSON 中文与嵌套、SQLXML 转义、布尔 false 与 SQL NULL 的 wasNull 区分、闰日和 TIME 微秒、窗口函数排名/分组、聚合 NULL 计数与十进制精度。

日期初始 SQL 使用 ISO 日期字面量，被当前 ORA 会话的日期格式拒绝；改用显式 `to_date(...,'YYYY-MM-DD')` 测试日期值。没有宣称 ISO 字面量在当前配置通过，也未修改全局 NLS 设置。原失败保留。

完整回归 **784 项：771 通过、13 跳过、0 失败/错误**，历史 JDBC 类 46 项中 44 通过、2 能力跳过。证据：`docs/gaussdb/test-results-20260923-types-followup.json`。本批不等于数据网格、JSON/XML 编辑器、GB18030 或时区验收。

## DML、查询与函数结果补充

新增 6 项真实 507 ORA 分布式 JDBC 场景全部通过：MERGE 匹配更新、未匹配插入及事务回滚；ON DUPLICATE KEY UPDATE 仅更新冲突行；关联 EXISTS/NOT EXISTS 与含 NULL 的 NOT IN；LEFT JOIN/GROUP BY/HAVING 和带空格别名；中文长度/截取/替换/引号/大小写/拼接；abs/ceil/floor/round/mod/power 精确数值断言。

测试调用真实厂商 JDBC，每个场景独占随机 schema，设置查询超时，核对完整有序结果行，结束清理自己创建的对象。对应方法名位于 `GaussDBHistoricalJdbcLiveTest`，不是原内网测试源码迁移，也不代替编辑器补全/高亮验证。

完整回归 **790 项：777 通过、13 跳过、0 失败/错误**；历史 JDBC 类 52 项中 50 通过、2 能力跳过。结果 `docs/gaussdb/test-results-20260923-sql-followup.json`，运行目录 `results/run-mD5B9C`。GUI OUT 过程、参数校验、F8/F9、提交/回滚独立证据另见 `GUI_PROGRESS.md`，不叠加到 JUnit 数量。

## 方言分类及转义补充

新增 5 项生产方言单元测试：配置后的 GaussDB 关键字大小写分类、类型/函数/未知词分类、类型集合修改隔离、带引号标识符往返、标准字符串字面量转义往返（中文/单引号/换行/反斜杠/语句分隔符）。

首次运行 `results/run-Dg3LyJ` 有 1 项失败：测试错误地期待 YEAR 分类为 TYPE。源码 AbstractSQLDialect.addKeywords 明确保留既有 KEYWORD 优先，避免标识符漏加引号。修正断言为 YEAR 属于类型枚举且分类仍为 KEYWORD；没有为使测试通过改生产行为。

复跑 `results/run-m1qfVB`：**795 项，782 通过、13 跳过、0 失败/错误**。GaussDBDialectTest 的 24 项全部通过。证据 `docs/gaussdb/test-results-20260923-dialect-followup.json`。这是方言 API 契约，不代表全部模式、实时语法检查或编辑器高亮均通过。

## CSV 导入边界与缺陷修复

通过生产 DataImporterCSV.runImport 新增 5 项：短行补 NULL + trim；引号逗号/双引号/多行中文；空串与显式 NULL 标记；未闭合引号返回带 IOException 的 DBException；trim + emptyStringNull + 缺列组合。接收器采集生产结果集的实际值，正常结束校验 fetchEnd/close。数据库会话使用 mock，这不是文件向导或数据库写入端到端验收。

首轮红测明确复现 DataImporterCSV.java 的 NullPointerException：短行补齐 null 后直接 trim。生产修复仅跳过 null 元素的 trim，不把缺失值变成空字符串。复跑 CSVImporterTest 12 项全部通过；全量 **800 项，787 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-import-followup.json`，本地运行 `results/run-iHicdy`。新修复尚未装入正在运行的 GUI 副本或发布包。

### 编码、上限及取消

新增 5 项生产导入器测试：GB18030 中文及扩展字符、无表头 UTF-16LE BOM 去除和前导零保留、maxRows 只计数据行、读取前取消、首行后取消。接收器 fetchEnd/close 断言移入 finally，既有未闭合引号异常路径也验证释放。未声称取消后数据库事务已回滚；接收器仍是 mock。

CSVImporterTest **17 项全部通过**；完整回归 **805 项，792 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-import-lifecycle.json`，本地运行 `results/run-CA0qP0`。金融字符集覆盖限于本地 CSV 字节解码，不代表数据库连接 client_encoding 或客户金融版本验证。

## JDBC 警告、元数据与生命周期

新增 4 项真实 507 测试全部通过：过程 RAISE WARNING 能通过 Statement.getWarnings 读取和 clearWarnings 清除且继续查询；结果元数据保留中文/空格别名、列序、numeric(18,4) 精度与标度、varchar(37) 长度；ResultSet/Statement 关闭后操作抛 SQLException，但连接 isValid 且能继续查询；参数化插入含分号/引号/DROP 文本/中文/换行/反斜杠，按完整原文取回且表仍在。

历史 JDBC 类 56 项，54 通过、2 能力跳过。完整回归 **809 项，796 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-jdbc-contracts.json`，运行 `results/run-idizTN`。仅证明所用厂商驱动和 507 的契约，不代表所有驱动版本或 GUI 警告显示已经验证。

## 连接配置复制隔离

新增 ConnectionConfigurationHistoricalTest 4 项，使用生产 DBPConnectionConfiguration/Bootstrap/ShellCommand：复制后的驱动/provider 属性独立；认证属性从外部 Map 防御复制、复制后移除不影响原值；初始化 SQL、默认 schema 和自动提交配置保留且独立；连接事件命令深复制、修改/清除不影响原对象。命令仅为未执行的测试文本，没有执行外部程序或使用真实凭据。

完整回归 **813 项，800 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-configuration.json`，运行 `results/run-kdwAWV`。这是配置模型行为，不等于连接文件导入导出、安全存储加密或 SQL 历史持久化验收。

## 查询历史执行记录模型

QueryHistoryExecutionTest 新增 6 项：SELECT 的文本/schema/catalog/取数计数及生命周期；DML 影响行与取数行分离；META 查询不会仅凭方言判定标为修改事务；SQLException 保留厂商错误码/文本并标记事务失败；恢复记录的执行+取数耗时；清除错误不丢 SQL 文本。

首轮因模型和测试 OSGi 类加载器不同，包内 API 直接访问触发 IllegalAccessError（测试接入问题）。改为测试中反射调用实际包内方法，没有扩大生产接口。6 项复跑通过；完整回归 **819 项，806 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-history-model.json`，运行 `results/run-wXjdB7`。没有通过数据库持久化/重启恢复/固定收藏/清理 SQL 历史的证据，这些仍未完成。

## CSV 解析与真实 JDBC 写入衔接

新增 3 项：生产 DataImporterCSV 解析中文、引号、跨行和缺列后经厂商 JDBC 写入，独立观察连接验证提交前不可见、提交后完整值；未闭合引号发生在已写入一行后，显式回滚后无数据；重复主键保留 SQLSTATE 23505，显式回滚后无数据。正常及异常路径均检查接收器 fetchEnd/close，关闭断言失败不能被预期异常测试掩盖。

测试启动曾因未初始化 Query Manager 和不支持静态 mock 失败。最终使用应用测试基类并通过 DBWorkbench 正常初始化平台，没有静态 mock 或修改生产日志服务。最新完整回归 **822 项，809 通过、13 跳过、0 失败/错误**，历史 JDBC 类 59 项中 57 通过、2 能力跳过。证据 `docs/gaussdb/test-results-20260923-csv-jdbc.json`，运行 `results/run-1KSrvf`。

边界：接收器是测试 JDBC 写入桥接器，不是生产 DatabaseTransferConsumer；回滚由测试显式执行。因此这些结果不证明导入向导、自动取消回滚、字段映射 UI 已验收。

## 权限 SQL 生成与实际授权范围

PostgrePrivilegeCommandTest 新增 7 项：角色引号及限定对象名、REVOKE 不附带转授权、单项转授权、全部权限转授权、DDL 导出显式 ALL、混合转授权拆分、相反操作合并抵消。首轮红测证实全部权限路径丢失 WITH GRANT OPTION。修复生产 PostgreCommandGrantPrivilege：展开显式 ALL，并将可转授权和普通权限分为独立 GRANT，避免提升其他权限；枚举集合确保输出顺序稳定。权限编辑器和对象 DDL 导出使用该共享入口。

真库新增 productionGrantCommandsPreservePerPrivilegeGrantabilityInDatabase：普通对象拥有者执行生产命令生成的 SQL，向预建 NOLOGIN 测试角色赋 SELECT（可转授权）及 INSERT（不可转授权），用 has_table_privilege 检查两项基本权限、两项转授权和未赋予的 UPDATE；执行生产 REVOKE 后逐项确认为 false。对象元数据为测试 mock，SQL 生成器、厂商 JDBC 和数据库权限检查是真实实现；这不是权限编辑器 GUI 或第二用户实际访问验收。

夹具校正：507 对 NOLOGIN 角色仍要求密码；由管理员在服务器生成符合策略的随机密码。pg_roles 对普通用户过滤其他角色，因此不能以普通用户查不到角色判断不存在；管理员确认 NOLOGIN，测试验证真实授权结果。运行结束删除临时角色并确认角色计数 0，随机 schema 由测试清理。

完整回归 **830 项，817 通过、13 跳过、0 失败/错误**；历史 JDBC 类 60 项中 58 通过、2 能力跳过。证据 `docs/gaussdb/test-results-20260923-privileges.json`，运行 `results/run-lj7A5H`。新修复尚未打入发布包。普通用户拒绝访问、权限 UI、默认权限和列级权限仍待继续覆盖。

### 列级权限边界修复

新增 3 个命令测试：多个权限分别保留带引号列名、默认权限 schema/授权者/接收者正确引用、重复合并幂等。测试夹具最初有嵌套 Mockito stubbing 错误，修正后真正红测确认生产输出 `GRANT SELECT, UPDATE(column)`，SELECT 实际不受列限制。

扩展现有真库授权测试，使用 id 和 restricted_value 两列；修复前数据库明确返回 restricted_value 的 SELECT 权限为 true，与预期 false 不符。生产修复改为每一项权限均附列名：`GRANT SELECT(id), UPDATE(id)`。修复后真库逐项验证两列的 SELECT/UPDATE/INSERT，只有 id 的 SELECT/UPDATE 为 true；生产 REVOKE 后全部 false。仍是生产 SQL + JDBC + 数据库权限函数验证，不等于另一登录用户执行查询或 GUI 验收。

命令测试 10 项全部通过；完整回归 **833 项，820 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-column-privileges.json`，运行 `results/run-TEF5rG`。临时 NOLOGIN 角色已删除并确认计数 0。默认权限目前只验证生成 SQL，未完成真库新对象继承权限验证；发布包尚未更新。

### 默认权限继承与 ACL 名称解析

新增 productionDefaultPrivilegesApplyOnlyToFutureObjectsAndRevocationIsNotRetroactive 真库场景：生产生成的 ALTER DEFAULT PRIVILEGES 仅向专用随机 schema 中以后创建的表赋 SELECT；旧表不追溯授权；撤销后新表无 SELECT，之前已继承权限的表仍保留 SELECT。各阶段同时验证 INSERT 和 SELECT WITH GRANT OPTION 均未意外获得。使用普通对象拥有者连接与预建 NOLOGIN 角色，生产 SQL 生成器、厂商 JDBC、has_table_privilege 均真实执行，元数据对象为 mock。不是第二登录用户访问或 GUI 验收。

PostgreAclParsingTest 新增 4 项：含等号及转义双引号的角色名、授权者名称和逐项转授权标记、PUBLIC/重复角色/无分隔符输入、默认 ACL 的授权者与未授予项。红测发现 ACL 按第一个等号截断引号内角色名，且授权者引号和名称内部双引号未正确还原。生产修复识别引号外分隔符，并用方言的反转义入口处理授权双方名称。名称边界仅为模型测试，不声称已在真库创建特殊名称角色。

完整回归 **838 项，825 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-default-acl.json`，运行 `results/run-yva6Xu`。管理员删除临时角色并核对计数 0。权限 UI、独立用户拒绝访问等未完成项继续保留。

### JDBC ACL 数组进入生产解析器

扩展既有 productionGrantCommandsPreservePerPrivilegeGrantabilityInDatabase：授权后从 pg_class 读取真实 relacl JDBC Array，交给 PostgreUtils.extractPermissionsFromACL（Array 入口），检查目标角色恰好一项、SELECT 含转授权、INSERT 不含转授权、UPDATE 未授予；撤销后该角色不再出现在解析结果，最后释放 JDBC Array。使用实际 PostgreServerGaussDB 类型识别，其他对象元数据为 mock。修复测试接入时遗漏的服务端类型对象后通过；本轮没有新增生产修改，也没有靠拆分测试增加用例计数。

尝试在 507 创建含等号和双引号的专用角色被服务端以 Invalid name 拒绝，随后以该不存在角色运行的两项权限测试也失败。这不算通过。改用合法 NOLOGIN 测试角色后完整链路通过；特殊角色名仍只有解析器单元证据，不能对当前 507 承诺该名称受支持。

最新回归 **838 项，825 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-jdbc-acl.json`，运行 `results/run-GD5bCR`。临时合法角色已删除，管理员核对测试角色前缀计数为 0。

## 对象搜索范围、绑定与关闭

PostgreStructureSearchTest 新增 5 项，通过生产 findObjectsByMask 入口验证：含引号/分号的名称 mask 只作绑定值且使用指定 LIKE/上限；SQLException 保留原因并关闭资源；全局 schema 过滤器全部不匹配时不发起不受限查询；部分匹配仅绑定保留 schema 的 OID，注释 mask 与 OID 参数顺序正确；取消时不读结果行并关闭结果集/语句/会话。

红测确认原逻辑将“过滤后没有 schema”转换为“不限制 schema”并打开查询会话。修复在启用过滤器且零匹配时直接返回空结果。这是客户端可见范围过滤，不是数据库访问权限控制。测试使用 mock JDBC 和元数据，不等于搜索 UI/真库搜索验收。

完整回归 **843 项，830 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-search-scope.json`，运行 `results/run-XIyhgq`。本次仍预建角色执行两项权限真库场景，结束删除并确认计数 0。搜索结果类型与对象解析、schema 搜索过滤、多类型选择、包/同义词支持情况仍需继续核实。

### 关系类型与跳转目标

新增 5 个关系类型参数化场景（r/p/f/v/m）及 1 个缺失 schema 场景。生产搜索入口必须保留结果类型和名称，通过 schema+OID 解析正确对象；对象随后被删除时抛 DBException；无法解析所属 schema 时不发布无效引用。最初红测证实 p（分区表）和 f（外部表）都被标为 PostgreMaterializedView，修复分别映射为 PostgreTable 与 PostgreTableForeign。r/v/m 原行为保持。

搜索类 11 项全部通过；完整回归 **849 项，836 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-search-types.json`，运行 `results/run-4zUrtE`。本组为 mock JDBC 目录行的生产搜索入口测试，尚非真库元数据或 GUI 跳转验收。权限回归临时角色已删除且计数 0。

### 507 真库表/视图搜索

新增两项真库测试，调用 PostgreStructureAssistant.findObjectsByMask，JDBCSession/Statement/ResultSet 接口通过测试桥接器转发到厂商驱动。SQL 与绑定顺序由生产实现生成，查询真实 pg_class/pg_namespace，非手写等价搜索 SQL。上下文/schema 元数据对象为 mock，不算完整连接注册或搜索 UI 验收。

productionTableSearchUsesRealCatalogCaseCommentsAndLimit 验证表/视图名称和结果类型、LIKE/ILIKE 大小写差异、LIMIT、开启/关闭注释搜索、含引号分号文本无匹配且不破坏对象。productionSearchKeepsSameNamedTablesInTheirRequestedSchema 验证两个随机 schema 的同名表各返回一项，删除其中一个后该 scope 无结果、另一个仍保留。测试结束清理各自创建的 schema。

完整回归 **851 项，838 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-live-search.json`，运行 `results/run-jfsml2`。权限回归临时角色再次清理并确认计数 0。函数/过程、列、约束、类型、schema 搜索和 GUI 仍需补齐。

### 507 列、约束和复合类型搜索

新增 productionColumnSearchExcludesSystemDroppedAndIndexAttributes，真实建表带主键、删除一列、添加列注释，再调用生产列搜索。修复前结果包括已删除列占位名、ctid/xmin/xmax 等系统列以及来自主键索引的重复 id，红测准确复现。生产查询增加正 attnum、非 attisdropped 和表/视图关系类型条件，修复后仅返回 id/search_col，注释搜索也只返回目标列。新增一个无数据库测试固定查询过滤条件。

productionConstraintAndCompositeTypeSearchFindNamedCatalogObjects 验证真实命名主键/CHECK 约束，以及 CREATE TYPE AS 复合类型搜索（隐式数组类型不混入结果）。测试复用生产搜索 SQL→真实 JDBC 的桥接器，目录数据真实，仍不代表 GUI 或对象元数据缓存整体已验收。

完整回归 **854 项，841 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-column-search.json`，运行 `results/run-JCIkr0`。历史 JDBC 类 65 项中 63 通过、2 能力跳过。临时角色删除并确认计数 0；随机 schema 由用例清理。

### schema 搜索范围和列引用类型

新增 schemaSearchHonorsTheSameEnabledSchemaFilter 与 columnSearchReferenceIsTypedAsAColumn 两个入口测试。修复前红测分别显示 schema 搜索 SQL 没有 n.oid 过滤和列引用被标记为 PostgreTableBase。生产修复向 schema 查询传递已计算的 namespace 范围，保留 has_schema_privilege 检查并绑定 schema OID；列引用改为 PostgreTableColumn。

新增真库 productionSchemaSearchExecutesNamespaceIdBinding，验证生产 schema 查询能执行 mask/OID 参数绑定、返回目标 schema 类型和名称、不存在 mask 返回空。mock 测试证明过滤 SQL 与绑定，真库证明该 SQL 可执行及结果；未声称完整全局搜索 UI 已验收。

完整回归 **857 项，844 通过、13 跳过、0 失败/错误**。证据 `docs/gaussdb/test-results-20260923-schema-search.json`，运行 `results/run-mNVHZn`。临时权限角色删除后计数 0。更多搜索对象类型、跨 catalog、结果上限组合及 UI 仍需覆盖。

### 分布策略、跨节点读取与权限

- `compositeHashKeysIncludingNullPreserveRowsAndAggregation`：复合 HASH 键包含 NULL、中文和单引号，40 行准确保留；count(id)=32、sum=50.00、两组各20行；目录 locator=H，删除 NULL 键后回滚、观察连接仍40行。
- `replicatedLookupJoinDoesNotMultiplyRowsAcrossDataNodes`：复制维表2行与 HASH 事实表100行 JOIN，每组50行，不因多 DN 放大；目录 locator=R，独立查询维表仍2行。
- `roundRobinDistributionReturnsEveryRowExactlyOnce`：保留101行唯一性、和、目录断言；当前创建返回 SQLSTATE 0A000，能力跳过，不算通过。初始红测记录 `results/run-HgeN6f`。
- `ordinaryAccountCannotBypassCoordinatorWithExecuteDirect`：实际普通账号收到42501，随后连接仍可查询，通过 `results/run-xZvUBe`；不是向账号静默提权。
- `executeDirectOnActualTableNodesReconstructsTheCoordinatorRows`：从测试表 nodeoids 枚举真实 DN，逐节点查询并排序，精确等于1至100，没有丢失或重复；授权配置通过 `results/run-KIRyep`。起初普通账号尝试被明确拒绝（`results/run-2sBV8G`），因此建立两种配置分别验证。

完整回归两次各865项/850通过/15跳过/零失败错误。报告分别为 `test-results-20260923-distribution-ordinary.json` 和 `test-results-20260923-distribution-monitor.json`。两报告的权限正反用例互补，不能要求同一账号同时拥有和不拥有权限，也不能把环境跳过当通过。测试前确认专用账号 rolsystemadmin=false/rolmonitoradmin=false，授权配置临时 MONADMIN，结束 NOMONADMIN 后再次确认两个字段 false；临时 grantee 删除后计数0。随机 schema 自动清理。

以上为真实厂商 JDBC/507 分布式 SQL 与结果验证，不证明分布策略 GUI 编辑、DDL 导出后重新建表或其他内核版本。ROUNDROBIN 仍是未覆盖能力约束，不能因本机拒绝而宣布历史场景全覆盖。

### 过程/函数生产搜索与跨 schema 隔离

- `productionRoutineSearchUsesCatalogCaseCommentsAndLimit`：在随机 schema 创建大小写函数和过程，调用生产 PostgreStructureAssistant，经真实厂商 JDBC 执行目录 SQL；验证忽略大小写返回两者、区分大小写只返回过程、结果上限1、关闭注释搜索不匹配、打开后只返回带目标注释的函数，并检查引用对象类型。
- `productionRoutineSearchKeepsSameNamedFunctionsIsolatedAfterDrop`：两个随机 schema 分别创建同名函数，各自范围搜索均只有一条；删除一侧后该侧为空，另一侧仍保留一条。
- 初次 run-OvyMFb 因测试 JDBC 接口桥接缺少结果集会话上下文报错，不记录为生产缺陷。补齐会话、数据源、厂商服务扩展和真实 ResultSet 对象/数组/布尔读取后，run-IaDGzA 完整回归 **886项、871通过、15跳过、零失败错误**。
- 脱敏结果 `docs/gaussdb/test-results-20260923-routine-search.json`；随机 schema 自动清理，临时 grantee 已删除。当前覆盖无参对象搜索，不代表有参签名、重载、源码全文搜索或 GUI 搜索已验证。

### 过程源码检索与参数签名

- `productionRoutineDefinitionSearchFindsBodyWithoutNameOrCommentMatch`：关键字仅出现在函数正文，关闭源码检索结果为空；开启后命中；区分大小写时错误大小写不匹配，忽略大小写时匹配。
- run-M6KyWq 真库红测报42883：`operator does not exist: record ~~ character varying`。目录证实 GaussDB pg_get_functiondef 返回 headerlines/definition 两个输出字段，不能作为标量文本直接 LIKE。
- PostgreServerExtension 新增方言表达式扩展，GaussDB 使用标量子查询读取 definition；PostgreSQL 默认仍用 pg_catalog.pg_get_functiondef，新增 `routineDefinitionSearchRetainsPostgreSqlScalarExpression` 单元测试固定该边界。共享搜索仍保留原对象种类过滤和参数化匹配。
- `productionRoutineSearchPreservesInputAndOutputSignatureTypes`：真实创建 IN numeric/OUT varchar 过程，生产搜索返回限定 schema 的 `signature_probe(in numeric, out varchar)`。桥接器从真实 pg_type 获取类型名，再交给生产参数签名生成逻辑；不等同于完整类型缓存或重载导航验收。
- 修复后 run-0Aft27 为887/872通过/15跳过；追加签名和PG默认表达式断言后 run-oumVeM **889项、874通过、15跳过、零失败错误**。脱敏报告 `docs/gaussdb/test-results-20260923-routine-definition.json`。临时 grantee 已删除，专用账号 systemadmin/monitoradmin 均false。GUI源码检索、重载及目标金融版本仍待验。

### 视图生命周期、依赖和生产DDL

- `viewRenamePreservesDefinitionDataAndProductionSearchIdentity`：有过滤条件的视图改为带空格/大写名称；生产目录搜索旧名为空、新名为PostgreView；真实查询保留中文和过滤条件，基表两行未变。
- `viewDependencyRejectsRestrictAndCascadeRemovesOnlyDependentViews`：第一层/依赖层/独立视图共用基表；RESTRICT收到2BP01，依赖视图仍可读；CASCADE后生产搜索确认两层视图消失，独立视图和基表均保留数据。
- `invalidViewReplacementCanRollbackToSavepointWithoutLosingOriginalDefinition`：手动事务插入后设保存点，无效列替换视图收到42703；回滚到保存点保留原视图及之前插入，提交后独立连接确认一行。此项是JDBC事务验证，不代表自动UI恢复。
- 以上三项首次run-8t2HWU通过（892/877通过/15跳过）。随后生产生成器两项红测run-UOFpYF复现：字符串/注释含create时仅返回SELECT，不生成CREATE VIEW；run-4ThCib是测试监视器构造错误导致编译失败，不作为产品缺陷。
- PostgreViewManager改用首个SQL关键字判定完整DDL。`PostgreViewDdlTest`覆盖字符串create、注释create、带前导注释的完整DDL不重复包装。
- `productionViewManagerWrapsCreateLiteralAndExecutesItsGeneratedDdl`：生产生成器输出经507厂商JDBC执行，真实视图查询返回字符串create且仅一行，生产对象搜索可找到新视图。
- 最终run-QDNlnL：**896项、881通过、15跳过、零失败错误**；报告 `docs/gaussdb/test-results-20260923-view-lifecycle.json`。随机schema已自动清理，临时grantee已删除。视图编辑器、懒加载、自动补全、批量删除界面仍待验，不计为本轮通过。

### 视图列元数据刷新

`viewColumnMetadataRetainsAliasesPrecisionAndOrderAfterRename`：三列视图改变基表列顺序，使用中文、空格、大写别名。真实JDBC getColumns验证重命名后旧名无列，新名依序为中文Name/VARCHAR长度40、Amount Value/NUMERIC(20,4)、Identifier/INTEGER；删除视图后新名无列。不是仅查询结果元数据，也未冒充导航树UI验证。

run-UKD1MJ完整回归 **897项、882通过、15跳过、零失败错误**；报告 `docs/gaussdb/test-results-20260923-view-metadata.json`。随机schema自动清理，临时grantee已删除。

本次同步核对既有方法 queryTimeoutReportsCancellationAndConnectionRemainsUsable、explicitStatementCancelInterruptsOnlyItsOwnQuery、preparedBatchCountsAndRollbackMatchPersistedRows、statementCloseClosesResultButNotConnection、closedStatementAndResultRejectUseButConnectionRemainsUsable、serverWarningIsAvailableAndCanBeClearedWithoutClosingConnection，修正台账1.5/1.6仍写“待补”的过期表述。这些是既有覆盖，不计为新增测试；执行器UI/生产异常路径仍未全部覆盖。

### 递归、窗口与索引执行计划

- `realRecursivePlanPreservesWorkTableAndCteNodes`：真实递归1至5的CTE聚合，XML必须包含Recursive Union、WorkTable Scan、CTE Scan。
- `realWindowPlanPreservesSortAndWindowNodes`：真实分区排序row_number计划必须包含WindowAgg和Sort。
- `realIndexPlanPreservesIndexScanUnderDistributedParent`：专用会话关闭顺序/仅索引/位图扫描，带主键表按id查询非索引label列，实际XML必须包含Index Scan。参数仅作用于本次连接，未修改全局优化器设置。
- 三项均将真实XML交给生产PostgreExecutionPlan解析，逐节点对比原始XML的类型、成本、估算行数、子节点顺序和父引用；必须有多节点树。仅适配会话接口的mock，不伪造XML。结束检查结果集和语句关闭。
- run-LuWJmd完整回归 **900项、885通过、15跳过、零失败错误**；报告 `docs/gaussdb/test-results-20260923-plan-operators.json`。随机schema自动清理，临时grantee已删除。尚未验证向量节点、ANALYZE运行时统计与GUI计划展示，不能把这些算作通过。

### EXPLAIN ANALYZE运行时统计

`realAnalyzePlanPreservesActualRowsTimingAndLoops` 使用生产配置ANALYZE/TIMING生成计划SQL，执行专用只读递归查询。真实XML必须存在Actual-Rows、Actual-Total-Time、Actual-Loops，再交给生产解析器；逐节点验证实际行数优先于估算行数、显示文本、数值耗时、属性中的循环次数，以及已有树结构断言。未启用ANALYZE的既有计划仍验证估算行数路径。只执行测试SELECT，不执行任何业务DML计划。

run-ta6sGb完整回归 **901项、886通过、15跳过、零失败错误**；报告 `docs/gaussdb/test-results-20260923-plan-analyze.json`。临时grantee已删除。此项关闭递归查询运行时统计的解析验证，不代表分布式多DN运行时统计、BUFFERS或GUI展示已覆盖。

### 批量唯一键失败及同一语句恢复

`failedBatchRetainsSqlstateRollsBackAndCanReusePreparedStatement` 在手动事务提交id=1/1/2批次，要求BatchUpdateException及23505；更新计数必须符合JDBC取值且不能整批报告成功。独立连接确认无提交行，显式回滚后本连接和独立连接均0行。同一PreparedStatement clearBatch后插入9/恢复成功，更新计数1，提交后独立观察1行，逐列核对只有新数据。

run-nWIvlp完整回归 **902项、887通过、15跳过、零失败错误**；报告 `docs/gaussdb/test-results-20260923-batch-recovery.json`。随机schema自动清理，临时grantee删除。本项验证真实厂商JDBC，不等同于数据导入向导的自动事务处理或全部批量执行器UI路径。

### 生产批量执行器警告、逐行失败和中途取消

ExecuteBatchHistoricalTest新增四项调用真实ExecuteBatchImpl，底层DBCStatement使用mock以精确检查交互：

- `batchWarningsAreRetainedInOrderWithoutChangingUpdateCount`：两条SQLWarning原对象/顺序保留，更新数2不变，语句关闭。
- `disabledBatchUsesIndividualExecutionAndKeepsStatementReuse`：禁用batch后逐行执行三次，计数1/0/1合计2，既不addToBatch也不executeStatementBatch，最终关闭。
- `individualExecutionFailureRetainsCauseAndStopsRemainingRows`：第二行异常对象/SQLException原因保留，第三行不执行，语句关闭。
- `cancellationAfterFirstQueuedRowDoesNotQueueRemainingRows`：第一行加入后取消，后两行不加入；当前产品仍刷新已经加入的批次，更新数1并关闭。明确这是现有部分执行语义，不宣称取消自动回滚或原子取消。

run-PzH7V7首次因测试使用需非空上下文的异常构造器失败，修正测试构造方式后run-t5z0g0 **906项、891通过、15跳过、零失败错误**。报告 `docs/gaussdb/test-results-20260923-executor-lifecycle.json`；临时grantee已删除。无生产代码修改，GUI任务取消和上层事务处理仍需单独验收。

### GB18030客户端编码：通过路径与未闭环限制

- 默认连接执行SET client_encoding=GB18030后被驱动关闭（run-a4muCq）；清理逻辑曾覆盖原始异常并留下本次随机schema。已精确删除该测试schema，改进测试框架：连接已关闭时用独立连接清理同一随机schema；清理异常不覆盖原场景异常。后续检查encoded_rows残留0。
- `driverRejectsEncodingChangeWhenExplicitlyDisallowed`：显式allowEncodingChanges=false，验证08006且连接关闭。这是驱动限制的负向验证，不是GB18030成功链路。
- allowEncodingChanges=true、默认扩展协议时，插入扩展汉字返回字符转换错误（run-CTBrUe），**此组合仍失败、未闭环**。本地驱动SimpleParameterList字节码显示参数序列化调用Utils.encodeUTF8；服务器convert_from对已知GB18030字节95328236能正确得到𠀀。尚未修复厂商驱动，也未修改客户默认驱动配置。
- `simpleProtocolGb18030PreservesChineseSupplementaryCharactersAndNull`：仅此测试显式allowEncodingChanges=true和preferQueryMode=simple，确认SHOW编码GB18030，PreparedStatement写入中文银行、𠀀、引号/反斜杠、NULL；当前连接与独立默认连接逐行核对完全一致，结束恢复原编码。此明确配置路径通过，**不替代上面的扩展协议失败**。
- run-968iNy及最终命名明确后的run-UHWNQQ：908项、893通过、15跳过、零失败错误；报告 `docs/gaussdb/test-results-20260923-client-encoding.json`。绿报告仅涵盖上述成功配置/限制断言，不能声称GB18030全部支持。临时grantee已删除。
- 还需验证GB18030服务端数据库配合默认UTF8 JDBC链路、DBeaver驱动属性界面和编码提示；此组仍部分覆盖。

### GB18030数据库配合默认UTF8 JDBC

`utf8JdbcRoundTripsGb18030DatabaseWithoutChangingClientEncoding` 使用环境变量指定专用库，首先断言实际数据库名、存储编码GB18030、客户端编码UTF8；通过默认PreparedStatement写入中文银行、扩展汉字𠀀、引号/反斜杠和NULL，独立连接逐行核对值及wasNull。未启用allowEncodingChanges或simple协议，未切换client_encoding。

本地507新建空测试库dbv_hist_gb18030_20260923（ORA，owner为专用测试账号）。A标记最初被拒，改用目录实际支持的ORA后创建成功。run-YceM4c因该库尚无HBA许可失败；临时增加仅限测试库/账号/Docker网关单IP的sha256规则后，run-zu2lZo完整回归 **909项、894通过、15跳过、零失败错误**。报告 `docs/gaussdb/test-results-20260923-gb18030-database.json`。

结束已移除临时HBA条目、恢复文件原属主1000:1000和600权限并reload；临时grantee删除，新库内随机测试schema计数0。空测试库保留供后续验收；没有更改已有库编码。结论仅为默认UTF8 JDBC连接GB18030库可往返，本轮不修复主动改client_encoding后的扩展协议问题，也不代表驱动属性UI已验。
