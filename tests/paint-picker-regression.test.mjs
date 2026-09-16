import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { build } from 'esbuild'
import postcss from 'postcss'
import tailwindcss from '@tailwindcss/postcss'
import { chromium, devices } from 'playwright'

// Exercise the real picker components; isolate persistence and analytics from user data.
test('palette filters, cancellation, request stability, and mobile scrolling', async () => {
  const bundle = await build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import Palette from './app/projects/[id]/project-palette-starter';
      import Stage from './app/units/[id]/components/stage-paint-picker';
      import unitStyles from './app/units/[id]/unit-v3-silver.module.css';
      createRoot(document.getElementById('root')).render(<React.StrictMode>
        <main className={unitStyles.unitSilver}>
        <div style={{transform:'translateZ(0)',height:180,maxWidth:400,overflow:'hidden'}}>
          <Palette unitId="fixture-unit" />
          <Stage unitId="fixture-unit" progressStepId="fixture-stage" />
        </div>
        <div style={{height:1800}}>Scrollable unit content</div>
        </main>
      </React.StrictMode>);
    `, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, outfile: 'fixture.js', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    loader: { '.css': 'local-css' },
    plugins: [{ name: 'isolate-server-boundaries', setup(builder) {
      builder.onResolve({filter: /\/actions$/}, args => ({path: args.path, namespace: 'actions'}))
      builder.onLoad({filter: /.*/, namespace: 'actions'}, () => ({contents: `
        export async function setUnitPaletteSlot(...args) { window.savedSlot = args; }
        export async function setProjectPaletteSlot(...args) { window.savedSlot = args; }
        export async function addPaintToStage() { throw new Error('Could not save stage paint'); }
      `}))
      builder.onResolve({filter: /analytics\/client$/}, () => ({path: 'analytics', namespace: 'mock'}))
      builder.onResolve({filter: /^next\/image$/}, () => ({path: 'image', namespace: 'mock'}))
      builder.onLoad({filter: /.*/, namespace: 'mock'}, args => ({resolveDir: process.cwd(), contents: args.path === 'image'
        ? `import React from 'react'; export default function Image(props) { return React.createElement('img', props) }`
        : 'export function capturePostHog() {}'}))
    }}],
  })
  const css = await postcss([tailwindcss()]).process(await readFile('app/globals.css','utf8'), {from:'app/globals.css'})
  const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text
  const moduleCss = bundle.outputFiles.find(file => file.path.endsWith('.css'))?.text ?? ''
  const server = createServer(async (req,res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname
    if (/^\/og-v3\/materials\/[a-z0-9-]+\.(png|webp)$/.test(pathname)) {
      res.setHeader('Content-Type', pathname.endsWith('.webp') ? 'image/webp' : 'image/png')
      res.end(await readFile(`public${pathname}`))
      return
    }
    res.setHeader('Content-Type','text/html')
    res.end(`<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}\n${moduleCss}</style><body><div id="root"></div><script>${js.replaceAll('</script','<\\/script')}</script></body></html>`)
  })
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve))
  const browser = await chromium.launch({headless:true})
  try {
    for (const mobile of [false,true]) {
      const context = await browser.newContext(mobile ? devices['Pixel 7'] : {viewport:{width:1280,height:900}})
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      let requests = 0
      const ownershipUpdates = []
      await page.route('**/api/vault/ownership', async route => {
        ownershipUpdates.push(route.request().postDataJSON())
        await route.fulfill({json:{success:true}})
      })
      await page.route('**/api/theme-paint-search?**', async route => {
        requests++
        await route.fulfill({json:{paints:Array.from({length:70},(_,i)=>({
          id:String(i),source:'catalog',name:`Blue ${i}`,brand:'Test Brand',line:'Test Line',
          hex:'#123456',swatch_image_url:null,is_owned:true,
        })),filters:{brands:['Test Brand'],lines:['Test Line']}}})
      })
      await page.goto(`http://127.0.0.1:${server.address().port}`)
      await page.getByRole('button',{name:'Choose palette color 1',exact:true}).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByText('Blue 0',{exact:true}).waitFor()
      const filtersButton = dialog.getByRole('button', {name: /^Filters/})
      assert.equal(await filtersButton.getAttribute('aria-expanded'),'false')
      assert.equal(await dialog.getByRole('combobox').count(),0)
      if (mobile) await page.screenshot({path:'.tmp/launch-picker-mobile-collapsed.png'})
      await filtersButton.click()
      for (const name of ['Brand','Line','Ownership']) {
        assert.equal(await dialog.getByRole('combobox',{name,exact:true}).isVisible(),true)
      }
      assert.equal(await dialog.getByRole('combobox').count(),3)
      await page.waitForTimeout(1100)
      assert.equal(requests,1,'idle picker must not issue repeated searches')
      await dialog.getByRole('button',{name:'Add to wishlist',exact:true}).first().click()
      await dialog.getByRole('button',{name:'Remove from wishlist',exact:true}).first().waitFor()
      assert.deepEqual(ownershipUpdates,[{paintId:'0',action:'wishlist',currentValue:false}])
      assert.equal(await dialog.count(),1,'wishlist updates do not select a palette paint')
      await dialog.getByRole('combobox',{name:'Brand',exact:true}).selectOption('Test Brand')
      await page.waitForTimeout(500)
      assert.equal(requests,2,'one request per filter change')
      if (mobile) await page.screenshot({path:'.tmp/launch-picker-mobile.png'})
      await filtersButton.click()
      assert.equal(await dialog.getByRole('combobox').count(),0)
      assert.match(await filtersButton.innerText(),/Filters \(1\)/)
      await filtersButton.click()
      assert.equal(await dialog.getByRole('combobox',{name:'Brand',exact:true}).inputValue(),'Test Brand')
      if (mobile) {
        const scroller=dialog.locator('.mobile-scroll')
        const box=await scroller.boundingBox()
        const session=await context.newCDPSession(page)
        const x=box.x+box.width/2, y=box.y+Math.min(box.height-20,220)
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
        for(let step=1;step<=6;step++) {
          await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*24}]})
        }
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
        await page.waitForTimeout(200)
        assert.ok(await scroller.evaluate(el=>el.scrollTop)>0,'paint results scroll by touch')
      }
      await page.getByRole('button',{name:'Close paint picker'}).click()
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'')
      assert.equal(await dialog.count(),0)
      for(let i=0;i<3;i++) {
        await page.getByRole('button',{name:'Choose palette color 1',exact:true}).click()
        await page.keyboard.press('Escape')
        assert.equal(await dialog.count(),0)
      }
      await page.getByRole('button',{name:'Choose palette color 2',exact:true}).click()
      await dialog.getByText('Blue 0',{exact:true}).click()
      await page.waitForFunction(()=>window.savedSlot)
      assert.deepEqual(await page.evaluate(()=>window.savedSlot),['fixture-unit',1,'catalog','0'])
      assert.equal(await dialog.count(),0)
      await page.getByRole('button',{name:'Pick from Paint Library'}).click()
      await dialog.getByText('Blue 0',{exact:true}).click()
      await page.getByRole('alert').waitFor()
      assert.match(await page.getByRole('alert').innerText(),/Could not save stage paint/)
      await page.getByRole('button',{name:'Close paint picker'}).click()
      await page.mouse.move(200,400)
      await page.mouse.wheel(0,600)
      await page.waitForTimeout(250)
      assert.ok(await page.evaluate(()=>window.scrollY)>0,'page remains scrollable after closing')
      if (mobile) {
        await page.evaluate(()=>window.scrollTo(0,0))
        const session=await context.newCDPSession(page)
        await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:200,y:600}]})
        for(let step=1;step<=6;step++) {
          await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:200,y:600-step*40}]})
        }
        await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
        await page.waitForTimeout(200)
        assert.ok(await page.evaluate(()=>window.scrollY)>0,'unit page scrolls by touch after dismissal')
      }
      assert.deepEqual(errors,[])
      await context.close()
    }
  } finally {
    await browser.close()
    await new Promise(resolve=>server.close(resolve))
  }
})
