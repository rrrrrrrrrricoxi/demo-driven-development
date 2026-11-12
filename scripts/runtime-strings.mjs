// 运行包身份在读取看板语言前校验,诊断须双语;不依赖看板或宿主元数据。
const RUNTIME_TABLES = {
  zh: {
    unreadable: '无法读取或 JSON 无效',
    name: 'name 必须是 demo-driven-development',
    version: 'version 必须是纯数字点分(勿用 -rc/-beta 后缀)',
    invalid: (path, reason) => `运行包身份无效:${path} ${reason}。请重新构建或安装完整的 DDD 运行包。`,
    genBudgetExhausted: '生成时间预算已用尽',
    genDeferred: {
      'sources-changed': '生成期间源文件变化;发布暂缓,稍后重试',
      'lock-timeout': '等待并发生成超时;本次生成暂缓,稍后重试',
      'startup-config-race': '生成启动期间并发配置变化;本次生成暂缓,请重试',
    },
    genNoIdentity: '读不到运行包自身 package.json 的有效 name/version(版本须为纯数字点分)。请保留 scripts 与 package.json 的相对位置,重新构建或安装完整的 DDD 运行包。',
  },
  en: {
    unreadable: 'unreadable or invalid JSON',
    name: 'name must be demo-driven-development',
    version: 'version must use dot-separated numbers (no -rc/-beta suffixes)',
    invalid: (path, reason) => `Invalid DDD runtime identity: ${path} ${reason}. Rebuild or reinstall the complete DDD runtime package.`,
    genBudgetExhausted: 'Generation time budget exhausted',
    genDeferred: {
      'sources-changed': 'Sources changed during generation; publication deferred, retry later',
      'lock-timeout': 'Timed out waiting for concurrent generation; generation deferred, retry later',
      'startup-config-race': 'Concurrent configuration changed while generation was starting; generation deferred, retry',
    },
    genNoIdentity: 'Cannot read a valid name/version from the runtime package\'s own package.json (version must use dot-separated numbers). Keep scripts beside package.json; rebuild or reinstall the complete DDD runtime package.',
  },
}
export const runtimeStrings = (lang) => RUNTIME_TABLES[lang === 'en' ? 'en' : 'zh']
