import test from 'node:test';
import assert from 'node:assert/strict';
import {makePlayer,damagePlayer,upgrades,choices,xpNeeded,formatTime} from './core.js';
test('dash and damage grace period prevent repeated contact damage',()=>{
  const p=makePlayer();p.dashTime=.1;assert.equal(damagePlayer(p,20),false);assert.equal(p.hp,100);
  p.dashTime=0;assert.equal(damagePlayer(p,20),true);assert.equal(p.hp,80);
  assert.equal(damagePlayer(p,20),false);assert.equal(p.hp,80);
  p.invulnerable=0;damagePlayer(p,200);assert.equal(p.hp,0);
});
test('upgrade choices are distinct and exclude capped abilities',()=>{
  const build=Object.fromEntries(upgrades.filter(u=>u.max).map(u=>[u.id,u.max]));
  for(let i=0;i<50;i++){
    const picks=choices(build);assert.equal(picks.length,3);assert.equal(new Set(picks.map(u=>u.id)).size,3);assert.ok(picks.every(u=>!u.max));
  }
});
test('all upgrade effects work and healing respects the new maximum',()=>{
  for(const u of upgrades){const p=makePlayer(),before=JSON.stringify(p);u.apply(p);assert.notEqual(JSON.stringify(p),before);assert.ok(p.hp<=p.maxHp);}
  const p=makePlayer();p.hp=10;upgrades.find(u=>u.id==='health').apply(p);assert.equal(p.maxHp,125);assert.equal(p.hp,45);
});
test('fire rate never falls below its cap and experience requirements grow',()=>{
  const p=makePlayer();for(let i=0;i<100;i++)upgrades.find(u=>u.id==='rate').apply(p);assert.equal(p.fireRate,.09);
  for(let i=1;i<80;i++)assert.ok(xpNeeded(i+1)>xpNeeded(i));
  assert.equal(formatTime(300),'05:00');assert.equal(formatTime(69.9),'01:09');
});
