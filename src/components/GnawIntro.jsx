import { useEffect, useRef, useState } from 'react'
import { gnawEat } from '../lib/study.js'

// 오래 쉬었다 들어오면: 캐릭터들이 단어 글자를 갉아먹는 장면 → '복습하고 되찾기'
// 실제 단어장은 바꾸지 않는 연출. 미리보기(artifact)와 같은 움직임.
const COLORS = ['#E9954B', '#8DAE78', '#7E9AD0', '#E3B23C', '#E08A7B', '#C98BB9']
const SHAPES = [
  [[50, 52, 30], [30, 40, 18], [70, 40, 18], [32, 66, 18], [68, 66, 18]],
  [[50, 55, 32], [50, 30, 20], [28, 45, 16], [72, 45, 16]],
  [[50, 54, 31], [36, 32, 17], [64, 32, 17], [78, 58, 12], [22, 58, 12]],
]
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export default function GnawIntro({ name, days, words, onRescue, onClose }) {
  const bookRef = useRef(null)
  const [stage, setStage] = useState('eat') // eat | ask | saving | saved
  const runRef = useRef(0)

  useEffect(() => {
    const book = bookRef.current
    if (!book) return
    const id = ++runRef.current
    const alive = () => id === runRef.current
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    book.innerHTML = ''
    const items = words.map((w, i) => {
      const row = document.createElement('div'); row.className = 'gn-row'
      // 단어·뜻은 textContent로만 넣음(HTML로 해석하지 않게)
      const wordEl = document.createElement('div'); wordEl.className = 'gn-word'
      const letters = [...w.word].map((ch) => { const s = document.createElement('span'); s.className = 'gn-l'; s.textContent = ch; wordEl.appendChild(s); return s })
      const mean = document.createElement('div'); mean.className = 'gn-mean'; mean.textContent = w.meaning || ''
      const box = document.createElement('div'); box.className = 'gn-w'; box.append(wordEl, mean)
      const mark = document.createElement('span'); mark.className = 'gn-mark'; mark.textContent = '○'
      row.append(box, mark)
      const cr = document.createElement('div'); cr.className = 'gn-crit'
      const c = COLORS[(i * 2 + 1) % COLORS.length]
      cr.innerHTML = `<div class="gn-say"></div><svg viewBox="0 0 100 100" aria-hidden="true"><g class="gn-body"><g fill="${esc(c)}">${SHAPES[i % 3].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g><circle cx="36" cy="40" r="9" fill="#fff"/><circle cx="58" cy="40" r="9" fill="#fff"/><circle class="gn-pu" cx="33" cy="41" r="4.5" fill="#2E2E3A"/><circle class="gn-pu" cx="55" cy="41" r="4.5" fill="#2E2E3A"/><ellipse class="gn-m" cx="34" cy="63" rx="10" ry="2" fill="#2E2E3A"/><rect class="gn-t" x="29" y="60" width="4.6" height="6" rx="1.3" fill="#fff"/><rect class="gn-t" x="34.4" y="60" width="4.6" height="6" rx="1.3" fill="#fff"/></g></svg>`
      row.appendChild(cr)
      book.appendChild(row)
      return { w, row, cr, box, wordEl, letters, mean, mark, color: c, eat: gnawEat(w.word) }
    })
    const mouth = (cr, open) => { cr.querySelector('.gn-m').setAttribute('ry', open ? 9 : 2); cr.querySelectorAll('.gn-t').forEach((t) => t.setAttribute('y', open ? 54 : 60)) }
    const look = (cr, dir) => { const [a, b] = cr.querySelectorAll('.gn-pu'); const dx = dir === 'left' ? -3 : dir === 'front' ? 0 : 3, dy = dir === 'front' ? 2 : 1; a.setAttribute('cx', 36 + dx); a.setAttribute('cy', 40 + dy); b.setAttribute('cx', 58 + dx); b.setAttribute('cy', 40 + dy) }
    const say = (cr, t) => { const s = cr.querySelector('.gn-say'); if (t) s.textContent = t; s.classList.toggle('on', !!t) }
    const placeAt = (it, idx, instant) => {
      const L = it.letters[idx]
      const x = L.offsetLeft + L.offsetWidth + it.wordEl.offsetLeft + it.box.offsetLeft - 14
      it.cr.style.transition = instant ? 'none' : 'transform .22s ease-out'
      it.cr.style.transform = `translateX(${x}px)`
    }
    const bite = (L, st) => {
      const r = st === 1 ? 30 : 62, x = st === 1 ? 108 : 96
      const m = `radial-gradient(circle at ${x}% 30%, transparent ${r}%, #000 ${r + 1}%), radial-gradient(circle at ${x}% 72%, transparent ${r}%, #000 ${r + 1}%)`
      L.style.webkitMaskImage = m; L.style.maskImage = m; L.style.webkitMaskComposite = 'source-in'; L.style.maskComposite = 'intersect'
    }
    const crumbs = (it, L, n) => {
      const rb = it.row.getBoundingClientRect(), lb = L.getBoundingClientRect()
      for (let k = 0; k < n; k++) {
        const c = document.createElement('div'); c.className = 'gn-crumb'
        c.style.left = (lb.right - rb.left - 6 + Math.random() * 6) + 'px'
        c.style.top = (lb.top - rb.top + lb.height * (0.3 + Math.random() * 0.5)) + 'px'
        if (Math.random() < 0.4) c.style.background = it.color
        it.row.appendChild(c)
        if (Math.random() < 0.35) {
          c.classList.add('stay')
          const dx = Math.random() * 16 - 4, dy = lb.height * 0.75 + Math.random() * 10
          c.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx * 0.5}px,-8px) rotate(80deg)`, offset: 0.35 }, { transform: `translate(${dx}px,${dy}px) rotate(${120 + Math.random() * 180}deg)` }], { duration: 650, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'forwards' })
          continue
        }
        const dx = (Math.random() * 30 + 6) * (Math.random() < 0.3 ? -1 : 1), dy = 40 + Math.random() * 50
        c.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${dx * 0.5}px,-${8 + Math.random() * 10}px) rotate(90deg)`, opacity: 1, offset: 0.3 }, { transform: `translate(${dx}px,${dy}px) rotate(${200 + Math.random() * 200}deg)`, opacity: 0 }], { duration: 800, easing: 'cubic-bezier(.3,.1,.6,1)' }).onfinish = () => c.remove()
      }
    }
    const chomp = async (it, L, st, n) => {
      mouth(it.cr, true); await sleep(90)
      it.cr.classList.remove('chomp'); void it.cr.offsetWidth; it.cr.classList.add('chomp')
      mouth(it.cr, false); bite(L, st); crumbs(it, L, n); await sleep(150)
    }
    const eatRow = async (it) => {
      const last = it.letters.length - 1
      for (let k = 0; k < it.eat; k++) {
        if (!alive()) return
        const L = it.letters[last - k]
        placeAt(it, last - k); await sleep(200)
        await chomp(it, L, 1, 3); if (!alive()) return
        await chomp(it, L, 2, 5)
        L.style.opacity = '0'
        it.mean.style.opacity = String(Math.max(0.35, 1 - 0.18 * (k + 1))); it.mean.style.filter = `blur(${0.5 * (k + 1)}px)`
      }
      const nx = it.letters[last - it.eat]
      if (nx && alive()) { placeAt(it, last - it.eat); await sleep(200); await chomp(it, nx, 1, 4) }
      it.mark.textContent = '△'; it.mark.classList.add('bad')
    }
    ;(async () => {
      await sleep(60)
      if (reduce) {
        for (const it of items) {
          const last = it.letters.length - 1
          for (let k = 0; k < it.eat; k++) it.letters[last - k].style.opacity = '0'
          const nx = it.letters[last - it.eat]; if (nx) bite(nx, 1)
          placeAt(it, last - it.eat, true); look(it.cr, 'front'); it.mean.style.opacity = '.45'; it.mark.textContent = '△'; it.mark.classList.add('bad')
        }
        setStage('ask'); return
      }
      items.forEach((it, i) => setTimeout(() => { if (alive()) { placeAt(it, it.letters.length - 1); look(it.cr, 'left') } }, 250 + i * 180))
      await sleep(1150); if (!alive()) return
      items.forEach((it) => say(it.cr, '냠'))
      await Promise.all(items.map((it, i) => sleep(i * 140).then(() => eatRow(it))))
      if (!alive()) return
      items.forEach((it) => { say(it.cr, ''); look(it.cr, 'front') })
      await sleep(250); const mid = items[Math.min(1, items.length - 1)]; say(mid.cr, '꺽!')
      await sleep(500); say(mid.cr, '')
      if (alive()) setStage('ask')
    })()
    book.__rescue = async () => {
      runRef.current++
      book.querySelectorAll('.gn-crumb.stay').forEach((c) => { c.style.opacity = '0'; setTimeout(() => c.remove(), 450) })
      items.forEach((it) => { look(it.cr, 'right'); say(it.cr, '앗!'); it.cr.classList.remove('hop'); void it.cr.offsetWidth; it.cr.classList.add('hop') })
      await sleep(reduce ? 0 : 420)
      items.forEach((it, i) => setTimeout(() => { say(it.cr, ''); it.cr.style.transition = 'transform .45s ease-in'; it.cr.style.transform = 'translateX(480px)' }, i * 90))
      for (const it of items) {
        it.letters.filter((L) => L.style.opacity !== '0' && L.style.maskImage).forEach((L) => setTimeout(() => { L.style.webkitMaskImage = ''; L.style.maskImage = '' }, 200))
        const gone = it.letters.filter((L) => L.style.opacity === '0')
        gone.forEach((L, k) => setTimeout(() => {
          L.style.webkitMaskImage = ''; L.style.maskImage = ''; L.style.opacity = '1'
          if (!reduce) L.animate([{ transform: 'scale(.2) translateY(6px)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 380, easing: 'ease-out' })
        }, 250 + k * 110))
        setTimeout(() => { it.mean.style.opacity = '1'; it.mean.style.filter = 'none'; it.mark.textContent = '○'; it.mark.classList.remove('bad') }, 300 + gone.length * 110)
      }
      await sleep(reduce ? 300 : 1300)
    }
    return () => { runRef.current++ }
  }, [words])

  async function rescue() {
    setStage('saving')
    await bookRef.current?.__rescue?.()
    setStage('saved')
    setTimeout(onRescue, 700)
  }

  const dayText = days >= 2 ? `${days}일 쉬는 사이` : '쉬는 사이'
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-cream" role="dialog" aria-modal="true" aria-label="쉬는 사이 단어를 갉아먹고 있었어요">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-4 pb-10 pt-[max(env(safe-area-inset-top),20px)]">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-jua text-xl text-slate-deep">{days >= 2 ? `${days}일 만이에요, ${name}!` : `다시 왔네요, ${name}!`}</p>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-sm text-soft active:bg-paper">건너뛰기</button>
        </div>
        <div className="gn-book" ref={bookRef} />
        <div className={`gn-sheet ${stage !== 'eat' ? 'on' : ''}`}>
          {stage === 'saved' ? (
            <><h2 className="gn-h">다 지켰어요! 🎉</h2><p className="gn-p">이제 복습하러 가요.</p></>
          ) : stage === 'saving' ? (
            <><h2 className="gn-h">좋아요, 단어를 되찾는 중!</h2><p className="gn-p">이제 복습으로 넘어가요.</p></>
          ) : (
            <>
              <h2 className="gn-h">{dayText}, 단어를 갉아먹고 있었어요!</h2>
              <p className="gn-p">조금씩 잊혀 가는 단어들이에요. 지금 복습하면 다시 되찾을 수 있어요.</p>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={onClose}>나중에</button>
                <button className="btn-main flex-1" onClick={rescue} disabled={stage !== 'ask'}>복습하고 되찾기</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
