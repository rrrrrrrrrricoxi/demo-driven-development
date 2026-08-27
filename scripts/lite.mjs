// 卡正文的轻 markdown(v0.13.0,config.richText)。纯函数、顶层无副作用,gen 与测试各自 import。
//
// 认(定稿 §3.1):**粗体** / `代码` / 空行分段 / 单换行 → <br> / 行首 "- "|"* " → 无序列表 /
// 行首 "1." → 有序列表 / 行首 ①…⑩ → 有序列表(圈号保留作标号)/ 【…】开头的段 = 时间戳小节
// (包一层 .tsec,靠 CSS 在段前压一条细线;用容器不用 <hr>,首段的线才好用 :first-child 去掉)。
// 不认:标题、表格、链接语法(链接走卡的 links[])、HTML —— 卡正文是会话写给会话看的查证记录,
// 认全套 markdown 只是把「反引号里的 <script>」变成攻击面,换不来什么。
//
// 安全:先 esc() 再认标记,esc 与 gen 同口径(& < > ")。代码片段先抽成 NUL 占位符再回填,
// 回填走函数式 replace(replacement 串里的 $& / $' 不会被二次展开);输入里的 NUL 先剔掉,
// 免得人写的正文伪造出占位符去顶别的代码片段。

const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const NUL = '\u0000'

// 行内标记:代码优先(反引号里的 ** 不算粗体),再粗体
function inline(s) {
  const code = []
  let t = s.replace(/`([^`]+)`/g, (_, x) => {
    code.push(x)
    return NUL + (code.length - 1) + NUL
  })
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + code[Number(i)] + '</code>')
}

/** 一段长文本 → HTML(已转义)。空文本 → 空串 */
export function lite(md) {
  const blocks = esc(String(md ?? '').replace(/\u0000/g, '')).split(/\n{2,}/)
  let out = ''
  for (const raw of blocks) {
    const block = raw.replace(/^\n+|\n+$/g, '')
    if (!block.trim()) continue
    const isSec = /^\s*【/.test(block)
    let html = ''
    let run = null
    let buf = []
    const flush = () => {
      if (buf.length) {
        if (run === 'text') html += '<p>' + buf.join('<br>') + '</p>'
        else if (run === 'ul') html += '<ul>' + buf.join('') + '</ul>'
        else if (run === 'ol') html += '<ol>' + buf.join('') + '</ol>'
        else if (run === 'circ') html += '<ol class="circ">' + buf.join('') + '</ol>'
      }
      buf = []
    }
    for (const line of block.split('\n')) {
      const s = line.replace(/^\s+/, '') // 缩进的续行按同级处理:卡正文里的两格缩进是排版不是嵌套
      if (!s) continue
      let m
      if ((m = s.match(/^[-*]\s+(.*)$/))) {
        if (run !== 'ul') { flush(); run = 'ul' }
        buf.push('<li>' + inline(m[1]) + '</li>')
      } else if ((m = s.match(/^(\d+)[.)]\s+(.*)$/))) {
        if (run !== 'ol') { flush(); run = 'ol' }
        buf.push('<li value="' + m[1] + '">' + inline(m[2]) + '</li>') // 保原编号:正文常从 3. 续写
      } else if ((m = s.match(/^([①-⑩])\s*(.*)$/))) {
        if (run !== 'circ') { flush(); run = 'circ' }
        buf.push('<li><span class="mk">' + m[1] + '</span>' + inline(m[2]) + '</li>')
      } else {
        if (run !== 'text') { flush(); run = 'text' }
        buf.push(inline(s))
      }
    }
    flush()
    out += isSec ? '<div class="tsec">' + html + '</div>' : html
  }
  return out
}

/**
 * 折叠预览(定稿 §3.2):从第一段起按段落边界累到 ≤ n 字。
 * → { head, rest };rest = 原文字符数 − 预览字符数,0 表示不必折叠(全文即预览)。
 *
 * 「≤ n」对第一段同样作数:首段自己就超 n 时没有可用的段落边界,与「整篇一段」是同一种情形,
 * 一律不拆,留给 gen 的高度折叠(clampScan)。否则同样长度的两个字段会一个折成两行、
 * 另一个整篇铺开 —— 因为 gen 见到预览/全文两份就把高度折叠让掉了。
 */
export function litePreview(md, n = 400) {
  const src = String(md ?? '')
  const paras = src.split(/\n{2,}/).filter((p) => p.trim())
  const take = []
  let len = 0
  for (const p of paras) {
    if (take.length && len + p.length > n) break
    take.push(p)
    len += p.length
    if (len >= n) break
  }
  // 全取了 = 没什么可藏的(段分隔归一化会让 head 比原文短几个字符,别为这几个字生出一个空折叠)
  if (!take.length || take.length === paras.length) return { head: src, rest: 0 }
  const head = take.join('\n\n')
  if (head.length > n) return { head: src, rest: 0 } // 首段自己就超了:没有 ≤ n 的段落边界可切
  return { head, rest: Math.max(0, src.length - head.length) }
}
