# 合订术:把多文件 demo 归并成单页

多轮选型走到后面,旧轮常留下「一方案一文件」的多个 demo。按形制规矩(ddd-workflow SKILL 第 1 步),
新一轮应当直接写成单页;旧轮则用本配方**归档成一张合订页**:同源 iframe 组装,内页交互零损失,
卡片上只挂合订页一条链接。

## 配方

合订页是一个普通 demo(放 `demos/`,挂在卡的 `links` 里并标注轮次),骨架三件事:
每个方案一节(`h2` + 一段取舍注记 + 一个 iframe),左侧固定目录,一段组装脚本。

```html
<h2 id="sa">A · 方案甲</h2>
<iframe class="demoframe" data-src="round1-a.html" title="A" loading="lazy"></iframe>
<!-- ……每方案一节…… -->

<script>
// 同源内嵌:载入后 ①剥掉内页的返回栏(合订页自己有守卫注入的那条,内页各带一条太吵)
// ②按内容撑高,免内滚动条
document.querySelectorAll('iframe.demoframe').forEach(function (f) {
  f.src = f.dataset.src
  f.addEventListener('load', function () {
    try {
      var d = f.contentDocument
      var bn = d.getElementById('ddd-backnav'); if (bn) bn.remove()
      var bs = d.getElementById('ddd-backnav-style'); if (bs) bs.remove()
      d.body.style.paddingTop = '8px'
      function fit() { f.style.height = (d.documentElement.scrollHeight + 24) + 'px' }
      fit(); setTimeout(fit, 300) // 字体/布局安定后再量一次
      new MutationObserver(fit).observe(d.body, { subtree: true, childList: true, attributes: true })
    } catch (e) { f.style.height = '900px' } // 兜底:量不到就给个够用的定高
  })
})
</script>
```

要点逐条:

- **`data-src` + `loading="lazy"`,脚本里才赋 `src`**——页面先立骨架,内容按需载入。
- **剥内页返回栏**:守卫会给每个 demo(含合订的子页)注入 `#ddd-backnav`;合订页顶部已有自己那条,
  内页的要在 `onload` 后从 `contentDocument` 移除,并把 `body.paddingTop` 归零(注入样式撑了 44px)。
- **高度自适应**:`documentElement.scrollHeight + 24` 撑高;载入后 300ms 再量一次(字体/布局安定),
  并挂 `MutationObserver`(内页交互会改高)。
- **try/catch 兜底**:任何一步失败(极端场景拿不到 `contentDocument`)给 900px 定高,页面不烂。

## 左侧目录(合订页与单页多方案通用)

```css
#toc { position: fixed; left: 20px; top: 76px; width: 150px; }
```

```js
function spy() {
  var y = window.scrollY + 120, cur = 0
  secs.forEach(function (s, i) { if (s.offsetTop <= y) cur = i })
  // 兜底:页底最后一节的 offsetTop 可能永远够不到判定线,滚到底就点亮末项
  if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) cur = secs.length - 1
  tocLinks.forEach(function (a, i) { a.classList.toggle('on', i === cur) })
}
window.addEventListener('scroll', spy); spy()
```

两个实测坑都在上面:目录 `top` 要给守卫注入的 44px 返回栏让位(76px 起步);
末项高亮要加「滚到底」兜底。正文侧记得给目录留出 `padding-left`,
小节标题加 `scroll-margin-top`(56px 上下)免得跳转后被返回栏压住。

## 守卫豁免(v0.10.0)

孤儿审计认「合订引用」:**被已挂卡 demo 用 iframe(`data-src`/`src`)内嵌的同目录子页,不算孤儿**,
豁免逐层传递(合订页可再被合订)。所以子页不必在卡上挂「已并入合订」的占位链接;
存量占位链接可删。子页仍需真实存在于 `demos/` 且被合订页引用——引用断了(改名/删文件)守卫会照常报。
