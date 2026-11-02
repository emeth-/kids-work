// Starcatch Valley: small math helpers + value noise for the terrain.
"use strict";

function clamp(v,a,b){ return v<a?a:(v>b?b:v); }
function smooth(a,b,x){ var t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
function ri(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }
function shuffle(arr){
  for(var i=arr.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=arr[i]; arr[i]=arr[j]; arr[j]=t; }
  return arr;
}
function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }
function esc(s){
  return String(s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; });
}
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }

/* value noise for natural terrain */
function hash2(ix,iy){
  var h = Math.imul(ix|0, 374761393) ^ Math.imul(iy|0, 668265263);
  h = Math.imul(h ^ (h>>>13), 1274126177);
  h ^= h>>>16;
  return (h>>>0)/4294967295;
}
function vnoise(x,y){
  var ix=Math.floor(x), iy=Math.floor(y), fx=x-ix, fy=y-iy;
  var a=hash2(ix,iy), b=hash2(ix+1,iy), c=hash2(ix,iy+1), d=hash2(ix+1,iy+1);
  var ux=fx*fx*(3-2*fx), uy=fy*fy*(3-2*fy);
  return a+(b-a)*ux+(c-a)*uy+(a-b-c+d)*ux*uy;
}
function fbm(x,y,oct){
  var s=0,a=0.5,f=1,n=0;
  for(var i=0;i<oct;i++){ s+=a*vnoise(x*f,y*f); n+=a; a*=0.5; f*=2.03; }
  return s/n;
}
function ridged(x,y,oct){
  var s=0,a=0.5,f=1,n=0;
  for(var i=0;i<oct;i++){ var v=1-Math.abs(vnoise(x*f,y*f)*2-1); s+=a*v*v; n+=a; a*=0.5; f*=2.1; }
  return s/n;
}
