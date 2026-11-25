const om=require('./oldMaid.js');
let bad=0; const fail=(m)=>{bad++; if(bad<15)console.log('FAIL',m)};
const turnsHist=[], reasons={joker:0,empty:0,left:0}; let caps=0, games=0, byN={};
function check(s,tag){
  const alive=om.aliveOf(s);
  let jokers=0,total=0;
  for(const id of s.order){const h=s.hands[id]; total+=h.length; if(id in s.out){ if(h.length)fail(tag+' dead has cards'); } else { if(s.phase!=='over'&&h.length===0&&s.phase!=='dealing')fail(tag+' alive empty '+id); jokers+=h.filter(c=>c===om.JOKER).length; if(s.counts[id]!==h.length)fail(tag+' count');
    // no duplicate ranks held (pairs always thrown) except orphans tolerance: at most one rank repeated? enforce none
    const ranks=h.filter(c=>c!==om.JOKER).map(om.rankOf); if(new Set(ranks).size!==ranks.length)fail(tag+' pair left in hand '+h.join(','));}}
  if(jokers!==1&&alive.length>0)fail(tag+' jokers='+jokers);
  if(total+2*s.discards.length>om.HAND_SIZE*s.order.length)fail(tag+' too many cards');
  if(s.phase==='turn'){ if(!om.isAlive(s,s.current)||!om.isAlive(s,s.target)||s.current===s.target)fail(tag+' bad current/target'); if(om.rightOf(s,s.current)!==s.target)fail(tag+' target not right of current'); }
}
for(let g=0;g<6000;g++){
  const n=4+(g%5); const order=Array.from({length:n},(_,i)=>'p'+i);
  let rnd=0.123+g; const R=()=>{rnd=(rnd*9301+49297)%233280;return rnd/233280};
  let now=1000; let s=om.newGame(order,'g'+g,now); check(s,'new');
  // determinism
  const s2=om.newGame(order,'g'+g,now); if(JSON.stringify(s)!==JSON.stringify(s2))fail('nondeterministic');
  const forfeits = (g%7===0)? [order[Math.floor(R()*n)]] : [];
  let left=[], steps=0, forfeitAt=Math.floor(R()*30);
  while(s.phase!=='over' && steps<20000){
    steps++;
    if(steps===forfeitAt && forfeits.length) left=forfeits;
    // a bot answers some turns itself, otherwise the timer plays for it
    if(s.phase==='turn' && R()<0.8){ const size=s.hands[s.target].length; const mv={uid:s.current,rev:s.rev,kind:'draw',index:Math.floor(R()*size)};
      // stale move must be ignored
      const stale=om.apply(s,{...mv,rev:s.rev-1},now); if(stale!==s)fail('stale accepted');
      const wrong=om.apply(s,{...mv,uid:s.target},now); if(wrong!==s)fail('wrong player accepted');
      const oob=om.apply(s,{...mv,index:size},now); if(oob!==s)fail('out of range accepted');
      s=om.apply(s,mv,now);
    } else { now = Math.max(now+50, s.endsAt||now); s=om.tick(s,now,left); }
    s=om.tick(s,now,left);
    check(s,'step'+steps);
  }
  if(s.phase!=='over'){fail('did not end');continue}
  games++; turnsHist.push(s.turn); if(s.cap)caps++;
  for(const w of Object.values(s.out)) reasons[w]++;
  const alive=om.aliveOf(s);
  if(!s.cap){ if(alive.length!==1)fail('end alive='+alive.length); }
  if(!s.winner)fail('no winner'); else { if(!om.isAlive(s,s.winner))fail('winner dead'); if(!s.hands[s.winner].includes(om.JOKER))fail('winner lacks joker'); if(Object.keys(s.out).includes(s.winner))fail('winner out'); }
  (byN[n]=byN[n]||[]).push(s.turn);
}
const avg=a=>(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1);
console.log('games',games,'bad',bad,'caps',caps,'avg turns',avg(turnsHist),'max',Math.max(...turnsHist),'elim reasons',JSON.stringify(reasons));
console.log('avg turns by players',Object.entries(byN).map(([n,a])=>n+':'+avg(a)).join('  '));
// deck sanity
for(let n=4;n<=8;n++){const d=om.buildDeck(n,'x'); const jk=d.filter(c=>c==='JK').length; const cnt={}; d.filter(c=>c!=='JK').forEach(c=>cnt[om.rankOf(c)]=(cnt[om.rankOf(c)]||0)+1); const odd=Object.values(cnt).filter(v=>v%2).length; console.log('n',n,'cards',d.length,'jokers',jk,'ranks with an odd count',odd);}
