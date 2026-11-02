// Starcatch Valley: math-fact generator.
//
// makeQuestion(op, diff) -> { op, a, b, ans, text, choices }
//   op:   "add" | "sub" | "mul" | "div"   (labels live in OPS in tuning.js)
//   diff: "easy" | "normal" | "hard"      (setup-screen descriptions: DIFF_NOTES)
// choices = the answer + 3 plausible distractors, shuffled; each becomes one of
// the four stars in a gate.
"use strict";

function makeQuestion(op, diff){
  var a,b,ans,text;
  if(op==="add"){
    if(diff==="easy"){ a=ri(2,10); b=ri(2,10); }
    else if(diff==="normal"){ a=ri(11,58); b=ri(6,41); }
    else { a=ri(115,489); b=ri(24,98); }
    ans=a+b; text=a+" + "+b;
  } else if(op==="sub"){
    if(diff==="easy"){ ans=ri(1,9); b=ri(2,10); a=ans+b; }
    else if(diff==="normal"){ b=ri(7,44); ans=ri(6,52); a=ans+b; }
    else { b=ri(28,97); ans=ri(35,299); a=ans+b; }
    text=a+" − "+b;
  } else if(op==="mul"){
    if(diff==="easy"){ a=ri(2,5); b=ri(2,10); }
    else if(diff==="normal"){ a=ri(2,12); b=ri(2,12); }
    else { a=ri(12,25); b=ri(3,9); }
    ans=a*b; text=a+" × "+b;
  } else {
    if(diff==="easy"){ b=ri(2,5); ans=ri(2,10); }
    else if(diff==="normal"){ b=ri(2,12); ans=ri(2,12); }
    else { b=ri(3,9); ans=ri(11,24); }
    a=b*ans; text=a+" ÷ "+b;
  }
  return {op:op, a:a, b:b, ans:ans, text:text, choices:choicesFor(op,a,b,ans)};
}
function choicesFor(op,a,b,ans){
  var pool;
  if(op==="mul") pool=[ans+a,ans-a,ans+b,ans-b,ans+1,ans-1,ans+10,ans-10,a+b];
  else if(op==="div") pool=[ans+1,ans-1,ans+2,ans-2,ans+b,Math.max(1,ans-b),b,ans*2];
  else if(op==="add") pool=[ans+1,ans-1,ans+10,ans-10,ans+9,ans-9,ans+2,ans-2,ans+100];
  else pool=[ans+1,ans-1,ans+10,ans-10,ans+9,ans-9,ans+2,ans-2,a+b];
  var seen={}, out=[]; seen[ans]=true;
  shuffle(pool);
  for(var i=0;i<pool.length && out.length<3;i++){
    var v=pool[i];
    if(v<0 || !isFinite(v) || seen[v]) continue;
    seen[v]=true; out.push(v);
  }
  var guard=0;
  while(out.length<3 && guard++<60){
    var v2=ans+ri(-12,12);
    if(v2<0 || seen[v2]) continue;
    seen[v2]=true; out.push(v2);
  }
  return shuffle(out.concat([ans]));
}
