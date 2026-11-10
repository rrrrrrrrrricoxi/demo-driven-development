// acceptanceFeedback 怎么读(v0.17.6)—— 两种写法,一处解释。
//
//   "acceptanceFeedback": true              开,不要口令(0.17.0 起的写法,行为一个字不变)
//   "acceptanceFeedback": { "pin": "1111" } 开,新名字要这 4 位数字才进验收名册
//
// gen / 守卫 / kanban-init 都要回答同样两个问题(开没开、口令是什么),各写一遍迟早对不上。
// serve.py 那份 Python 是同一套规则的第二实现(它 import 不进来)—— 改这里记得改那边。
export const ACC_PIN_RE = /^[0-9]{4}$/

/**
 * @param {object} cfg kanban.config.json 读出来的对象
 * @returns {{on: boolean, pin: string, bad: boolean, badPin: unknown}}
 *   bad = 写成了对象但 pin 形状不对(调用方硬报错;悄悄当「没配口令」= 谁都能署名,而人以为配上了)
 */
export function accFeedback(cfg) {
  const v = (cfg || {}).acceptanceFeedback
  if (v === true) return { on: true, pin: '', bad: false, badPin: null }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const pin = v.pin
    if (typeof pin === 'string' && ACC_PIN_RE.test(pin)) return { on: true, pin, bad: false, badPin: null }
    return { on: true, pin: '', bad: true, badPin: pin === undefined ? null : pin }
  }
  // true / 对象 以外的一切(false、没写、别的字面量)照 0.17.5 当没开:那几种今天就是静默关,
  // 改成报错会把「本来好好的板」在升级时打死
  return { on: false, pin: '', bad: false, badPin: null }
}
