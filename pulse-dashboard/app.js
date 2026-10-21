const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,'0');
const rechargeKey='pulse-dashboard-recharge-v1';
const dialog=$('settings-dialog');
const backdrop=$('modal-backdrop');
let lastThemeMinute=-1;
let lastHeatmapKey='';
const localDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const bytes=n=>{if(n==null||!Number.isFinite(n))return '—';if(n>=1073741824)return `${(n/1073741824).toFixed(1)} GB`;if(n>=1048576)return `${(n/1048576).toFixed(1)} MB`;if(n>=1024)return `${(n/1024).toFixed(1)} KB`;return `${Math.round(n)} B`};
const speed=n=>n==null?'—':`${bytes(n)}/s`;
const finite=n=>n!=null&&Number.isFinite(Number(n));
const clamp=n=>Math.max(0,Math.min(100,n));
const rgb=a=>`rgb(${a.map(Math.round).join(',')})`;
const mix=(a,b,t)=>a.map((x,i)=>x+(b[i]-x)*t);

const palettes=[
 {at:0,bg:[237,236,251],surface:[251,250,255],border:[123,116,163],text:[51,52,88],muted:[109,108,147],faint:[145,142,172],accent:[139,126,216],track:[151,144,184],skyTop:[177,180,230],skyBottom:[228,203,239],heroText:[48,53,91],heroMuted:[104,105,147],orb:[245,233,255],stars:.72,green:[108,181,133]},
 {at:5,bg:[246,238,247],surface:[255,252,255],border:[150,123,164],text:[65,57,83],muted:[128,112,143],faint:[163,147,174],accent:[221,150,160],track:[170,145,172],skyTop:[201,185,228],skyBottom:[251,211,205],heroText:[72,58,88],heroMuted:[139,112,141],orb:[255,239,204],stars:.35,green:[116,185,137]},
 {at:7,bg:[238,236,233],surface:[255,251,247],border:[106,110,119],text:[55,57,68],muted:[120,123,132],faint:[157,157,160],accent:[221,134,96],track:[124,128,135],skyTop:[166,194,218],skyBottom:[255,211,170],heroText:[66,65,69],heroMuted:[113,108,112],orb:[255,236,177],stars:0,green:[82,164,128]},
 {at:12,bg:[244,247,245],surface:[255,255,255],border:[80,104,115],text:[32,52,64],muted:[103,124,138],faint:[145,163,171],accent:[212,124,76],track:[84,106,117],skyTop:[151,207,228],skyBottom:[239,230,198],heroText:[37,70,84],heroMuted:[77,111,125],orb:[255,246,188],stars:0,green:[70,162,128]},
 {at:16,bg:[247,244,239],surface:[255,252,248],border:[107,100,99],text:[61,56,59],muted:[124,112,115],faint:[158,147,148],accent:[220,119,81],track:[129,115,113],skyTop:[174,202,215],skyBottom:[255,198,157],heroText:[68,60,63],heroMuted:[117,99,97],orb:[255,224,161],stars:0,green:[75,157,125]},
 {at:18.5,bg:[250,233,234],surface:[255,250,249],border:[169,125,145],text:[76,57,82],muted:[143,109,133],faint:[176,147,167],accent:[234,146,123],track:[175,135,151],skyTop:[204,174,213],skyBottom:[255,190,167],heroText:[82,57,85],heroMuted:[151,109,137],orb:[255,218,173],stars:.22,green:[116,184,136]},
 {at:21,bg:[240,238,251],surface:[251,250,255],border:[128,119,164],text:[51,54,88],muted:[110,111,148],faint:[145,144,172],accent:[148,133,220],track:[151,147,184],skyTop:[181,183,231],skyBottom:[229,205,238],heroText:[53,54,93],heroMuted:[113,112,150],orb:[246,234,255],stars:.68,green:[111,181,137]},
 {at:24,bg:[237,236,251],surface:[251,250,255],border:[123,116,163],text:[51,52,88],muted:[109,108,147],faint:[145,142,172],accent:[139,126,216],track:[151,144,184],skyTop:[177,180,230],skyBottom:[228,203,239],heroText:[48,53,91],heroMuted:[104,105,147],orb:[245,233,255],stars:.72,green:[108,181,133]}
];
function applyTimeTheme(hour){
 let a=palettes[0],b=palettes[1];
 for(let i=0;i<palettes.length-1;i++)if(hour>=palettes[i].at&&hour<=palettes[i+1].at){a=palettes[i];b=palettes[i+1];break}
 const t=(hour-a.at)/(b.at-a.at||1),value=key=>mix(a[key],b[key],t),root=document.documentElement;
 const set=(name,value)=>root.style.setProperty(name,value);
 for(const [property,key] of [['--bg','bg'],['--surface','surface'],['--surface-solid','surface'],['--text','text'],['--muted','muted'],['--faint','faint'],['--accent','accent'],['--hero-top','skyTop'],['--hero-bottom','skyBottom'],['--hero-text','heroText'],['--hero-muted','heroMuted'],['--orb','orb'],['--green','green']])set(property,rgb(value(key)));
 set('--accent-rgb',value('accent').map(Math.round).join(','));
 set('--border',`rgba(${value('border').map(Math.round).join(',')},${hour>=7&&hour<18?.16:.27})`);
 set('--track',`rgba(${value('track').map(Math.round).join(',')},${hour>=7&&hour<18?.19:.42})`);
 set('--stars',String(a.stars+(b.stars-a.stars)*t));
 root.style.colorScheme='light';
 const day=hour>=6&&hour<18,phase=day?(hour-6)/12:((hour-18+24)%24)/12;
 set('--sky-x',`${day?15+70*phase:85-70*phase}%`);
 set('--sky-y',`${68-45*Math.sin(Math.PI*phase)}%`);
 document.querySelector('meta[name="theme-color"]').content=rgb(value('bg'));
}
function updateClock(){
 const now=new Date(),hour=now.getHours()+now.getMinutes()/60+now.getSeconds()/3600;
 const minute=now.getHours()*60+now.getMinutes();if(minute!==lastThemeMinute){applyTimeTheme(hour);lastThemeMinute=minute}
 $('clock').textContent=`${pad(now.getHours())}:${pad(now.getMinutes())}`;
 $('seconds').textContent=pad(now.getSeconds());
 $('date').textContent=new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'}).format(now);
 $('period-label').textContent=hour<5?'深夜':hour<7?'黎明':hour<11?'早晨':hour<14?'白昼':hour<18?'下午':hour<20?'日落':'夜晚';
 $('greeting').textContent=hour<5?'夜深了，给灵感一点空间。':hour<11?'早上好，今天也有新的可能。':hour<14?'中午好，让思路继续生长。':hour<18?'下午好，保持专注的节奏。':'晚上好，保持灵感流动。';
 $('timezone').textContent=(Intl.DateTimeFormat().resolvedOptions().timeZone||'LOCAL TIME').replaceAll('_',' ').toUpperCase();
 const progress=Math.round((now.getHours()*3600+now.getMinutes()*60+now.getSeconds())/864);
 $('day-progress-fill').style.width=`${progress}%`;$('day-progress-text').textContent=`${progress}%`;
 updateRecharge();
}
function renderCpu(cpu){
 $('cpu-value').textContent=finite(cpu?.percent)?Math.round(cpu.percent):'—';
 const cores=Array.isArray(cpu?.cores)?cpu.cores:[],grid=$('core-grid');
 const pCores=cores.filter(core=>core.type==='P').length,eCores=cores.filter(core=>core.type==='E').length;
 $('cpu-detail').textContent=cores.length?`${cores.length} 个物理核心 · ${cpu.logicalCount} 逻辑线程 · ${cpu.model||'处理器'}`:cpu?'请重启本地服务以读取核心拓扑':'正在读取核心拓扑';
 $('cpu-source').textContent=cpu?.topologySource==='windows-host'?'Windows 主机物理核心':cpu?.topologySource==='linux-topology'?'WSL 可见核心组':cores.length?'逻辑核心':'等待新服务';
 const groups=[['P','性能核'],['E','能效核'],['C','核心']].map(([type,title])=>({type,title,cores:cores.filter(core=>(core.type==='P'||core.type==='E'?core.type:'C')===type)})).filter(group=>group.cores.length);
 const signature=groups.map(group=>`${group.type}:${group.cores.map(core=>core.index).join(',')}`).join('|');
 if(grid.dataset.signature!==signature){
  const fragment=document.createDocumentFragment();
  for(const group of groups){
   const zone=document.createElement('div');zone.className=`core-zone zone-${group.type.toLowerCase()}`;
   const zoneGrid=document.createElement('div');zoneGrid.className='core-zone-grid';
   for(const core of group.cores){const item=document.createElement('div');item.className='core-item';item.dataset.coreIndex=String(core.index);item.innerHTML='<div class="core-square" role="img"><i class="core-fill"></i></div>';zoneGrid.append(item)}
   zone.append(zoneGrid);fragment.append(zone);
  }
  grid.replaceChildren(fragment);grid.dataset.signature=signature;
 }
 const counts={P:0,E:0,C:0};
 for(const group of groups){for(const core of group.cores){const item=grid.querySelector(`.zone-${group.type.toLowerCase()} .core-item[data-core-index="${core.index}"]`),percent=finite(core.percent)?clamp(core.percent):null,label=`${group.type}${pad(++counts[group.type])}`,description=`${group.title} ${label} · ${percent==null?'等待采样':Math.round(percent)+'% 占用'}`;item.querySelector('.core-fill').style.height=`${percent||0}%`;item.classList.toggle('hot',percent>=70);item.querySelector('.core-square').setAttribute('aria-label',description)}}
}
function renderGpu(gpu){
 const percent=finite(gpu?.percent)?clamp(gpu.percent):null;
 $('gpu-value').textContent=percent==null?'—':Math.round(percent);
 $('gpu-fill').style.transform=`scaleY(${(percent||0)/100})`;
 $('gpu-gauge').setAttribute('aria-label',`RTX 5090 FE 轮廓线稿，GPU 实时占用率 ${percent==null?'不可用':Math.round(percent)+'%'}`);
 $('gpu-name').textContent=gpu?.name||'GPU 数据不可用';
 const vramPercent=finite(gpu?.memoryUsed)&&finite(gpu?.memoryTotal)&&gpu.memoryTotal>0?clamp(gpu.memoryUsed/gpu.memoryTotal*100):null;
 $('gpu-vram').textContent=vramPercent==null?'—':`${bytes(gpu.memoryUsed)} / ${bytes(gpu.memoryTotal)}`;
 $('gpu-vram-fill').style.width=`${vramPercent||0}%`;
 $('gpu-detail').textContent=finite(gpu?.memoryPercent)?`显存控制器负载 ${Math.round(gpu.memoryPercent)}%`:'实时图形负载';
 $('gpu-temp').textContent=finite(gpu?.temperature)?`${Math.round(gpu.temperature)} °C`:'—';
 $('gpu-power').textContent=finite(gpu?.powerDraw)?`${Math.round(gpu.powerDraw)} W`:'—';
 $('gpu-clock').textContent=finite(gpu?.graphicsClock)?`${Math.round(gpu.graphicsClock)} MHz`:'—';
}
function renderSystem(data){
 const item=data.memory,percent=finite(item?.percent)?clamp(item.percent):null;
 $('memory-value').textContent=percent==null?'—':Math.round(percent);
 $('memory-fill').style.width=`${percent||0}%`;
 $('memory-detail').textContent=item?`${bytes(item.used)} / ${bytes(item.total)}`:'正在采样';
 $('network-down').textContent=speed(data.network?.down);$('network-up').textContent=speed(data.network?.up);
}
function renderHeatmap(git){
 const today=new Date();today.setHours(0,0,0,0);
 const key=`${localDate(today)}:${git?.total??'none'}:${git?.last??'none'}`;if(key===lastHeatmapKey)return;lastHeatmapKey=key;
 const start=new Date(today);start.setDate(start.getDate()-start.getDay()-52*7);
 const counts=git?.days||{},cells=document.createDocumentFragment(),months=document.createDocumentFragment();let lastMonth=-1;
 for(let week=0;week<53;week++){const first=new Date(start);first.setDate(first.getDate()+week*7);if(first.getMonth()!==lastMonth){const label=document.createElement('span');label.textContent=`${first.getMonth()+1}月`;label.style.gridColumn=String(week+1);months.append(label);lastMonth=first.getMonth()}
  for(let weekday=0;weekday<7;weekday++){const d=new Date(first);d.setDate(first.getDate()+weekday);const day=localDate(d),count=counts[day]||0,cell=document.createElement('i');cell.dataset.level=String(count===0?0:count===1?1:count<=3?2:count<=6?3:4);cell.title=`${day} · ${count} 次提交`;if(d>today)cell.classList.add('future');cells.append(cell)}}
 $('heatmap').replaceChildren(cells);$('heatmap-months').replaceChildren(months);
 $('git-total').textContent=git?.total?.toLocaleString('zh-CN')??'—';
 $('git-repos').textContent=git?`${git.repos} 个本地仓库 · ${git.authorFiltered?'我的提交':'全部提交'}`:'Git 数据不可用';
}
function resetLabel(seconds){if(!finite(seconds))return '重置时间 —';const d=new Date(Number(seconds)*1000),today=new Date(),prefix=localDate(d)===localDate(today)?'今天':`${d.getMonth()+1}月${d.getDate()}日`;return `${prefix} ${pad(d.getHours())}:${pad(d.getMinutes())} 重置`}
function renderQuota(id,windowData,codex){const reset=Number(windowData?.resets_at),used=Number(windowData?.used_percent),stale=!finite(windowData?.used_percent)||!finite(windowData?.resets_at)||reset*1000<Date.now()||Date.now()-Number(codex?.timestamp)>12*3600000;const remaining=stale?null:clamp(100-used);$(id).textContent=remaining==null?'待更新':`${Math.round(remaining)}%`;$((id+'-bar')).style.width=remaining==null?'0%':`${remaining}%`;$(id+'-reset').textContent=reset?resetLabel(reset):'重置时间 —'}
function renderCodex(codex){renderQuota('quota-5h',codex?.primary,codex);renderQuota('quota-7d',codex?.secondary,codex);$('credits-balance').textContent=codex?.credits?.unlimited?'∞':codex?.credits?.balance!=null?String(codex.credits.balance):'—';if(codex?.timestamp){const d=new Date(codex.timestamp);$('codex-source').textContent=`本地会话 ${pad(d.getHours())}:${pad(d.getMinutes())} 记录`}else $('codex-source').textContent='本地会话暂无额度记录'}
function renderStatus(data){renderCpu(data.cpu);renderGpu(data.gpu);renderSystem(data);renderHeatmap(data.git);renderCodex(data.codex);const d=new Date(data.timestamp);$('last-update').textContent=`更新于 ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`}
let pending=false;async function poll(){if(pending||document.hidden)return;pending=true;try{const response=await fetch('/api/status',{cache:'no-store'});if(!response.ok)throw new Error('status request failed');renderStatus(await response.json())}catch{$('last-update').textContent='等待重新连接'}finally{pending=false}}
function updateRecharge(){let raw;try{raw=localStorage.getItem(rechargeKey)}catch{}const target=raw?new Date(raw):null;if(!target||!Number.isFinite(target.getTime()))return;const diff=target.getTime()-Date.now();$('recharge-day').textContent=pad(target.getDate());$('recharge-month').textContent=`${target.getFullYear()} / ${pad(target.getMonth()+1)} · ${pad(target.getHours())}:${pad(target.getMinutes())}`;$('recharge-hint').textContent=diff>0?'即将到来的补给':'已到预设时间';if(diff>0){const days=Math.floor(diff/86400000),hours=Math.floor(diff%86400000/3600000),minutes=Math.floor(diff%3600000/60000);$('recharge-countdown').textContent=`还有 ${days} 天 ${hours} 小时 ${minutes} 分钟`}else $('recharge-countdown').textContent='已到预设时间 · 可在设置中更新';$('recharge-progress').style.width=`${Math.max(0,Math.min(100,(1-diff/(30*86400000))*100))}%`}
function openSettings(){try{$('recharge-input').value=localStorage.getItem(rechargeKey)||''}catch{}backdrop.hidden=false;dialog.showModal()}
function closeSettings(){dialog.close();backdrop.hidden=true}
$('settings-button').addEventListener('click',openSettings);$('close-settings').addEventListener('click',closeSettings);backdrop.addEventListener('click',closeSettings);dialog.addEventListener('close',()=>{backdrop.hidden=true});
$('settings-form').addEventListener('submit',event=>{event.preventDefault();const value=$('recharge-input').value;try{if(value)localStorage.setItem(rechargeKey,value);else localStorage.removeItem(rechargeKey)}catch{}if(!value){$('recharge-day').textContent='—';$('recharge-month').textContent='未设置';$('recharge-hint').textContent='在设置中填写时间';$('recharge-countdown').textContent='从右侧边缘打开设置';$('recharge-progress').style.width='0%'}updateRecharge();closeSettings()});
async function toggleFullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch{}}
function syncFullscreen(){const active=Boolean(document.fullscreenElement);$('fullscreen-label').textContent=active?'退出':'全屏';$('fullscreen-button').setAttribute('aria-label',active?'退出全屏':'进入全屏');$('fullscreen-button').title=active?'退出全屏（F / F11）':'切换全屏（F / F11）'}
const edgeControls=$('edge-controls'),edgeHandle=$('edge-handle');
function setEdgeOpen(open){edgeControls.classList.toggle('is-open',open);edgeHandle.setAttribute('aria-expanded',String(open));edgeHandle.setAttribute('aria-label',open?'收起页面控制':'展开页面控制');if(!open&&edgeControls.contains(document.activeElement))document.activeElement.blur()}
edgeHandle.addEventListener('click',()=>setEdgeOpen(!edgeControls.classList.contains('is-open')));
document.addEventListener('pointerdown',event=>{if(!edgeControls.contains(event.target))setEdgeOpen(false)});
$('fullscreen-button').addEventListener('click',toggleFullscreen);
document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('keydown',event=>{const key=event.key;if((key==='F11'||key.toLowerCase()==='f')&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)&&!dialog.open){event.preventDefault();toggleFullscreen()}});
updateClock();setInterval(updateClock,1000);renderHeatmap(null);poll();setInterval(poll,3000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});
