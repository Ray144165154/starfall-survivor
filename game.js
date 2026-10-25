import {DURATION,clamp,length,xpNeeded,formatTime,makePlayer,upgrades,choices,damagePlayer} from './core.js';

const $=id=>document.getElementById(id), canvas=$('game'),ctx=canvas.getContext('2d');
let width=innerWidth,height=innerHeight,dpr=1,state='menu',p=makePlayer(),elapsed=0;
let enemies=[],bullets=[],gems=[],particles=[],hostile=[],build={},spawnTimer=0,fireTimer=0,bossSpawned=false,boss=null,shake=0;
let soundEnabled=false,audio,toastTime=0,last=0,visualTime=0,dashVector={x:0,y:-1},aim=-Math.PI/2;
const keys=new Set(),pointer={active:false,id:null,x:0,y:0,ox:0,oy:0};
const stars=Array.from({length:150},()=>({x:Math.random()*2400,y:Math.random()*1600,r:Math.random()*1.4+.3,a:Math.random()*.5+.15}));
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand=(a,b)=>a+Math.random()*(b-a);
let record={time:0,kills:0,wins:0};try{record={...record,...JSON.parse(localStorage.getItem('starfall-record')||'{}')};}catch{}
function showRecord(){ $('record').textContent=record.time?`远征纪录  ${formatTime(record.time)}  /  ${record.kills} 击破  /  ${record.wins} 次撤离`: '你的第一场远征，即将开始。'; }
showRecord();
function resize(){width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);}
addEventListener('resize',resize);resize();
function beep(freq=440,duration=.05,type='sine',volume=.025){
  if(!soundEnabled)return;
  try{audio??=new (window.AudioContext||window.webkitAudioContext)();const o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.65,audio.currentTime+duration);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}
}
$('sound').onclick=()=>{soundEnabled=!soundEnabled;$('sound').textContent=`音效 ${soundEnabled?'ON':'OFF'}`;$('sound').setAttribute('aria-label',soundEnabled?'关闭音效':'开启音效');if(soundEnabled){audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();beep();}};
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');toastTime=3;}
function clearInput(){keys.clear();pointer.active=false;pointer.id=null;}
function start(){
  p=makePlayer();elapsed=0;enemies=[];bullets=[];gems=[];particles=[];hostile=[];build={};spawnTimer=.4;fireTimer=.1;bossSpawned=false;boss=null;shake=0;aim=-Math.PI/2;
  state='playing';clearInput();$('menu').hidden=true;$('overlay').hidden=true;$('hud').hidden=false;$('pause').hidden=false;$('pause').textContent='暂停 Ⅱ';$('boss-wrap').hidden=true;$('build').textContent='';
  toast('存活 5 分钟，击败星渊守门者。');updateHUD();
}
$('start').onclick=start;
function dialog(content){$('dialog').innerHTML=content;$('overlay').hidden=false;requestAnimationFrame(()=>$('dialog').querySelector('button')?.focus());}
function pause(){
  if(state==='playing'){
    state='paused';clearInput();$('pause').textContent='继续 ▷';dialog('<div class="eyebrow">SIGNAL ON HOLD</div><h2>暂停航行</h2><p>星渊正在等你。准备好后继续远征。</p><button id="resume" class="primary">继续远征 ▷</button><button id="quit" class="secondary">结束本次远征</button>');$('resume').onclick=pause;$('quit').onclick=()=>finish(false);
  }else if(state==='paused'){state='playing';$('overlay').hidden=true;$('pause').textContent='暂停 Ⅱ';}
}
$('pause').onclick=pause;
function dash(){if(state!=='playing'||p.dashCd>0)return;p.dashCd=3;p.dashTime=.19;p.invulnerable=Math.max(p.invulnerable,.24);dashVector={x:p.dx,y:p.dy};beep(150,.15,'sawtooth',.03);burst(p.x,p.y,'#82f4ce',12);}
$('dash').addEventListener('pointerdown',e=>{e.preventDefault();dash();});
addEventListener('keydown',e=>{
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  keys.add(e.code);if(e.repeat)return;
  if(e.code==='Space')dash();if(e.code==='KeyP'||e.code==='Escape')pause();
  if(state==='upgrade'&&/^Digit[123]$/.test(e.code))$('dialog').querySelectorAll('.choice')[Number(e.code.slice(-1))-1]?.click();
});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{clearInput();if(state==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='playing')pause();});
canvas.addEventListener('pointerdown',e=>{if(state!=='playing'||pointer.active)return;pointer.active=true;pointer.id=e.pointerId;pointer.x=pointer.ox=e.clientX;pointer.y=pointer.oy=e.clientY;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointer.id){pointer.x=e.clientX;pointer.y=e.clientY;}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(e.pointerId===pointer.id){pointer.active=false;pointer.id=null;}});
function upgrade(){
  state='upgrade';clearInput();beep(750,.25,'sine');
  const options=choices(build);
  dialog(`<div class="eyebrow">EVOLUTION AVAILABLE / LV. ${p.level}</div><h2>让星能，为你所用。</h2><p>选择一项进化。效果可叠加，本次远征内生效。</p><div class="choices">${options.map((u,i)=>`<button class="choice" data-upgrade="${u.id}"><span class="symbol">${u.icon}</span><strong>${u.name}</strong><small>${u.description}</small><small>${i+1} · 已选择 ${build[u.id]||0} 次</small></button>`).join('')}</div><p class="tip">点击卡片或按 1 / 2 / 3 选择</p>`);
  for(const button of $('dialog').querySelectorAll('.choice'))button.onclick=()=>{
    if(state!=='upgrade')return;
    const u=upgrades.find(v=>v.id===button.dataset.upgrade);u.apply(p);build[u.id]=(build[u.id]||0)+1;
    $('build').textContent=upgrades.filter(u=>build[u.id]).map(u=>`${u.icon} ${u.name} ×${build[u.id]}`).join('  ·  ');
    state='playing';$('overlay').hidden=true;p.invulnerable=Math.max(p.invulnerable,1);updateHUD();
    if(p.xp>=xpNeeded(p.level)){p.xp-=xpNeeded(p.level);p.level++;upgrade();}
  };
}
function finish(won){
  if(state==='over')return;state='over';clearInput();$('pause').hidden=true;
  record.time=Math.max(record.time,Math.floor(elapsed));record.kills=Math.max(record.kills,p.kills);if(won)record.wins++;
  try{localStorage.setItem('starfall-record',JSON.stringify(record));}catch{}
  showRecord();beep(won?880:130,.5,'triangle',.06);
  dialog(`<div class="eyebrow">${won?'EXTRACTION COMPLETE':'SIGNAL LOST'}</div><h2>${won?'你带回了星光。':'星渊，记住了你。'}</h2><p>${won?'守门者已被击败。逐星者，本次远征成功。':'每一次陨落，都是下一次出发的序章。'}</p><div class="results"><div><strong>${formatTime(elapsed)}</strong><span>存活时间</span></div><div><strong>${p.kills}</strong><span>击破敌人</span></div><div><strong>${p.level}</strong><span>进化等级</span></div></div><p class="tip">${won?'尝试不同的进化组合，找到你的专属流派。':'提示：冲刺期间免疫伤害；修复与环轨卫星可以帮助你突破包围。'}</p><button id="again" class="primary">再次远征 ↗</button><button id="home" class="secondary">返回星港</button>`);
  $('again').onclick=start;$('home').onclick=()=>{state='menu';$('overlay').hidden=true;$('hud').hidden=true;$('menu').hidden=false;$('boss-wrap').hidden=true;};
}
function burst(x,y,color,count=10){for(let i=0;i<count;i++){const a=rand(0,Math.PI*2),s=rand(25,150);particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:rand(.2,.6),color});}}
function spawn(type){
  const a=rand(0,Math.PI*2),radius=Math.hypot(width,height)/2+80;
  const t=elapsed/DURATION,stats={drone:[15+t*35,54+t*25,10,11,1],swift:[10+t*23,105+t*40,7,8,1],brute:[90+t*160,32+t*15,20,22,5],shooter:[45+t*60,40,13,13,3],boss:[4200,45,44,28,40]}[type];
  const e={x:p.x+Math.cos(a)*radius,y:p.y+Math.sin(a)*radius,type,hp:stats[0],maxHp:stats[0],speed:stats[1],r:stats[2],damage:stats[3],xp:stats[4],attack:rand(1.5,3),flash:0};
  if(type==='boss'){e.x=p.x;e.y=p.y-Math.min(height*.55,400);boss=e;$('boss-wrap').hidden=false;}
  enemies.push(e);
}
function shoot(){
  let nearest=null,dist=650**2;for(const e of enemies){if(e.hp<=0)continue;const d=(e.x-p.x)**2+(e.y-p.y)**2;if(d<dist){dist=d;nearest=e;}}
  if(!nearest)return;
  aim=Math.atan2(nearest.y-p.y,nearest.x-p.x);
  for(let i=0;i<p.projectiles;i++){const a=aim+(i-(p.projectiles-1)/2)*.15;bullets.push({x:p.x,y:p.y,vx:Math.cos(a)*570,vy:Math.sin(a)*570,life:1.25,hits:new Set(),remaining:p.pierce+1});}
  beep(510,.035,'triangle',.012);
}
function hit(e,damage){
  if(e.hp<=0)return;e.hp-=damage;e.flash=.08;
  if(e.hp<=0){p.kills++;burst(e.x,e.y,e.type==='boss'?'#ff91c4':e.type==='brute'?'#e4b87b':'#9d8bff',e.type==='boss'?70:8);shake=e.type==='boss'?12:2;
    if(e.type==='boss'){finish(true);return;}
    gems.push({x:e.x,y:e.y,value:e.xp});
    if(Math.random()<.025)gems.push({x:e.x+10,y:e.y,value:0,heal:12});
  }
}
function update(dt){
  elapsed+=dt;p.dashCd=Math.max(0,p.dashCd-dt);p.dashTime=Math.max(0,p.dashTime-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);p.hp=Math.min(p.maxHp,p.hp+p.regen*dt);
  let mx=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  let my=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
  if(pointer.active){mx=clamp((pointer.x-pointer.ox)/45,-1,1);my=clamp((pointer.y-pointer.oy)/45,-1,1);}
  let m=length(mx,my);if(m>.04){mx/=Math.max(1,m);my/=Math.max(1,m);p.dx=mx/(length(mx,my)||1);p.dy=my/(length(mx,my)||1);}
  if(p.dashTime>0){p.x+=dashVector.x*850*dt;p.y+=dashVector.y*850*dt;if(Math.random()<.6)burst(p.x,p.y,'#82f4ce',1);}else{p.x+=mx*p.speed*dt;p.y+=my*p.speed*dt;}
  spawnTimer-=dt;if(spawnTimer<=0){spawnTimer=Math.max(.16,.95-elapsed*.0025);const amount=1+Math.floor(elapsed/75);for(let i=0;i<amount&&enemies.length<240;i++){const r=Math.random();spawn(elapsed>50&&r<.12?'brute':elapsed>80&&r<.22?'shooter':elapsed>20&&r<.47?'swift':'drone');}}
  if(elapsed>=DURATION&&!bossSpawned){bossSpawned=true;spawn('boss');toast('警告：星渊守门者已出现。击败它，完成撤离。');beep(90,.6,'sawtooth',.04);}
  fireTimer-=dt;if(fireTimer<=0){fireTimer=p.fireRate;shoot();}
  for(const e of enemies){
    if(e.hp<=0)continue;e.flash=Math.max(0,e.flash-dt);const dx=p.x-e.x,dy=p.y-e.y,d=length(dx,dy)||1;let speed=e.speed;
    if(e.type==='shooter'&&d<280)speed=d<200?-20:0;
    e.x+=dx/d*speed*dt;e.y+=dy/d*speed*dt;
    if(e.type==='shooter'||e.type==='boss'){
      e.attack-=dt;if(e.attack<0){e.attack=e.type==='boss'?1.5:3.2;
        const n=e.type==='boss'?16:1,base=Math.atan2(dy,dx);
        for(let i=0;i<n;i++){const a=base+i*Math.PI*2/n;hostile.push({x:e.x,y:e.y,vx:Math.cos(a)*155,vy:Math.sin(a)*155,life:6,r:e.type==='boss'?6:4});}
      }
    }
    if(d<e.r+13&&damagePlayer(p,e.damage)){shake=8;burst(p.x,p.y,'#ff7995',12);beep(100,.12,'sawtooth',.04);}
    if(p.orbit){for(let i=0;i<p.orbit;i++){const a=elapsed*2.6+i*Math.PI*2/p.orbit,sx=p.x+Math.cos(a)*70,sy=p.y+Math.sin(a)*70;if(length(e.x-sx,e.y-sy)<e.r+10)hit(e,p.damage*3*dt);}}
    if(state!=='playing')return;
  }
  for(const b of bullets){
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
    for(const e of enemies){if(b.life<=0)break;if(e.hp<=0||b.hits.has(e))continue;if(length(e.x-b.x,e.y-b.y)<e.r+5){hit(e,p.damage);b.hits.add(e);if(--b.remaining<=0)b.life=0;if(state!=='playing')return;}}
  }
  for(const b of hostile){b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;if(length(b.x-p.x,b.y-p.y)<b.r+11&&damagePlayer(p,12)){b.life=0;shake=6;burst(p.x,p.y,'#ff7995',8);}}
  for(const g of gems){const dx=p.x-g.x,dy=p.y-g.y,d=length(dx,dy);if(d<p.magnet){const speed=310+(p.magnet-d)*3;g.x+=dx/(d||1)*Math.min(speed*dt,d);g.y+=dy/(d||1)*Math.min(speed*dt,d);}if(d<18){if(g.heal){p.hp=Math.min(p.maxHp,p.hp+g.heal);}else p.xp+=g.value;g.used=true;}}
  for(const particle of particles){particle.x+=particle.vx*dt;particle.y+=particle.vy*dt;particle.life-=dt;}
  enemies=enemies.filter(e=>e.hp>0&&(e.type==='boss'||length(e.x-p.x,e.y-p.y)<Math.hypot(width,height)+500));bullets=bullets.filter(b=>b.life>0);hostile=hostile.filter(b=>b.life>0);gems=gems.filter(g=>!g.used);particles=particles.filter(v=>v.life>0).slice(-550);
  // Merge distant pickups rather than discarding their earned experience.
  if(gems.length>500){const old=gems.splice(0,100);gems.push({x:old[0].x,y:old[0].y,value:old.reduce((sum,g)=>sum+g.value,0)});}
  if(p.hp<=0){finish(false);return;}
  if(p.xp>=xpNeeded(p.level)){p.xp-=xpNeeded(p.level);p.level++;upgrade();}
  updateHUD();
}
function updateHUD(){
  $('health').style.width=`${p.hp/p.maxHp*100}%`;$('health').style.background=p.hp/p.maxHp<.3?'#ff8099':'#82f4ce';$('hp-text').textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;
  $('level').textContent=`LV. ${p.level}`;$('timer').textContent=formatTime(elapsed);$('kills').textContent=p.kills;$('xp').style.width=`${clamp(p.xp/xpNeeded(p.level)*100,0,100)}%`;
  $('phase').textContent=bossSpawned?'击败守门者':elapsed<60?'星潮将至':elapsed<150?'星潮涌动':elapsed<240?'深渊回响':'守门者即将苏醒';
  $('dash-status').textContent=p.dashCd>0?`冲刺冷却 ${p.dashCd.toFixed(1)}s`:'冲刺就绪 · SPACE';$('dash').disabled=p.dashCd>0;
  if(boss)$('boss-health').style.width=`${Math.max(0,boss.hp/boss.maxHp)*100}%`;
}
function polygon(x,y,r,n,angle=0){ctx.beginPath();for(let i=0;i<n;i++){const a=angle+i*2*Math.PI/n;const px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}ctx.closePath();}
function drawShip(x,y,angle,scale=1){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle+Math.PI/2);ctx.scale(scale,scale);
  const flame=11+Math.sin(visualTime*35)*5;ctx.fillStyle='#82f4ce66';ctx.beginPath();ctx.moveTo(-5,11);ctx.lineTo(0,11+flame);ctx.lineTo(5,11);ctx.fill();
  ctx.shadowColor='#82f4ce';ctx.shadowBlur=15;ctx.fillStyle='#153e3d';ctx.strokeStyle='#a0ffe0';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,-17);ctx.lineTo(12,13);ctx.lineTo(0,7);ctx.lineTo(-12,13);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#effff7';ctx.fillRect(-1.5,-6,3,7);ctx.restore();
}
function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#090e17';ctx.fillRect(0,0,width,height);
  const menu=state==='menu',camX=menu?visualTime*6:p.x,camY=menu?visualTime*3:p.y;
  ctx.save();
  if(!menu&&!reduced&&shake>0)ctx.translate(rand(-shake,shake),rand(-shake,shake));
  const glow=ctx.createRadialGradient(width*.63,height*.45,10,width*.63,height*.45,width*.7);glow.addColorStop(0,'#142b352e');glow.addColorStop(.55,'#10233320');glow.addColorStop(1,'#090e1700');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
  ctx.strokeStyle='#6e9bb70a';ctx.lineWidth=1;const grid=70;ctx.beginPath();for(let x=((width/2-camX)%grid+grid)%grid;x<width;x+=grid){ctx.moveTo(x,0);ctx.lineTo(x,height);}for(let y=((height/2-camY)%grid+grid)%grid;y<height;y+=grid){ctx.moveTo(0,y);ctx.lineTo(width,y);}ctx.stroke();
  for(const s of stars){const x=((s.x-camX*.25)%width+width)%width,y=((s.y-camY*.25)%height+height)%height;ctx.fillStyle=`rgba(174,207,220,${s.a})`;ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill();}
  if(menu){ctx.strokeStyle='#82f4ce08';for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(width*.75,height*.5,180+i*100,0,Math.PI*2);ctx.stroke();}ctx.restore();return;}
  ctx.translate(width/2-p.x,height/2-p.y);
  const visible=(x,y)=>Math.abs(x-p.x)<width/2+65&&Math.abs(y-p.y)<height/2+65;
  for(const g of gems){if(!visible(g.x,g.y))continue;ctx.fillStyle=g.heal?'#ff91b0':'#afa0ff';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=8;polygon(g.x,g.y,g.heal?6:4,4,Math.PI/4);ctx.fill();}ctx.shadowBlur=0;
  for(const b of bullets){ctx.strokeStyle='#a0ffdf';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-b.vx*.018,b.y-b.vy*.018);ctx.stroke();}
  for(const b of hostile){ctx.fillStyle='#ff9aac';ctx.shadowColor='#ff4e84';ctx.shadowBlur=10;ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();}ctx.shadowBlur=0;
  for(const e of enemies){
    if(!visible(e.x,e.y))continue;const color=e.flash>0?'#fff':e.type==='boss'?'#ff7ba6':e.type==='brute'?'#e3b67c':e.type==='swift'?'#ff8b9f':e.type==='shooter'?'#d199f5':'#9a9bf9';
    ctx.strokeStyle=color;ctx.fillStyle=e.flash>0?'#ffffff50':`${color}20`;ctx.lineWidth=e.type==='boss'?3:1.5;
    polygon(e.x,e.y,e.r,e.type==='swift'?3:e.type==='brute'?6:4,Math.atan2(p.y-e.y,p.x-e.x)+(e.type==='boss'?elapsed*.5:0));ctx.fill();ctx.stroke();
    ctx.fillStyle=color;ctx.beginPath();ctx.arc(e.x,e.y,e.type==='boss'?8:2.5,0,Math.PI*2);ctx.fill();
    if(e.hp<e.maxHp&&e.type!=='boss'){ctx.fillStyle='#ffffff20';ctx.fillRect(e.x-e.r,e.y-e.r-8,e.r*2,2);ctx.fillStyle=color;ctx.fillRect(e.x-e.r,e.y-e.r-8,e.r*2*Math.max(0,e.hp/e.maxHp),2);}
  }
  for(let i=0;i<p.orbit;i++){const a=elapsed*2.6+i*Math.PI*2/p.orbit;ctx.strokeStyle='#82f4ce18';ctx.beginPath();ctx.arc(p.x,p.y,70,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#82f4ce';polygon(p.x+Math.cos(a)*70,p.y+Math.sin(a)*70,7,4,elapsed*3);ctx.fill();}
  if(p.invulnerable<=0||Math.floor(visualTime*14)%2===0)drawShip(p.x,p.y,aim);
  if(p.dashTime>0){ctx.strokeStyle='#82f4ce80';ctx.beginPath();ctx.arc(p.x,p.y,24,0,Math.PI*2);ctx.stroke();}
  for(const v of particles){ctx.globalAlpha=clamp(v.life*2,0,1);ctx.fillStyle=v.color;ctx.fillRect(v.x-1.5,v.y-1.5,3,3);}ctx.globalAlpha=1;
  ctx.restore();
  if(pointer.active){ctx.strokeStyle='#82f4ce45';ctx.lineWidth=1;ctx.beginPath();ctx.arc(pointer.ox,pointer.oy,45,0,Math.PI*2);ctx.stroke();const dx=pointer.x-pointer.ox,dy=pointer.y-pointer.oy,d=Math.max(1,length(dx,dy)/45);ctx.fillStyle='#82f4ce50';ctx.beginPath();ctx.arc(pointer.ox+dx/d,pointer.oy+dy/d,16,0,Math.PI*2);ctx.fill();}
}
function frame(now){const dt=Math.min((now-last)/1000,.04)||0;last=now;visualTime+=dt;if(state==='playing')update(dt);shake=Math.max(0,shake-dt*25);if(toastTime>0){toastTime-=dt;if(toastTime<=0)$('toast').classList.remove('visible');}draw();requestAnimationFrame(frame);}
requestAnimationFrame(frame);
