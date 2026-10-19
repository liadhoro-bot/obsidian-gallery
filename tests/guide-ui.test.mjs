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
      const availableDecks=[deck('c',[step('four')])];
      window.sources=JSON.stringify(decks); installEditorNavigationProtection();
      function App() {
        if(location.pathname==='/discover') return <div className={browseStyles.guidesSilver}><CompactGuideCard guide={{id:'public',title:longTitle,subtitle:'Learn every stage of painting these warriors, from preparing the armour to the final highlights, with detailed colour choices and practical advice.', image:'/image.svg',deckId:'a',likeCount:12,saveCount:4,isOwner:false,tags:['Weathering']}} /></div>;
        if(location.pathname==='/discover-owned') return <div className={browseStyles.guidesSilver}><CompactGuideCard guide={{id:'owned',title:'Magnetizing a Battletech Mech',subtitle:'A step-by-step guide to magnetizing your model.',image:'/image.svg',deckId:'a',likeCount:12,saveCount:4,isOwner:true,tags:[]}} /></div>;
        if(location.pathname==='/titles') {
          const cards=deckCardEntries({...decks[0],title:longTitle,steps:['step','image','small-image','theme','theme-alt','paints','video'].map((t,i)=>step('t'+i,t))});
          return <div>{cards.map(c=><div data-test-card={c.key} key={c.key} style={{width:'min(360px, 100vw)',aspectRatio:'9/16',margin:'20px auto'}}>{c.node}</div>)}</div>
        }
        if(location.pathname==='/inline') {
          const own={...deck('own',[step('x'),step('y')]),title:'Own cards',coverPosition:null,inlineGuideId:'g'}; window.ownDeck=own;
          const all=[...decks,own];
          const layout=[{deckId:'own',cardId:'x',groupId:'own',hidden:false},{deckId:'b',cardId:'cover',groupId:'b',hidden:false},{deckId:'b',cardId:'three',groupId:'b',hidden:false},{deckId:'own',cardId:'y',groupId:'own',hidden:false}];
          return <GuideEditor guide={{id:'g',title:'Guide',subtitle:'A guide',deckIds:['a','b','own'],cardLayout:layout}} memberDecks={all} availableDecks={availableDecks} deckDetails={all} initialCoverImage='/image.svg' featureGuides={[]} backHref='/guides' onSaveDraft={async payload=>{window.saved=payload;return true}} />
        }
        return <GuideEditor guide={{id:'g',title:'Guide',subtitle:'A guide',deckIds:['a','b'],cardLayout:[{deckId:'a',cardId:'two',groupId:'b',hidden:false}]}} memberDecks={decks} availableDecks={availableDecks} deckDetails={decks} initialCoverImage='/image.svg' featureGuides={[]} backHref='/guides?tab=decks' onSaveDraft={async payload=>{window.saved=payload;window.afterSources=JSON.stringify(decks);return true}} />
      }
      createRoot(document.getElementById('root')).render(<App/>);
    ` },
    bundle:true, write:false, outdir:'tests/.guide-ui-bundle', platform:'browser', format:'iife', jsx:'automatic',
    plugins:[{name:'next-test-adapters', setup(b){
      b.onResolve({filter:/^(server-only|next\/image|.*navigation-link|.*navigation-provider|.*feature-guide-launcher|.*\/actions|.*\/assignment-actions)$/}, a=>({path:a.path,namespace:'adapter'}))
      b.onLoad({filter:/.*/,namespace:'adapter'}, a=>({loader:'tsx',resolveDir:process.cwd(),contents:
        // Server-only guards are irrelevant in this browser bundle.
        a.path==='server-only' ? '' :
        a.path.endsWith('/assignment-actions') ? 'export async function getAssignmentTargets(){return []} export async function setContentAssignments(){return {}} export async function getTargetAssignmentLibrary(){return []} export async function setTargetAssignments(){return {}}' :
        a.path.endsWith('/actions') ? 'export async function addInlineGuideCard(id,template){window.addedCard={id,template};const own=window.ownDeck;return {deckId:"own",stepId:"z",deck:{...own,steps:[...own.steps,{id:"z",number:3,title:"Step Card",template:"step",instructions:"Describe it.",paints:[],image:null,rawImage:null,imageFocalX:50,imageFocalY:50}]}}} export async function updateInlineGuideCard(id,card){window.updatedCard={id,card};const own=window.ownDeck;return {deckId:"own",deck:{...own,steps:own.steps.map(s=>s.id===card.id?{...s,title:card.title,instructions:card.body}:s)}}} export async function deleteInlineGuideCard(id,stepId){window.deletedCard={id,stepId};const own=window.ownDeck;return {deckId:"own",deck:{...own,steps:own.steps.filter(s=>s.id!==stepId)}}} export async function ensureInlineGuideDeck(id){window.ensuredGuide=id;return {deckId:"own"}} export async function createDeckFromForge(input){window.createdInput=input;return {id:"n"}} export async function loadGuideEditorDeck(id){if(id!=="n")throw new Error("Unexpected remote call");return {id:"n",title:window.createdInput.title,steps:[],coverPosition:0,image:"/image.svg",description:"A reusable guide.",paintList:[],cards:1,paints:0,isOwner:true,isPublic:false}} export async function toggleRecipeLike(){return {active:true}} export async function toggleRecipeSave(){return {active:true}}' :
        a.path.includes('navigation-provider') ? 'export function useRouter(){return {back:()=>history.back(),push:href=>{window.pushedHref=href},replace:href=>{window.pushedHref=href}}}' :
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
test('guide editor expands, hides and saves cards within their nested guide, keeping earlier cross-group placements',async()=>{
  const page=await browser.newPage({viewport:{width:390,height:844}})
  await page.goto(origin+'/editor');await page.getByRole('tab',{name:'Contents',exact:true}).click()
  assert.equal(await page.getByText('First card',{exact:true}).count(),0)
  await page.getByRole('button',{name:'Show cards'}).first().click()
  const card=page.locator('[data-hidden]').filter({has:page.getByText('First card',{exact:true})})
  await card.getByRole('button',{name:'Hide',exact:true}).click()
  // No way to send a source card into another nested guide.
  assert.equal(await page.locator('[data-hidden] select').count(),0)
  assert.equal(await card.getByRole('button',{name:'Move First card down'}).isDisabled(),true)
  assert.equal(await card.getByRole('button',{name:'Move First card up'}).isDisabled(),false)
  await page.getByRole('button',{name:'Show cards'}).click()
  // A card an earlier editor moved into group b still renders there.
  assert.equal(await page.locator('#guide-cards-a [data-guide-card-title]').count(),2)
  assert.equal(await page.locator('#guide-cards-b [data-guide-card-title]').count(),3)
  await page.getByRole('button',{name:'Save',exact:true}).click()
  const saved=await page.evaluate(()=>window.saved)
  assert.deepEqual(saved.cardLayout.find(c=>c.cardId==='one'),{deckId:'a',cardId:'one',groupId:'a',hidden:true})
  assert.deepEqual(saved.cardLayout.find(c=>c.cardId==='two'),{deckId:'a',cardId:'two',groupId:'b',hidden:false})
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

test('add-deck picker keeps actions compact without squeezing deck titles', async()=>{
  const page=await browser.newPage()
  for(const width of [390,1280]) {
    await page.setViewportSize({width,height:900});await page.goto(origin+'/editor')
    await page.getByRole('tab',{name:'Contents',exact:true}).click()
    await page.getByRole('button',{name:'+ Add',exact:true}).click()
    await page.getByRole('button',{name:'Add Existing Guide',exact:true}).click()
    const dialog=page.getByRole('dialog')
    const row=dialog.locator('article').filter({has:page.getByText('Second deck',{exact:true})})
    const dimensions=await row.evaluate((node)=>{
      const action=node.querySelector('button').getBoundingClientRect()
      const title=node.querySelector('[class*="cardName"]').getBoundingClientRect()
      return {actionWidth:action.width,rowWidth:node.getBoundingClientRect().width,titleWidth:title.width}
    })
    assert.ok(dimensions.actionWidth<=100,JSON.stringify({width,dimensions}))
    assert.ok(dimensions.titleWidth>dimensions.actionWidth,JSON.stringify({width,dimensions}))
    assert.ok(dimensions.actionWidth<dimensions.rowWidth*.3,JSON.stringify({width,dimensions}))
    await page.getByRole('button',{name:'Close',exact:true}).click()
  }
  await page.close()
})
test('+ Add offers one entry point and New Guide places a new reusable guide', async()=>{
  const page=await browser.newPage({viewport:{width:390,height:844}})
  await page.goto(origin+'/editor');await page.getByRole('tab',{name:'Contents',exact:true}).click()
  assert.equal(await page.getByRole('button',{name:'Add Existing Guide',exact:true}).count(),0)
  await page.getByRole('button',{name:'+ Add',exact:true}).click()
  const menu=page.getByRole('dialog',{name:'Add to this guide'})
  assert.deepEqual(await menu.locator('[class*="cardName"]').allTextContents(),['New Card','Existing Guide','New Guide'])
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await page.screenshot({path:'test-results/guide-ui/add-menu-mobile.png',fullPage:true})
  await menu.getByRole('button',{name:'Add New Guide',exact:true}).click()
  const form=page.getByRole('dialog',{name:'New guide'})
  assert.equal(await form.getByRole('button',{name:'Create and Add'}).isDisabled(),true)
  await form.getByLabel('Guide name').fill('Forgotten Tomb Gold')
  await form.getByRole('button',{name:'Create and Add'}).click()
  await page.getByRole('dialog').waitFor({state:'detached'})
  assert.equal(await page.evaluate(()=>window.createdInput.status),'Private')
  assert.equal(await page.locator('[class*="guideDeckRow"] [class*="cardName"]').filter({hasText:'Forgotten Tomb Gold'}).count(),1)
  await page.getByRole('button',{name:'Save',exact:true}).click()
  assert.deepEqual((await page.evaluate(()=>window.saved)).deckIds,['a','b','n'])
  await page.close()
})

test('direct cards sit between nested guides, reorder at top level, and never show as a nested guide', async()=>{
  const page=await browser.newPage({viewport:{width:390,height:844}})
  await page.goto(origin+'/inline');await page.getByRole('tab',{name:'Contents',exact:true}).click()
  const rows=page.locator('[class*="cardList"] > *')
  const labels=async()=>rows.evaluateAll(nodes=>nodes.map(node=>node.querySelector(':scope > [class*="cardInfo"] [class*="cardName"], :scope > [class*="guideCardInfo"] [data-guide-card-title]').textContent))
  // x (direct), b (nested), y (direct), a (nested, no saved cards -> appended block).
  assert.deepEqual(await labels(),['Painting the Ancient Crimson Warriors of the Northern Kingdom','Second deck','Painting the Ancient Crimson Warriors of the Northern Kingdom','First deck'])
  assert.equal(await page.getByText('Own cards',{exact:true}).count(),0)
  assert.equal(await rows.nth(0).getByRole('button',{name:/^Edit /}).count(),1)
  // Direct cards use the nested-card row: a preview, no sequence numbers.
  assert.equal(await rows.nth(0).locator(':scope > [class*="guideCardPreview"]').count(),1)
  assert.equal(await page.locator('[class*="cardList"] > * > [class*="cardNumber"]').count(),0)
  const titleBox=await rows.nth(0).locator('[data-guide-card-title]').boundingBox()
  assert.ok(titleBox.width>120,JSON.stringify(titleBox))
  // Move the first direct card below the nested guide b.
  await rows.nth(0).getByRole('button',{name:/ down$/}).press('Enter')
  assert.deepEqual(await labels(),['Second deck','Painting the Ancient Crimson Warriors of the Northern Kingdom','Painting the Ancient Crimson Warriors of the Northern Kingdom','First deck'])
  await page.getByRole('button',{name:'Save',exact:true}).click()
  const saved=await page.evaluate(()=>window.saved)
  assert.deepEqual(saved.deckIds,['b','a','own'])
  assert.deepEqual(saved.cardLayout.map(c=>c.cardId).slice(0,4),['cover','three','x','y'])
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
  await page.screenshot({path:'test-results/guide-ui/direct-cards-mobile.png',fullPage:true})
  // New Card picks a type right here and adds it to the guide - no other editor.
  await page.getByRole('button',{name:'+ Add',exact:true}).click()
  await page.getByRole('button',{name:'Add New Card',exact:true}).click()
  const types=page.getByRole('dialog',{name:'Add New Card'})
  const typeNames=await types.locator('button strong').allTextContents()
  assert.deepEqual(typeNames,['Cover Card','Index Card','Step Card','Theme Card','Big Image Card','Small Image Card','Paints Card','Video Card'])
  assert.equal(await types.getByRole('button',{name:/Index Card/}).isDisabled(),false)
  assert.equal(typeNames.some(name=>name.includes('Type A')),false)
  await types.getByRole('button',{name:/Step Card/}).click()
  await page.getByRole('dialog').waitFor({state:'detached'})
  assert.deepEqual(await page.evaluate(()=>window.addedCard),{id:'g',template:'step'})
  assert.equal(await page.evaluate(()=>window.pushedHref),undefined)
  assert.equal((await labels()).at(-1),'Step Card')
  // Index Cards: as many as the creator wants, always under New Card.
  for (let round=0; round<2; round+=1) {
    await page.getByRole('button',{name:'+ Add',exact:true}).click()
    await page.getByRole('button',{name:'Add New Card',exact:true}).click()
    await page.getByRole('dialog',{name:'Add New Card'}).getByRole('button',{name:/Index Card/}).click()
  }
  assert.equal(await page.locator('[data-top-level-card] [data-guide-card-title]').filter({hasText:'Guide Index'}).count(),2)
  // Cover Card: the guide's own cover, titled with the guide's name.
  await page.getByRole('button',{name:'+ Add',exact:true}).click()
  await page.getByRole('button',{name:'Add New Card',exact:true}).click()
  await page.getByRole('dialog',{name:'Add New Card'}).getByRole('button',{name:/Cover Card/}).click()
  const coverRow=page.locator('[data-top-level-card]').first()
  assert.equal(await coverRow.locator('[class*="cardTypeLabel"]').textContent(),'Card · Cover')
  assert.equal(await coverRow.locator('[data-guide-card-title]').textContent(),'Guide')
  assert.equal(await coverRow.getByRole('button',{name:'Remove Guide',exact:true}).count(),1)
  // Edit sits above Hide on a direct card.
  const last=rows.last()
  const editBox=await last.getByRole('button',{name:'Edit Step Card'}).boundingBox()
  const hideBox=await last.getByRole('button',{name:'Hide Step Card'}).boundingBox()
  assert.ok(editBox.y+editBox.height<=hideBox.y+1,JSON.stringify({editBox,hideBox}))
  await page.close()
})

test('Edit on a direct card opens the card editor in place and saves just that card', async()=>{
  const page=await browser.newPage({viewport:{width:390,height:844}})
  await page.goto(origin+'/inline');await page.getByRole('tab',{name:'Contents',exact:true}).click()
  const rows=page.locator('[class*="cardList"] > *')
  // Closing without a change saves nothing.
  await rows.nth(0).getByRole('button',{name:/^Edit /}).click()
  const sheet=page.getByRole('dialog')
  assert.equal(await sheet.getByRole('heading',{name:'Edit Step Card'}).count(),1)
  await sheet.getByRole('button',{name:'Done',exact:true}).click()
  await sheet.waitFor({state:'detached'})
  assert.equal(await page.evaluate(()=>window.updatedCard),undefined)
  // A changed card saves in place through the single-card action.
  await rows.nth(0).getByRole('button',{name:/^Edit /}).click()
  await sheet.getByRole('textbox').first().fill('Edited direct card')
  await sheet.getByRole('button',{name:'Done',exact:true}).click()
  await sheet.waitFor({state:'detached'})
  const updated=await page.evaluate(()=>window.updatedCard)
  assert.equal(updated.id,'g')
  assert.equal(updated.card.id,'x')
  assert.equal(updated.card.title,'Edited direct card')
  assert.equal(updated.card.template,'step')
  assert.equal(await page.evaluate(()=>window.pushedHref),undefined)
  assert.equal(await page.getByRole('tab',{name:'Contents',exact:true}).getAttribute('aria-selected'),'true')
  assert.equal(await rows.nth(0).locator('[data-guide-card-title]').textContent(),'Edited direct card')
  // Delete Card removes just that card, after a confirmation.
  page.once('dialog',dialog=>dialog.accept())
  await rows.nth(0).getByRole('button',{name:/^Edit /}).click()
  await sheet.getByRole('button',{name:'Delete Card',exact:true}).click()
  await sheet.waitFor({state:'detached'})
  assert.deepEqual(await page.evaluate(()=>window.deletedCard),{id:'g',stepId:'x'})
  assert.equal(await page.locator('[data-top-level-card]').count(),1)
  await page.screenshot({path:'test-results/guide-ui/direct-card-edit-mobile.png',fullPage:true})
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
