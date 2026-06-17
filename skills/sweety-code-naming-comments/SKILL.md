---
name: sweety-code-naming-comments
description: Cross-stack code naming and comment discipline for software development. Use when Codex writes, reviews, refactors, or explains code and must choose clear identifiers, rename variables/functions/classes/constants/files, add or remove comments, review naming quality, or enforce readable-code conventions in any programming language. Focus only on naming and comments, not broader formatting, control-flow, architecture, or frontend-specific rules.
---

# 代码命名与注释规范

这个 skill 用于在写代码、改代码和做代码审查时，让命名和注释降低误读成本。核心材料来自掘金文章《前端代码可读性实战指南百科全书》，但这里只保留“命名”和“注释”原则，并抽象为不区分技术栈的规则。

## 偏好设置 (EXTEND.md)

先检查 EXTEND.md，优先级如下：

```bash
test -f .sweety-skills/sweety-code-naming-comments/EXTEND.md && echo "project"
test -f "${XDG_CONFIG_HOME:-$HOME/.config}/sweety-skills/sweety-code-naming-comments/EXTEND.md" && echo "xdg"
test -f "$HOME/.sweety-skills/sweety-code-naming-comments/EXTEND.md" && echo "user"
```

| 路径 | 位置 |
|------|------|
| `.sweety-skills/sweety-code-naming-comments/EXTEND.md` | 项目目录 |
| `$XDG_CONFIG_HOME/sweety-skills/sweety-code-naming-comments/EXTEND.md` | XDG 配置目录 |
| `$HOME/.sweety-skills/sweety-code-naming-comments/EXTEND.md` | 用户目录 |

| 结果 | 操作 |
|------|------|
| 找到 | 读取并应用项目或用户对命名语言、缩写、注释密度、公开 API 文档格式的偏好 |
| 未找到 | 使用本文默认规则 |

## 工作流

### 1. 限定任务边界

只处理命名和注释：

- 命名：变量、参数、函数、方法、类、类型、接口、常量、枚举、文件、目录、模块、配置项、数据库字段、API 字段。
- 注释：行内注释、块注释、文档注释、TODO/FIXME/HACK、公开 API 说明、迁移说明、兼容性说明。
- 不处理：格式化风格、控制流重构、架构拆分、性能优化、前端框架约定，除非它们直接影响命名或注释。

### 2. 先问名字能不能解决问题

优先改名字，其次才加注释。坏名字加好注释仍然会制造维护成本。

在添加注释前先判断：

- 能不能用更具体的名字表达这件事？
- 能不能用有语义的常量、枚举、类型或字段名替代字面量？
- 能不能拆出一个命名良好的中间变量、函数或对象，减少解释需求？
- 如果删掉注释，读者是否仍能从名字和结构里快速理解？

只有当名字无法承载“为什么、边界、取舍、陷阱、外部约束”时，才写注释。

## 命名规则

### 1. 名字必须承载业务含义

避免在非临时场景使用空泛名字：`data`、`info`、`item`、`obj`、`arr`、`tmp`、`flag`、`handle`、`process`、`result`。

允许短名的场景必须足够小：

- 交换变量、极短循环、局部闭包中可以用 `tmp`、`i`、`j`、`x`。
- 嵌套循环、跨多行逻辑、跨函数传递时，必须补足语义，例如 `rowIndex`、`columnIndex`、`sourceUser`、`targetUser`。

### 2. 用具体名词替代抽象词

名字要回答“这是什么”“属于谁”“处在什么状态”“用来做什么”。

- `status` 不如 `paymentStatus`、`orderStatus`。
- `config` 不如 `retryPolicy`、`databaseConnectionOptions`。
- `list` 不如 `publishedArticles`、`failedJobs`。
- `value` 不如 `discountRate`、`tokenExpiresAt`。

如果一个名字需要旁边注释解释它是什么，优先重命名。

### 3. 行为用动词开头

函数、方法、命令和事件处理器名称要表达动作和对象，必要时表达来源、条件或结果。

常用动词语义：

| 动词 | 适用含义 |
|------|----------|
| `get` | 从已有上下文直接取得值，不暗示网络、磁盘或昂贵计算 |
| `fetch` / `load` / `query` | 从外部系统、存储、网络或数据库获取数据 |
| `create` / `build` / `generate` / `compose` | 生成新对象、新内容或新结构 |
| `set` / `update` / `save` | 修改或持久化已有状态 |
| `validate` | 检查格式、约束或输入是否合法 |
| `can` / `has` / `is` / `should` | 返回布尔判断 |

避免只写 `run`、`doIt`、`handle`、`process`、`check`。如果必须使用，补足对象和结果，例如 `validateEmailFormat`、`processRefundWebhook`、`handleExpiredSession`。

### 4. 布尔名必须像判断句

布尔变量和布尔返回函数优先使用 `is`、`has`、`can`、`should`、`was`、`needs` 等前缀，或使用所在语言/团队已接受的等价表达。

- `admin` -> `isAdmin`
- `redirected` -> `hasRedirected`
- `retry` -> `shouldRetry`
- `permission` -> `canEditInvoice`

不要让布尔名像名词、动作或不完整状态。

### 5. 把单位、格式、方向和边界写进名字

当误用成本高时，把额外信息放进名字，而不是藏在注释里。

| 信息类型 | 命名示例 |
|----------|----------|
| 时间单位 | `delayMs`、`timeoutSeconds`、`expiresAt` |
| 数据大小 | `maxBytes`、`cacheSizeMb` |
| 编码/格式 | `htmlUtf8`、`urlEncodedPayload` |
| 安全状态 | `plaintextPassword`、`hashedPassword`、`escapedComment` |
| 范围边界 | `minPrice`、`maxRetries`、`firstIndex`、`lastIndex`、`startOffset`、`endOffset` |
| 方向/坐标 | `clockwiseDegrees`、`sourcePath`、`targetPath` |

边界命名要成对一致：闭区间常用 `first/last`，半开区间常用 `start/end`，上下限用 `min/max`。

### 6. 用语义常量替代魔法值

逻辑中不要直接散落难懂字面量。把数字、状态码、模式字符串、特殊 ID、正则、开关值命名为常量、枚举、类型成员或配置项。

- `30` -> `maxLoginAttempts`
- `"000000"` -> `successCode`
- `"12"` -> `singleImageMode`
- `86400` -> `secondsPerDay`

使用当前技术栈原生表达方式，不强制使用某一种语言的枚举或常量语法。

### 7. 名字长度随作用域变化

- 作用域越小，名字可以越短。
- 作用域越大、生命周期越长、调用者越多，名字必须越完整。
- 对象属性不要重复对象名：`user.userName` 通常不如 `user.name`。
- 删除没有信息量的词：`convertToString` 通常不如 `toString`，除非当前上下文需要区分多种转换。

### 8. 保持团队范式一致

遵守当前仓库、语言和框架已有命名风格。不要为了通用规则破坏局部一致性。

检查这些问题：

- 拼写错误。
- 中英文混用，除非该词已经是团队或行业约定。
- 生造缩写、拼音首字母、随机编号、无意义后缀。
- 单复数不分。
- 正反义词不成对，例如 `show/close` 混作一组。
- 同一概念在不同文件里用多套名字。
- 名字暗示无副作用，但实际会修改状态、发请求、落库或删除数据。

## 注释规则

### 1. 不翻译代码

删除只复述代码的注释。没有提供额外信息的注释会增加噪音，并且容易在代码变化后失真。

坏注释通常是：

- 把代码逐字翻译成自然语言。
- 解释读者能快速从名字和结构中推断出的事实。
- 用注释补救坏名字。
- 长期保留过期背景、废弃方案或无来源猜测。

### 2. 注释解释高层意图

好注释要让读者知道作者知道而代码本身说不出的东西：

- 为什么这样做，而不是更直接的写法。
- 业务规则、合规要求、协议约束、兼容性要求。
- 不变量、前置条件、后置条件、失败模式。
- 性能、安全、并发、事务、幂等、时区、编码、精度等隐性约束。
- 外部系统的异常行为或历史包袱。

### 3. 标出陷阱和未完成事项

遇到 hack、临时兼容、无法立即修复的缺陷、危险边界、容易误用的 API，必须写清楚。

使用可检索标记时，标记后保留一个空格：

- `TODO: `
- `FIXME: `
- `HACK: `
- `NOTE: `
- `WARNING: `

注释要说明触发条件、原因、后续处理方向；不要只写“以后优化”“临时处理”。

### 4. 给技巧和反直觉写法补背景

当代码使用语言技巧、社区惯例、性能技巧、兼容写法或看似绕路但有必要的处理时，写注释解释它解决的实际问题。

如果一个实现会让读者问“为什么不直接这样写”，注释应该回答这个问题。

### 5. 注释靠近被解释的代码

把注释放在最小相关范围附近：

- 公共 API：写在 API、类型、方法或字段声明处。
- 复杂分支：写在分支入口处。
- 特殊常量：写在常量定义处。
- 临时限制：写在限制发生处，并标记修复条件。

不要把重要上下文只写在远处文档里，也不要在每一行重复同一个背景。

## 代码编辑输出规则

当用户要求直接改代码：

- 先按仓库现有风格命名，不强行引入新的大小写、缩写或注释格式。
- 改名要同步调用点、测试、文档和配置引用。
- 添加注释要少而准，优先放在高风险、跨边界、反直觉、长期维护成本高的位置。
- 删除无效注释时，不要删除仍有审计、迁移或业务来源价值的上下文。
- 最终说明只列命名和注释层面的关键变化。

当用户要求代码审查：

- 优先指出会造成误读、误用、调用错误或维护成本的命名/注释问题。
- 给出替代名字或替代注释，不只说“命名不清晰”。
- 如果问题其实属于架构、控制流或格式，不要强行塞进本 skill；只在它影响命名或注释时提及。

## Extension Support

Custom configurations via EXTEND.md. See **偏好设置 (EXTEND.md)** for paths and supported options.
