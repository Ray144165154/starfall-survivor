export const DURATION = 300;
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const length = (x, y) => Math.hypot(x, y);
export const xpNeeded = level => Math.round(7 + level * 5 + level ** 1.5);
export const formatTime = time => `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`;
export function makePlayer() {
  return { x:0,y:0,hp:100,maxHp:100,speed:205,damage:18,fireRate:.52,projectiles:1,pierce:0,magnet:100,regen:0,orbit:0,level:1,xp:0,kills:0,dashCd:0,dashTime:0,invulnerable:0,dx:0,dy:-1 };
}
export const upgrades = [
  {id:'damage',icon:'✦',name:'高能弹芯',description:'子弹伤害提高 30%',apply:p=>{p.damage*=1.3;}},
  {id:'rate',icon:'≋',name:'脉冲加速',description:'射击间隔缩短 18%',apply:p=>{p.fireRate=Math.max(.09,p.fireRate*.82);}},
  {id:'multi',icon:'⋔',name:'分裂弹道',description:'每次额外发射一枚子弹',max:5,apply:p=>{p.projectiles++;}},
  {id:'speed',icon:'➶',name:'离子推进',description:'移动速度提高 15%',max:5,apply:p=>{p.speed*=1.15;}},
  {id:'health',icon:'♡',name:'装甲重构',description:'生命上限 +25，立即恢复 35 点',apply:p=>{p.maxHp+=25;p.hp=Math.min(p.maxHp,p.hp+35);}},
  {id:'magnet',icon:'◎',name:'星能引力',description:'拾取范围提高 50%',max:5,apply:p=>{p.magnet*=1.5;}},
  {id:'pierce',icon:'⟶',name:'相位穿透',description:'子弹额外穿透一个敌人',max:4,apply:p=>{p.pierce++;}},
  {id:'regen',icon:'✚',name:'纳米修复',description:'每秒恢复 1.2 点生命',max:5,apply:p=>{p.regen+=1.2;}},
  {id:'orbit',icon:'◌',name:'环轨卫星',description:'新增一颗环绕飞船的伤害卫星',max:5,apply:p=>{p.orbit++;}}
];
export function choices(build, random = Math.random) {
  const pool = upgrades.filter(u=>!u.max||(build[u.id]||0)<u.max);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return pool.slice(0,3);
}
export function damagePlayer(p, amount) {
  if(p.invulnerable>0||p.dashTime>0)return false;
  p.hp=clamp(p.hp-amount,0,p.maxHp);p.invulnerable=.75;return true;
}
