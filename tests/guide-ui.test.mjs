import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync } from 'node:fs'
import { build } from 'esbuild'
import postcss from 'postcss'
import tailwind from '@tailwindcss/postcss'
import { chromium } from 'playwright'
let browser, server, origin
before(async () => {
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
      import React from 'react'; import { createRoot } from 'react-dom/client';
      import GuideEditor from './app/guides/[id]/guide-editor-client';
      import { CompactGuideCard } from './app/guides/shared/discover-guide-list';
      import browseStyles from './app/guides/guides-v3-silver.module.css';
      import { deckCardEntries } from './app/guides/shared/deck-card-entries';
      import { installEditorNavigationProtection } from './app/components/navigation-feedback/unsaved-changes';
      const longTitle = 'Painting the Ancient Crimson Warriors of the Northern Kingdom';
      const step = (id, template='step') => ({id, number:1, title:id==='one'?'First card':longTitle, template, instructions:'Thin your paints and build up several smooth layers.', paints:[], image:template==='step'?null:'/image.svg', rawImage:template==='step'?null:'/image.svg', imageFocalX:50, imageFocalY:50});
      const deck = (id, steps) => ({id, title:id==='a'?'First deck':'Second deck', steps, coverPosition:0, image:'/image.svg', description:'A painting deck', paintList:[], cards:steps.length+1, paints:0, isOwner:true, isPublic:false});
      const decks=[deck('a',[step('one'),step('two')]),deck('b',[step('three')])];
      window.sources=JSON.stringify(decks); installEditorNavigationProtection();
      function App() {
        if(location.pathname==='/discover') return <div className={browseStyles.guidesSilver}><CompactGuideCard guide={{id:'public',title:longTitle,subtitle:'Learn every stage of painting these warriors, from preparing the armour to the final highlights, with detailed colour choices and practical advice.', image:'/image.svg',deckId:'a',likeCount:12,saveCount:4,isOwner:false,tags:['Weathering']}} /></div>;
        if(location.pathname==='/discover-owned') return <div className={browseStyles.guidesSilver}><CompactGuideCard guide={{id:'owned',title:'Magnetizing a Battletech Mech',subtitle:'A step-by-step guide to magnetizing your model.',image:'/image.svg',deckId:'a',likeCount:12,saveCount:4,isOwner:true,tags:[]}} /></div>;
        if(location.pathname==='/titles') {
          const cards=deckCardEntries({...decks[0],title:longTitle,steps:['step','image','small-image','theme','theme-alt','paints','video'].map((t,i)=>step('t'+i,t))});
          return <div>{cards.map(c=><div data-test-card={c.key} key={c.key} style={{width:'min(360px, 100vw)',aspectRatio:'9/16',margin:'20px auto'}}>{c.node}</div>)}</div>
        }
        return <GuideEditor guide={{id:'g',title:'Guide',subtitle:'A guide',deckIds:['a','b']}} memberDecks={decks} availableDecks={[]} deckDetails={decks} initialCoverImage='/image.svg' featureGuides={[]} backHref='/guides?tab=decks' onSaveDraft={async payload=>{window.saved=payload;window.afterSources=JSON.stringify(decks);return true}} />
      }
      createRoot(document.getElementById('root')).render(<App/>);
    ` },
    bundle:true, write:false, outdir:'tests/.guide-ui-bundle', platform:'browser', format:'iife', jsx:'automatic',
    plugins:[{name:'next-test-adapters', setup(b){
      b.onResolve({filter:/^(next\/image|.*navigation-link|.*navigation-provider|.*feature-guide-launcher|.*\/actions)$/}, a=>({path:a.path,namespace:'adapter'}))
      b.onLoad({filter:/.*/,namespace:'adapter'}, a=>({loader:'tsx',resolveDir:process.cwd(),contents:
        a.path.endsWith('/actions') ? 'export async function loadGuideEditorDeck(){throw new Error("Unexpected remote call")} export async function toggleRecipeLike(){return {active:true}} export async function toggleRecipeSave(){return {active:true}}' :
        a.path.includes('navigation-provider') ? 'export function useRouter(){return {back:()=>history.back(),push:href=>location.assign(href)}}' :
        a.path.includes('feature-guide-launcher') ? 'export default function Help(){return null}' :
        a.path==='next/image' ? `import React from 'react'; export default function Image({fill,priority,unoptimized,sizes,...p}){return <img {...p} style={{...p.style,...(fill?{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}:{})}}/>}` :
        `import React from 'react'; export default function Link(p){return <a {...p}/>}`
      }))
    }}]
  })
  const globalCss = await postcss([tailwind()]).process(readFileSync('app/globals.css','utf8'), {from:'app/globals.css'})
  const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text
  const css=globalCss.css+'\n'+bundle.outputFiles.find(f=>f.path.endsWith('.css')).text
  server=createServer((req,res)=>{
    if(req.url==='/image.svg'){res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="#596457"/></svg>');return}
    res.setHeader('Content-Type','text/html');res.end(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style><div id="root"></div><script>${js}</script>`)
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`
  browser=await chromium.launch({headless:true});mkdirSync('test-results/guide-ui',{recursive:true})
})
after(async()=>{await browser?.close();await new Promise(r=>server?server.close(r):r())})
test('guide editor expands, hides, transfers and saves cards independently of source decks',async()=>{
  const page=await browser.newPage({viewport:{width:390,height:844}})
  await page.goto(origin+'/editor');await page.getByRole('tab',{name:'Decks',exact:true}).click()
  assert.equal(await page.getByText('First card',{exact:true}).count(),0)
  await page.getByRole('button',{name:'Show cards'}).first().click()
  const card=page.locator('[data-hidden]').filter({has:page.getByText('First card',{exact:true})})
  await card.getByRole('button',{name:'Hide',exact:true}).click()
  await card.getByRole('combobox').selectOption('b')
  await page.getByRole('button',{name:'Show cards'}).click()
  assert.equal(await page.locator('#guide-cards-b [data-guide-card-title]').filter({hasText:'First card'}).count(),1)
  await page.getByRole('button',{name:'Save',exact:true}).click()
  const saved=await page.evaluate(()=>window.saved)
  assert.deepEqual(saved.cardLayout.find(c=>c.cardId==='one'),{deckId:'a',cardId:'one',groupId:'b',hidden:true})
  assert.equal(await page.evaluate(()=>window.sources===window.afterSources),true)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await page.screenshot({path:'test-results/guide-ui/editor-mobile.png',fullPage:true})
  await page.getByRole('tab',{name:'Details',exact:true}).click()
  await page.getByPlaceholder('New tag').fill('  Industrial   Weathering  ')
  await page.getByRole('button',{name:'Add Tag',exact:true}).click()
  assert.equal(await page.locator('[class*="tagPill"]').filter({hasText:'Industrial Weathering'}).count(),1)
  assert.equal(await page.getByRole('heading',{name:'Gallery',exact:true}).count(),1)
  assert.equal(await page.getByRole('heading',{name:'Cover Image',exact:true}).count(),0)
  await page.screenshot({path:'test-results/guide-ui/guide-tags-gallery-mobile.png',fullPage:true})
  await page.getByRole('button',{name:'Save',exact:true}).click()
  assert.deepEqual((await page.evaluate(()=>window.saved)).tags,['Industrial Weathering'])
  await page.getByRole('tab',{name:'Preview',exact:true}).click()
  assert.equal(await page.getByRole('heading',{name:'First card',exact:true}).count(),0)
  await page.close()
})
test('long titles remain within the card bounds in every template at mobile and desktop widths',async()=>{
  const page=await browser.newPage()
  for(const width of [320,390,1280]) {
    await page.setViewportSize({width,height:900});await page.goto(origin+'/titles')
    await page.locator('[data-test-card]').last().waitFor()
    const titles=await page.locator('[data-test-card] h2').evaluateAll(nodes=>nodes.map(node=>{
      const rect=node.getBoundingClientRect(), card=node.closest('[data-test-card]').getBoundingClientRect()
      return {text:node.textContent,inside:rect.left>=card.left-1&&rect.right<=card.right+1&&rect.top>=card.top&&rect.bottom<=card.bottom,clipped:node.scrollWidth>node.clientWidth+1||node.scrollHeight>node.clientHeight+1}
    }))
    assert.equal(titles.length,8)
    assert.ok(titles.every(t=>t.inside&&!t.clipped),JSON.stringify({width,titles}))
    if(width===390) await page.screenshot({path:'test-results/guide-ui/card-titles-mobile.png',fullPage:true})
  }
  await page.close()
})

test('Discover gives text full width and separates view, info, and social controls', async()=>{
  const page=await browser.newPage({viewport:{width:320,height:800}})
  await page.goto(origin+'/discover')
  assert.equal(await page.getByRole('link',{name:'View cards:',exact:false}).getAttribute('href'),'/guides/public?preview=1&view=1')
  assert.equal(await page.getByRole('link',{name:'Info',exact:true}).count(),1)
  assert.equal(await page.getByRole('link',{name:'Edit',exact:true}).count(),0)
  assert.equal(await page.locator('a button, a a').count(),0)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await page.screenshot({path:'test-results/guide-ui/discover-mobile.png',fullPage:true})
  await page.close()
})

test('editable guide keeps View, Info, Edit and social controls in one bounded row', async()=>{
  const page=await browser.newPage({viewport:{width:320,height:500}})
  await page.goto(origin+'/discover-owned')
  assert.equal(await page.getByRole('link',{name:'Edit',exact:true}).count(),1)
  assert.equal(await page.getByRole('link',{name:'View cards:',exact:false}).getByText('View').count(),1)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await page.screenshot({path:'test-results/guide-ui/editable-list-card-mobile.png',fullPage:true})
  await page.close()
})
