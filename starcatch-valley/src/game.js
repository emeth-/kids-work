// Starcatch Valley: world, race logic, HUD, input, and the main loop.
// Sections are marked with ===== banner comments.
(function(){
  "use strict";
  function $(id){ return document.getElementById(id); }
  var app = $("app");

  if(!window.THREE){
    $("overlay").innerHTML = '<div class="panel"><h2>The valley didn’t load</h2>'
      + '<p class="lede">The 3D engine (vendor/three.min.js) is missing or failed to load.</p></div>';
    return;
  }
  var T = window.THREE;
  var CALM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
  var COARSE = !!(window.matchMedia && matchMedia("(pointer: coarse)").matches);

  // Tuning constants: tuning.js. Helpers + noise: util.js. Math facts:
  // questions.js. All are loaded (as globals) before this file.

  /* the valley winds gently; everything is placed relative to its centre line */
  function cx(s){ return 10*Math.sin(s*0.004) + 3*Math.sin(s*0.011 + 1.3); }
  function dcx(s){ return 0.04*Math.cos(s*0.004) + 0.033*Math.cos(s*0.011 + 1.3); }
  function height(xl, s){
    var d=Math.abs(xl), X=cx(s)+xl, Z=s;
    var bank = smooth(10,18,d)*2.0;
    var valley = Math.pow(smooth(14,125,d),1.5);
    var mount = (0.55 + 0.9*ridged(X*0.006+3.1, Z*0.006, 4))*78;
    var rolling = (fbm(X*0.02, Z*0.02, 4)-0.5)*16 + (fbm(X*0.08+7, Z*0.08, 3)-0.5)*4;
    return -0.6 + bank + valley*mount + smooth(12,40,d)*rolling + Math.max(0,d-100)*0.35;
  }
  function slopeAt(xl,s){
    var hx=(height(xl+2,s)-height(xl-2,s))/4, hz=(height(xl,s+2)-height(xl,s-2))/4;
    return Math.sqrt(hx*hx+hz*hz);
  }

  /* =========================================================
     Records (this browser only)
     ========================================================= */
  function loadRec(){
    try{
      var o = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if(!o) return {flights:0, wins:0, best:{}};
      return {flights:o.flights||0, wins:o.wins||0, best:o.best||{}};
    }catch(e){ return {flights:0, wins:0, best:{}}; }
  }
  function saveRec(r){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(r)); }catch(e){} }
  var REC = loadRec();
  function nextMode(){ return REC.flights%2===0 ? "day" : "night"; }


  /* =========================================================
     Renderer, camera, light
     ========================================================= */
  var renderer = new T.WebGLRenderer({antialias:true, powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.setAttribute("aria-label","3D view from your bird");
  $("stage").appendChild(renderer.domElement);
  var MAX_ANISO = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;

  var scene = new T.Scene();
  scene.fog = new T.Fog(0xC7DAEA, 170, 900);

  var camera = new T.PerspectiveCamera(68, window.innerWidth/window.innerHeight, 0.1, 2800);
  camera.rotation.order = "YXZ";
  scene.add(camera);

  var hemi = new T.HemisphereLight(0xD8E6FF, 0x6B5A3A, 0.78);
  scene.add(hemi);
  var keyLight = new T.DirectionalLight(0xFFF1DC, 0.95);
  keyLight.position.set(-0.42, 0.9, -1);
  scene.add(keyLight);
  var fillLight = new T.DirectionalLight(0x9FB8FF, 0.32);
  fillLight.position.set(0.3, 0.6, 1);
  scene.add(fillLight);

  window.addEventListener("resize", function(){
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
  });

  /* =========================================================
     Canvas textures
     ========================================================= */
  function gradientTexture(stops){
    var c=document.createElement("canvas"); c.width=4; c.height=512;
    var g=c.getContext("2d"), gr=g.createLinearGradient(0,0,0,512);
    stops.forEach(function(s){ gr.addColorStop(s[0], s[1]); });
    g.fillStyle=gr; g.fillRect(0,0,4,512);
    return new T.CanvasTexture(c);
  }
  function radialTexture(){
    var c=document.createElement("canvas"); c.width=c.height=128;
    var g=c.getContext("2d"), gr=g.createRadialGradient(64,64,0,64,64,64);
    gr.addColorStop(0,"rgba(255,255,255,1)"); gr.addColorStop(.35,"rgba(255,255,255,.45)"); gr.addColorStop(1,"rgba(255,255,255,0)");
    g.fillStyle=gr; g.fillRect(0,0,128,128);
    return new T.CanvasTexture(c);
  }
  function sunTexture(){
    var c=document.createElement("canvas"); c.width=c.height=256;
    var g=c.getContext("2d"), gr=g.createRadialGradient(128,128,0,128,128,128);
    gr.addColorStop(0,"rgba(255,255,250,1)"); gr.addColorStop(.12,"rgba(255,252,236,1)");
    gr.addColorStop(.2,"rgba(255,240,200,.55)"); gr.addColorStop(.45,"rgba(255,230,180,.16)"); gr.addColorStop(1,"rgba(255,230,180,0)");
    g.fillStyle=gr; g.fillRect(0,0,256,256);
    return new T.CanvasTexture(c);
  }
  function moonTexture(){
    var c=document.createElement("canvas"); c.width=c.height=256;
    var g=c.getContext("2d");
    var gl=g.createRadialGradient(128,128,40,128,128,128);
    gl.addColorStop(0,"rgba(190,210,255,.35)"); gl.addColorStop(1,"rgba(190,210,255,0)");
    g.fillStyle=gl; g.fillRect(0,0,256,256);
    g.beginPath(); g.arc(128,128,46,0,Math.PI*2);
    var disc=g.createRadialGradient(118,118,4,128,128,46);
    disc.addColorStop(0,"#FAFBFF"); disc.addColorStop(1,"#D9DEEA");
    g.fillStyle=disc; g.fill();
    g.save(); g.clip();
    [[110,112,13],[140,120,9],[124,146,11],[146,146,6],[104,138,6],[132,100,5]].forEach(function(m){
      g.beginPath(); g.arc(m[0],m[1],m[2],0,Math.PI*2); g.fillStyle="rgba(150,158,180,.38)"; g.fill();
    });
    g.restore();
    return new T.CanvasTexture(c);
  }
  function star10Path(g, x, y, R, r){
    g.beginPath();
    for(var i=0;i<20;i++){
      var rad=(i%2===0)?R:r, a=-Math.PI/2 + i*Math.PI/10;
      var px=x+Math.cos(a)*rad, py=y+Math.sin(a)*rad;
      if(i===0) g.moveTo(px,py); else g.lineTo(px,py);
    }
    g.closePath();
  }
  function sparkTexture(){
    var c=document.createElement("canvas"); c.width=c.height=64;
    var g=c.getContext("2d");
    g.shadowColor="#fff"; g.shadowBlur=6;
    g.fillStyle="#fff"; star10Path(g,32,32,28,11); g.fill();
    return new T.CanvasTexture(c);
  }
  function shimmerTexture(){
    var c=document.createElement("canvas"); c.width=64; c.height=256;
    var g=c.getContext("2d");
    for(var i=0;i<70;i++){
      var y=Math.random()*256, x=Math.random()*64, w=6+Math.random()*26;
      g.fillStyle="rgba(255,250,240,"+(0.15+Math.random()*0.5).toFixed(2)+")";
      g.fillRect(x,y,w,1.2);
    }
    var t=new T.CanvasTexture(c);
    t.wrapS=t.wrapT=T.RepeatWrapping;
    return t;
  }
  function groundTexture(){
    /* fine grain multiplied over the terrain colours: grass blades, grit and pebbles */
    var N=256, c=document.createElement("canvas"); c.width=c.height=N;
    var g=c.getContext("2d"), img=g.createImageData(N,N), d=img.data;
    for(var y=0;y<N;y++) for(var x=0;x<N;x++){
      var v = 0.80 + 0.12*vnoise(x*0.09, y*0.09) + 0.08*Math.random();
      if(Math.random()<0.015) v*=0.78;
      var k=(y*N+x)*4, b=Math.round(clamp(v,0,1)*255);
      d[k]=b; d[k+1]=b; d[k+2]=b; d[k+3]=255;
    }
    g.putImageData(img,0,0);
    var t=new T.CanvasTexture(c);
    t.wrapS=t.wrapT=T.RepeatWrapping;
    t.anisotropy=MAX_ANISO;
    return t;
  }
  function cloudTexture(){
    var c=document.createElement("canvas"); c.width=512; c.height=256;
    var g=c.getContext("2d");
    for(var i=0;i<52;i++){
      var x=70+Math.random()*372;
      var centre=1-Math.abs(x-256)/210;
      var y=182-Math.random()*95*Math.max(0.15,centre);
      var r=(22+Math.random()*40)*(0.55+0.6*Math.max(0,centre));
      var gr=g.createRadialGradient(x,y,0,x,y,r);
      gr.addColorStop(0,"rgba(255,255,255,.95)"); gr.addColorStop(.55,"rgba(255,255,255,.6)"); gr.addColorStop(1,"rgba(255,255,255,0)");
      g.fillStyle=gr; g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fill();
    }
    g.globalCompositeOperation="source-atop";
    var sh=g.createLinearGradient(0,90,0,215);
    sh.addColorStop(0,"rgba(255,255,255,0)"); sh.addColorStop(1,"rgba(146,156,178,.6)");
    g.fillStyle=sh; g.fillRect(0,0,512,256);
    return new T.CanvasTexture(c);
  }
  var GLOW = radialTexture();
  var SPARK = sparkTexture();

  /* =========================================================
     The valley
     ========================================================= */
  (function buildTerrain(){
    var W=440, NX=110, S0=-150, S1=RACE_LEN+760, DZ=7, NZ=Math.ceil((S1-S0)/DZ);
    var cols=NX+1, rows=NZ+1, n=cols*rows;
    var pos=new Float32Array(n*3), uv=new Float32Array(n*2), col=new Float32Array(n*3), hs=new Float32Array(n), ds=new Float32Array(n);
    var k=0, i, j;
    for(j=0;j<rows;j++){
      var s=S0+j*DZ, c0=cx(s);
      for(i=0;i<cols;i++){
        var xl=-W/2+i*(W/NX), h=height(xl,s);
        pos[k*3]=c0+xl; pos[k*3+1]=h; pos[k*3+2]=-s;
        uv[k*2]=(c0+xl)/9; uv[k*2+1]=s/9;
        hs[k]=h; ds[k]=Math.abs(xl);
        k++;
      }
    }
    var idx=new Uint32Array((cols-1)*(rows-1)*6), q=0;
    for(j=0;j<rows-1;j++) for(i=0;i<cols-1;i++){
      var a=j*cols+i, b=a+1, c=a+cols, d=c+1;
      idx[q++]=a; idx[q++]=b; idx[q++]=c; idx[q++]=b; idx[q++]=d; idx[q++]=c;
    }
    var g=new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos,3));
    g.setAttribute("uv", new T.BufferAttribute(uv,2));
    g.setIndex(new T.BufferAttribute(idx,1));
    g.computeVertexNormals();

    var nrm=g.attributes.normal.array;
    var cLush=new T.Color(0x547F30), cDry=new T.Color(0x8D914E), cForest=new T.Color(0x35532A),
        cRock=new T.Color(0x77716A), cSnow=new T.Color(0xF2F4F6), cSand=new T.Color(0x9C8F6D), c=new T.Color();
    for(k=0;k<n;k++){
      var hh=hs[k], dd=ds[k], ny=nrm[k*3+1], X=pos[k*3], Z=-pos[k*3+2];
      c.copy(cLush).lerp(cDry, clamp((fbm(X*0.012, Z*0.012, 3)-0.38)*2.4,0,1));
      c.lerp(cForest, clamp((fbm(X*0.03+40, Z*0.03, 2)-0.45)*2.6,0,1)*smooth(18,40,dd)*0.8);
      var rockF=Math.max(smooth(0.74,0.5,ny), smooth(74,104,hh)*0.6);
      c.lerp(cRock, clamp(rockF,0,1));
      var snowF=smooth(88,108, hh+(fbm(X*0.05,Z*0.05,2)-0.5)*16)*smooth(0.5,0.72,ny);
      c.lerp(cSnow, snowF);
      c.lerp(cSand, (1-smooth(11.5,15.5,dd))*(1-smooth(0.5,3,hh)));
      var jit=0.95+Math.random()*0.1;
      col[k*3]=c.r*jit; col[k*3+1]=c.g*jit; col[k*3+2]=c.b*jit;
    }
    g.setAttribute("color", new T.BufferAttribute(col,3));
    scene.add(new T.Mesh(g, new T.MeshLambertMaterial({vertexColors:true, map:groundTexture()})));
  })();

  var riverShimmer;
  (function buildRiver(){
    var S0=-150, S1=RACE_LEN+760, DZ=8, NZ=Math.ceil((S1-S0)/DZ), XS=[-11.5,-4,4,11.5];
    var rows=NZ+1, cols=4, pos=new Float32Array(rows*cols*3), uv=new Float32Array(rows*cols*2), k=0, i, j;
    for(j=0;j<rows;j++){
      var s=S0+j*DZ, c0=cx(s), widen=1+0.15*Math.sin(s*0.01);
      for(i=0;i<cols;i++){
        pos[k*3]=c0+XS[i]*widen; pos[k*3+1]=0.15; pos[k*3+2]=-s;
        uv[k*2]=i/3; uv[k*2+1]=s/30;
        k++;
      }
    }
    var idx=[];
    for(j=0;j<rows-1;j++) for(i=0;i<cols-1;i++){
      var a=j*cols+i, b=a+1, c=a+cols, d=c+1;
      idx.push(a,b,c, b,d,c);
    }
    var g=new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos,3));
    g.setAttribute("uv", new T.BufferAttribute(uv,2));
    g.setIndex(idx);
    g.computeVertexNormals();
    scene.add(new T.Mesh(g, new T.MeshPhongMaterial({color:0x2B5F70, emissive:0x081A24, specular:0x556677, shininess:70})));
    var g2=g.clone(); g2.translate(0,0.08,0);
    riverShimmer=new T.MeshBasicMaterial({map:shimmerTexture(), transparent:true, opacity:.18, blending:T.AdditiveBlending, depthWrite:false});
    scene.add(new T.Mesh(g2, riverShimmer));
  })();

  (function buildForest(){
    var dummy=new T.Object3D(), col=new T.Color(), n, guard, s, side, d, xl, h, sc;
    var bark=new T.MeshLambertMaterial({color:0x4A3626});

    /* conifers: two stacked cones on a trunk */
    var N1=1500;
    var coneA=new T.ConeGeometry(1.75,5.4,9); coneA.translate(0,4.2,0);
    var coneB=new T.ConeGeometry(1.15,3.8,9); coneB.translate(0,6.9,0);
    var trunk=new T.CylinderGeometry(0.18,0.26,2.2,6); trunk.translate(0,1.1,0);
    var leaf=new T.MeshLambertMaterial({color:0xffffff});
    var A=new T.InstancedMesh(coneA,leaf,N1), B=new T.InstancedMesh(coneB,leaf,N1), TK=new T.InstancedMesh(trunk,bark,N1);
    var greens=[0x1F3D22,0x264A29,0x2E5430,0x1B3420,0x34592F];
    n=0; guard=0;
    while(n<N1 && guard++<N1*6){
      s=-120+Math.random()*(RACE_LEN+820);
      side=Math.random()<.5?-1:1;
      d=15+Math.pow(Math.random(),1.3)*85;
      xl=side*d; h=height(xl,s);
      if(h<0.8 || h>72 || slopeAt(xl,s)>1.1) continue;
      sc=0.75+Math.random()*0.9;
      dummy.position.set(cx(s)+xl, h-0.4, -s);
      dummy.scale.set(sc, sc*(0.85+Math.random()*0.45), sc);
      dummy.rotation.set(0, Math.random()*6.28, 0);
      dummy.updateMatrix();
      A.setMatrixAt(n,dummy.matrix); B.setMatrixAt(n,dummy.matrix); TK.setMatrixAt(n,dummy.matrix);
      col.setHex(pick(greens)).multiplyScalar(0.88+Math.random()*0.24);
      A.setColorAt(n,col); B.setColorAt(n,col);
      n++;
    }
    [A,B,TK].forEach(function(m){ m.count=n; m.instanceMatrix.needsUpdate=true; if(m.instanceColor) m.instanceColor.needsUpdate=true; scene.add(m); });

    /* broadleaf trees: a lumpy round crown */
    var N2=700;
    var crown=new T.SphereGeometry(2.1,9,7), cp=crown.attributes.position;
    for(var v=0; v<cp.count; v++){
      var px=cp.getX(v), py=cp.getY(v), pz=cp.getZ(v), f=0.82+0.36*vnoise(px*1.7+5, pz*1.7+py*1.3);
      cp.setXYZ(v, px*f, py*f*0.85, pz*f);
    }
    crown.computeVertexNormals(); crown.translate(0,3.8,0);
    var trunk2=new T.CylinderGeometry(0.2,0.3,2.6,6); trunk2.translate(0,1.3,0);
    var C=new T.InstancedMesh(crown,new T.MeshLambertMaterial({color:0xffffff}),N2), TK2=new T.InstancedMesh(trunk2,bark,N2);
    var leafy=[0x3E6B2A,0x4B7A30,0x58843A,0x6B8A3A,0x46702C,0x7E8D3D];
    n=0; guard=0;
    while(n<N2 && guard++<N2*8){
      s=-120+Math.random()*(RACE_LEN+820);
      side=Math.random()<.5?-1:1;
      d=13.5+Math.pow(Math.random(),1.5)*55;
      xl=side*d; h=height(xl,s);
      if(h<0.6 || h>32 || slopeAt(xl,s)>0.75) continue;
      sc=0.7+Math.random()*0.8;
      dummy.position.set(cx(s)+xl, h-0.3, -s);
      dummy.scale.set(sc, sc*(0.9+Math.random()*0.3), sc);
      dummy.rotation.set(0, Math.random()*6.28, 0);
      dummy.updateMatrix();
      C.setMatrixAt(n,dummy.matrix); TK2.setMatrixAt(n,dummy.matrix);
      col.setHex(pick(leafy)).multiplyScalar(0.88+Math.random()*0.24);
      C.setColorAt(n,col);
      n++;
    }
    [C,TK2].forEach(function(m){ m.count=n; m.instanceMatrix.needsUpdate=true; if(m.instanceColor) m.instanceColor.needsUpdate=true; scene.add(m); });

    /* boulders along the banks and slopes */
    var N3=420, rock=new T.DodecahedronGeometry(1,0);
    var R=new T.InstancedMesh(rock,new T.MeshLambertMaterial({color:0xffffff}),N3);
    var greys=[0x7A766F,0x6B675F,0x85807A,0x5F5B55];
    n=0; guard=0;
    while(n<N3 && guard++<N3*5){
      s=-120+Math.random()*(RACE_LEN+820);
      side=Math.random()<.5?-1:1;
      d=12+Math.pow(Math.random(),1.2)*50;
      xl=side*d; h=height(xl,s);
      sc=0.35+Math.pow(Math.random(),2)*1.6;
      dummy.position.set(cx(s)+xl, h-sc*0.35, -s);
      dummy.scale.set(sc*(0.8+Math.random()*0.5), sc*(0.55+Math.random()*0.4), sc*(0.8+Math.random()*0.5));
      dummy.rotation.set(Math.random()*3, Math.random()*6.28, Math.random()*3);
      dummy.updateMatrix();
      R.setMatrixAt(n,dummy.matrix);
      col.setHex(pick(greys)).multiplyScalar(0.9+Math.random()*0.2);
      R.setColorAt(n,col);
      n++;
    }
    R.count=n; R.instanceMatrix.needsUpdate=true; if(R.instanceColor) R.instanceColor.needsUpdate=true;
    scene.add(R);
  })();

  /* far mountain ranges: rings that travel with you, already hazy with distance */
  var rings=[];
  function buildRing(R, base, amp, seed, topHex, snowAt){
    var N=420, rowsPer=3, pos=new Float32Array((N+1)*rowsPer*3), col=new Float32Array((N+1)*rowsPer*3);
    var cHaze=new T.Color(0xC7DAEA), cTop=new T.Color(topHex), cSnow=new T.Color(0xEEF3F8), cc=new T.Color();
    for(var i=0;i<=N;i++){
      var a=i/N*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a);
      var h=base+amp*ridged(ca*2.2+seed, sa*2.2+seed, 5);
      var ys=[-60, h*0.7, h];
      for(var r=0;r<rowsPer;r++){
        var k=(i*rowsPer+r)*3;
        pos[k]=ca*R; pos[k+1]=ys[r]; pos[k+2]=sa*R;
        if(r===0) cc.copy(cHaze);
        else if(r===1) cc.copy(cTop).lerp(cHaze,0.15);
        else cc.copy(h>snowAt ? cSnow : cTop);
        col[k]=cc.r; col[k+1]=cc.g; col[k+2]=cc.b;
      }
    }
    var idx=[];
    for(i=0;i<N;i++) for(var rr=0;rr<rowsPer-1;rr++){
      var p0=i*rowsPer+rr, p1=p0+1, q0=(i+1)*rowsPer+rr, q1=q0+1;
      idx.push(p0,q0,p1, p1,q0,q1);
    }
    var g=new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos,3));
    g.setAttribute("color", new T.BufferAttribute(col,3));
    g.setIndex(idx);
    var m=new T.Mesh(g, new T.MeshBasicMaterial({vertexColors:true, fog:false, side:T.DoubleSide}));
    scene.add(m); rings.push(m);
  }
  buildRing(1750, 110, 300, 11.3, 0x9AB0C8, 300);
  buildRing(1350, 50, 175, 4.7, 0x7C95B0, 9999);

  /* clouds */
  var cloudMats=[cloudTexture(),cloudTexture(),cloudTexture()].map(function(t){
    return new T.SpriteMaterial({map:t, transparent:true, depthWrite:false, fog:false, opacity:.92});
  });
  (function buildClouds(){
    for(var i=0;i<54;i++){
      var s=-300+Math.random()*(RACE_LEN+1500), side=Math.random()<.5?-1:1;
      var sp=new T.Sprite(pick(cloudMats));
      var w=220+Math.random()*280;
      sp.scale.set(w, w*0.5, 1);
      sp.position.set(cx(s)+side*(110+Math.random()*700), 170+Math.random()*170, -s);
      scene.add(sp);
    }
  })();

  /* sun by day, moon and stars by night */
  var sunSprite=new T.Sprite(new T.SpriteMaterial({map:sunTexture(), transparent:true, depthWrite:false, fog:false, blending:T.AdditiveBlending}));
  sunSprite.scale.set(330,330,1);
  scene.add(sunSprite);
  var moonSprite=new T.Sprite(new T.SpriteMaterial({map:moonTexture(), transparent:true, depthWrite:false, fog:false}));
  moonSprite.scale.set(190,190,1);
  scene.add(moonSprite);
  var SUN_DIR=new T.Vector3(-0.42,0.45,-1).normalize(), MOON_DIR=new T.Vector3(0.45,0.52,-1).normalize();

  var nightSky=new T.Group();
  (function buildStars(){
    function layer(N, size, op){
      var p=new Float32Array(N*3), R=1600;
      for(var i=0;i<N;i++){
        var az=Math.random()*Math.PI*2, el=(10+Math.random()*78)*Math.PI/180;
        p[i*3]=Math.cos(el)*Math.cos(az)*R; p[i*3+1]=Math.sin(el)*R; p[i*3+2]=Math.cos(el)*Math.sin(az)*R;
      }
      var g=new T.BufferGeometry(); g.setAttribute("position", new T.BufferAttribute(p,3));
      nightSky.add(new T.Points(g, new T.PointsMaterial({color:0xffffff, size:size, sizeAttenuation:false, transparent:true, opacity:op, fog:false, depthWrite:false})));
    }
    layer(1200, 1.3, .75);
    layer(170, 2.3, .95);
    scene.add(nightSky);
  })();

  /* ---------- ten-pointed rainbow stars ---------- */
  function starGeometry(R, r, depth){
    var sh=new T.Shape();
    for(var i=0;i<20;i++){
      var rad=(i%2===0)?R:r, a=Math.PI/2 + i*Math.PI/10;
      var x=Math.cos(a)*rad, y=Math.sin(a)*rad;
      if(i===0) sh.moveTo(x,y); else sh.lineTo(x,y);
    }
    sh.closePath();
    var g=new T.ExtrudeGeometry(sh, {depth:depth, bevelEnabled:true, bevelThickness:depth*0.4, bevelSize:R*0.07, bevelSegments:2, curveSegments:1, steps:1});
    g.center();
    var pos=g.attributes.position, n=pos.count, col=new Float32Array(n*3), c=new T.Color();
    for(var k=0;k<n;k++){
      var hue=((Math.atan2(pos.getY(k),pos.getX(k))/(Math.PI*2))+1)%1;
      c.setHSL(hue, 0.95, pos.getZ(k)>0 ? 0.6 : 0.42);
      col[k*3]=c.r; col[k*3+1]=c.g; col[k*3+2]=c.b;
    }
    g.setAttribute("color", new T.BufferAttribute(col,3));
    return g;
  }
  var STAR_GEO = starGeometry(STAR_R, STAR_R*0.45, 1.1);
  var STAR_MAT_DAY = new T.MeshPhongMaterial({vertexColors:true, flatShading:true, shininess:80, specular:0xffffff, emissive:0x26143E, fog:false});
  var STAR_MAT_NIGHT = new T.MeshBasicMaterial({vertexColors:true, fog:false});
  var STAR_MAT = STAR_MAT_DAY;

  /* a few magic rainbow stars hang in the night sky */
  var decoStars = new T.Group();
  (function(){
    for(var i=0;i<22;i++){
      var s=i*175+Math.random()*90, side=Math.random()<.5?-1:1;
      var m=new T.Mesh(STAR_GEO, STAR_MAT);
      m.position.set(cx(s)+side*(30+Math.random()*80), 70+Math.random()*60, -s);
      m.scale.setScalar(1.2+Math.random()*1.3);
      m.userData.spin=0.4+Math.random()*0.5;
      m.rotation.y=Math.random()*6;
      decoStars.add(m);
    }
    scene.add(decoStars);
  })();

  /* ---------- the rainbow at the finish ---------- */
  var archMats=[];
  (function buildArch(){
    var arch=new T.Group(), bands=[0xFF3B3B,0xFF9F1C,0xFFE14D,0x45C96A,0x3A86FF,0x5B4FD9,0x9A4FD6];
    bands.forEach(function(hex,i){
      var m=new T.MeshBasicMaterial({color:hex, fog:false, transparent:true, opacity:.62, depthWrite:false});
      archMats.push(m);
      arch.add(new T.Mesh(new T.TorusGeometry(48-i*1.7, 0.9, 8, 72, Math.PI), m));
    });
    arch.position.set(cx(RACE_LEN), -4, -RACE_LEN);
    arch.rotation.y=-Math.atan(dcx(RACE_LEN));
    scene.add(arch);
  })();

  /* =========================================================
     Star gates: every racer flies through the same stars
     ========================================================= */
  var gates=[];
  function makeGate(s, q){
    var gate={s:s, q:q, stars:[], labeled:false, seenAt:-1};
    SLOTS.forEach(function(slot,i){
      var grp=new T.Group();
      var halo=new T.Sprite(new T.SpriteMaterial({map:GLOW, color:0xFFE2A8, transparent:true, opacity:.4, blending:T.AdditiveBlending, depthWrite:false, fog:false}));
      halo.scale.set(17,17,1); halo.position.z=-1.6;
      var mesh=new T.Mesh(STAR_GEO, STAR_MAT);
      grp.add(halo); grp.add(mesh);
      grp.position.set(cx(s)+slot[0], CRUISE_Y+slot[1], -s);
      grp.rotation.y=-Math.atan(dcx(s));
      grp.visible=false;
      scene.add(grp);
      gate.stars.push({grp:grp, mesh:mesh, halo:halo, val:q.choices[i], sx:slot[0], sy:slot[1], phase:Math.random()*6, pulse:-9});
    });
    return gate;
  }
  function setGateQuestion(gate, q){
    gate.q=q;
    gate.stars.forEach(function(st,i){ st.val=q.choices[i]; });
  }
  function clearGates(){
    gates.forEach(function(g){
      g.stars.forEach(function(st){
        scene.remove(st.grp);
        st.halo.material.dispose();
      });
    });
    gates=[];
  }
  function buildGates(){
    clearGates();
    var think=THINK[G.diff];
    /* spaced so a boosted flier still gets close to the full thinking time */
    var spacing=BASE*(think+FEEDBACK) + 0.5*(BOOST_MULT-1)*BASE*BOOST_T;
    for(var s=BASE*(think+0.6); s<RACE_LEN-60; s+=spacing) gates.push(makeGate(s, makeQuestion(G.op, G.diff)));
  }
  function labelGate(gate){
    gate.labeled=true;
    gate.stars.forEach(function(st,i){ ALS[i].textContent=String(st.val); });
    setQuestionCard("Fly into the star that answers", gate.q.text+" = ?", gate.q.choices, false);
  }
  /* forgiving: whichever star you are closest to is your answer */
  function hitSlot(gate, ox, oy){
    var hit=0, best=1e9;
    gate.stars.forEach(function(st,i){
      var dx=ox-st.sx, dy=oy-st.sy, d=dx*dx+dy*dy;
      if(d<best){ best=d; hit=i; }
    });
    return hit;
  }
  function rightSlot(gate){
    for(var i=0;i<4;i++) if(gate.stars[i].val===gate.q.ans) return i;
    return -1;
  }

  /* =========================================================
     Birds
     ========================================================= */
  function quadGeo(v){
    var g=new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(v),3));
    g.computeVertexNormals();
    return g;
  }
  function nameSprite(text){
    var cv=document.createElement("canvas"); cv.width=256; cv.height=64;
    var tex=new T.CanvasTexture(cv); tex.minFilter=T.LinearFilter;
    function draw(){
      var g=cv.getContext("2d");
      g.clearRect(0,0,256,64);
      g.fillStyle="rgba(16,10,44,.78)";
      g.beginPath();
      if(g.roundRect) g.roundRect(28,6,200,52,26); else g.rect(28,6,200,52);
      g.fill();
      g.font="600 32px Fredoka, Karla, sans-serif";
      g.textAlign="center"; g.textBaseline="middle"; g.fillStyle="#fff";
      g.fillText(text,128,34);
      tex.needsUpdate=true;
    }
    draw();
    var sp=new T.Sprite(new T.SpriteMaterial({map:tex, transparent:true, depthWrite:false, fog:false}));
    sp.scale.set(4.2,1.05,1); sp.position.set(0,1.9,0);
    sp.userData.redraw=draw;
    return sp;
  }
  function makeWing(dir, mat){
    /* inner wing with an outer "hand" segment that bends on the downstroke */
    var inner=new T.Group();
    inner.add(new T.Mesh(quadGeo([0,0,-0.5, 0,0,0.5, dir*1.4,0,0.45,  0,0,-0.5, dir*1.4,0,0.45, dir*1.4,0,-0.35]), mat));
    var outer=new T.Group(); outer.position.x=dir*1.4;
    outer.add(new T.Mesh(quadGeo([0,0,-0.35, 0,0,0.45, dir*1.9,0,0.55,  0,0,-0.35, dir*1.9,0,0.55, dir*1.5,0,0.05]), mat));
    inner.add(outer);
    return {inner:inner, outer:outer};
  }
  function makeBird(def){
    var grp=new T.Group();
    var bodyMat=new T.MeshLambertMaterial({color:def.body});
    var wingMat=new T.MeshLambertMaterial({color:def.wing, side:T.DoubleSide});
    var body=new T.Mesh(new T.SphereGeometry(0.5,12,8), bodyMat); body.scale.set(0.9,0.8,2.0);
    grp.add(body);
    var head=new T.Mesh(new T.SphereGeometry(0.38,12,8), new T.MeshLambertMaterial({color:def.head}));
    head.position.set(0,0.2,-1.05);
    grp.add(head);
    var beakG=new T.ConeGeometry(0.11,0.42,8); beakG.rotateX(-Math.PI/2);
    var beak=new T.Mesh(beakG, new T.MeshLambertMaterial({color:def.beak})); beak.position.set(0,0.15,-1.5);
    grp.add(beak);
    grp.add(new T.Mesh(quadGeo([0,0.05,0.8, -0.55,0.05,1.75, 0.55,0.05,1.75]), wingMat));
    var L=makeWing(-1, wingMat), R=makeWing(1, wingMat);
    L.inner.position.set(-0.32,0.12,-0.15); R.inner.position.set(0.32,0.12,-0.15);
    grp.add(L.inner); grp.add(R.inner);
    var trail=new T.Sprite(new T.SpriteMaterial({map:GLOW, color:0xFFD27A, transparent:true, opacity:.75, blending:T.AdditiveBlending, depthWrite:false, fog:false}));
    trail.scale.set(4,4,1); trail.position.set(0,0,2.2); trail.visible=false;
    grp.add(trail);
    var label=nameSprite(def.name);
    grp.add(label);
    grp.scale.setScalar(1.25);
    scene.add(grp);
    return {grp:grp, L:L, R:R, trail:trail, label:label};
  }
  var cpus = CPU_DEF.map(function(def,i){
    var b=makeBird(def);
    return {name:def.name, emoji:def.emoji, base:def.base, lane:def.lane, phase:i*1.9,
            grp:b.grp, L:b.L, R:b.R, trail:b.trail, label:b.label,
            s:CPU_START, v:0, ox:def.lane, oy:0, vx:0, vy:0, acc:.7,
            boostUntil:-1, slowUntil:-1, gi:0, plan:null, decideDist:80, caught:0, tries:0, finishedAt:null};
  });

  /* =========================================================
     Star bursts and fireworks
     ========================================================= */
  var bursts=[];
  function makeBurst(N, size, speedLo, speedHi, flat){
    var pos=new Float32Array(N*3), col=new Float32Array(N*3), vel=[], c=new T.Color();
    for(var i=0;i<N;i++){
      var sp=speedLo+Math.random()*(speedHi-speedLo);
      if(flat){
        var th=Math.random()*Math.PI*2;
        vel.push(Math.cos(th)*sp, Math.sin(th)*sp, (Math.random()-0.5)*4);
      } else {
        var u=Math.random()*2-1, ph=Math.random()*Math.PI*2, r=Math.sqrt(1-u*u);
        vel.push(r*Math.cos(ph)*sp, u*sp, r*Math.sin(ph)*sp);
      }
      c.setHSL(Math.random(),0.95,0.62);
      col[i*3]=c.r; col[i*3+1]=c.g; col[i*3+2]=c.b;
    }
    var g=new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos,3));
    g.setAttribute("color", new T.BufferAttribute(col,3));
    var pts=new T.Points(g, new T.PointsMaterial({size:size, map:SPARK, vertexColors:true, transparent:true, depthWrite:false, blending:T.AdditiveBlending, fog:false}));
    return {pts:pts, vel:vel};
  }
  function burstInView(){
    var b=makeBurst(110, 0.42, 5, 17, true);
    b.pts.material.depthTest=false; b.pts.renderOrder=998;
    b.pts.position.set(0,0,-9);
    camera.add(b.pts);
    bursts.push({pts:b.pts, vel:b.vel, life:0, max:1.1});
  }
  function burstAt(p){
    var b=makeBurst(70, 1.3, 6, 16, false);
    b.pts.position.copy(p);
    scene.add(b.pts);
    bursts.push({pts:b.pts, vel:b.vel, life:0, max:1.0});
  }
  function updateBursts(dt){
    for(var i=bursts.length-1;i>=0;i--){
      var b=bursts[i]; b.life+=dt;
      var attr=b.pts.geometry.attributes.position, arr=attr.array, drag=Math.pow(0.3,dt);
      for(var k=0;k<b.vel.length;k+=3){
        arr[k]+=b.vel[k]*dt; arr[k+1]+=b.vel[k+1]*dt; arr[k+2]+=b.vel[k+2]*dt;
        b.vel[k]*=drag; b.vel[k+1]=b.vel[k+1]*drag-4*dt; b.vel[k+2]*=drag;
      }
      attr.needsUpdate=true;
      b.pts.material.opacity=Math.max(0,1-b.life/b.max);
      if(b.life>=b.max){
        if(b.pts.parent) b.pts.parent.remove(b.pts);
        b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i,1);
      }
    }
  }

  var FX={ctx:null, parts:[], raf:0, last:0, w:0, h:0};
  function fxResize(){
    var c=$("fx"), dpr=Math.min(window.devicePixelRatio||1,2);
    FX.w=window.innerWidth; FX.h=window.innerHeight;
    c.width=Math.round(FX.w*dpr); c.height=Math.round(FX.h*dpr);
    FX.ctx=c.getContext("2d"); FX.ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function fxBurst(x,y,n,power){
    for(var i=0;i<n;i++){
      var a=Math.random()*Math.PI*2, sp=power*(0.32+Math.random()*0.8);
      FX.parts.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,r:3+Math.random()*7,rot:Math.random()*6.28,
        vr:(Math.random()-0.5)*0.011,c:RAINBOW[(Math.random()*RAINBOW.length)|0],life:0,max:1200+Math.random()*1000});
    }
  }
  function fxTick(now){
    if(!FX.last) FX.last=now;
    var dt=Math.min(50,now-FX.last); FX.last=now;
    var g=FX.ctx; g.clearRect(0,0,FX.w,FX.h); g.shadowBlur=9;
    var live=[];
    for(var i=0;i<FX.parts.length;i++){
      var p=FX.parts[i]; p.life+=dt;
      if(p.life>=p.max) continue;
      p.vy+=0.00021*dt; p.vx*=Math.pow(0.9994,dt);
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.rot+=p.vr*dt;
      var t=p.life/p.max;
      g.globalAlpha=Math.max(0,1-t*t); g.fillStyle=p.c; g.shadowColor=p.c;
      g.save(); g.translate(p.x,p.y); g.rotate(p.rot); star10Path(g,0,0,p.r,p.r*0.4); g.fill(); g.restore();
      live.push(p);
    }
    g.globalAlpha=1; g.shadowBlur=0;
    FX.parts=live;
    FX.raf = FX.parts.length ? requestAnimationFrame(fxTick) : 0;
    if(!FX.raf) FX.last=0;
  }
  function fxStop(){
    if(FX.raf) cancelAnimationFrame(FX.raf);
    FX.raf=0; FX.last=0; FX.parts=[];
    if(FX.ctx) FX.ctx.clearRect(0,0,FX.w,FX.h);
  }
  function fireworks(){
    fxResize(); FX.parts=[]; FX.last=0;
    var rounds=CALM?2:10;
    for(var i=0;i<rounds;i++){
      (function(k){
        setTimeout(function(){
          if(G.state!=="finished") return;
          fxBurst(FX.w*(0.12+Math.random()*0.76), FX.h*(0.1+Math.random()*0.42), CALM?14:28, CALM?0.14:0.27);
          if(!FX.raf) FX.raf=requestAnimationFrame(fxTick);
        }, k*(CALM?500:330));
      })(i);
    }
  }

  /* =========================================================
     Game state
     ========================================================= */
  var G = {
    state:"attract", op:"mul", diff:"normal", birdIdx:0, mode:"day", haloBase:.25,
    t:0, startT:0, points:0, correct:0, waves:0, missed:[],
    pg:0, labelAt:0, finalStretch:false, finishTime:0
  };
  var P = {s:0, ox:0, oy:0, vx:0, vy:0, v:0, boostUntil:-1, slowUntil:-1, shakeUntil:-1, hurtUntil:-1};
  var input = {keys:{}, kx:0, ky:0, touching:false, x0:0, y0:0, tx:0, ty:0};

  function setState(s){ G.state=s; app.setAttribute("data-state", s); }

  /* ---------- day and night ---------- */
  var THEMES = {
    day:{
      label:"Daytime", night:false,
      sky:gradientTexture([[0,"#2A62C4"],[.25,"#3F7FD8"],[.4,"#6EA3E4"],[.47,"#A8C8EC"],[.52,"#CBDDEE"],[.6,"#D9E6F1"],[1,"#E2EBF3"]]),
      fog:0xC7DAEA, fogNear:170, fogFar:900,
      hemi:[0xD8E6FF,0x6B5A3A,0.8], key:[0xFFF1DC,0.95], fill:[0x9FB8FF,0.32],
      shimmer:.22, cloud:0xFFFFFF, cloudOp:.92, ring:0xFFFFFF, halo:.22, arch:.6
    },
    night:{
      label:"Night", night:true,
      sky:gradientTexture([[0,"#01030A"],[.28,"#03081B"],[.42,"#08122E"],[.5,"#0D1939"],[.56,"#111F44"],[1,"#132147"]]),
      fog:0x0E1A3A, fogNear:70, fogFar:650,
      hemi:[0x4A5F9A,0x0B0E18,0.55], key:[0xA9BDFF,0.5], fill:[0x2A3270,0.15],
      shimmer:.1, cloud:0x2C3654, cloudOp:.62, ring:0x1B2543, halo:.4, arch:.78
    }
  };
  function applyTheme(mode){
    var th=THEMES[mode]; G.mode=mode;
    scene.background=th.sky;
    scene.fog.color.setHex(th.fog); scene.fog.near=th.fogNear; scene.fog.far=th.fogFar;
    hemi.color.setHex(th.hemi[0]); hemi.groundColor.setHex(th.hemi[1]); hemi.intensity=th.hemi[2];
    keyLight.color.setHex(th.key[0]); keyLight.intensity=th.key[1];
    if(th.night) keyLight.position.set(0.45,0.9,-1); else keyLight.position.set(-0.42,0.9,-1);
    fillLight.color.setHex(th.fill[0]); fillLight.intensity=th.fill[1];
    riverShimmer.opacity=th.shimmer;
    cloudMats.forEach(function(m){ m.color.setHex(th.cloud); m.opacity=th.cloudOp; });
    rings.forEach(function(r){ r.material.color.setHex(th.ring); });
    archMats.forEach(function(m){ m.opacity=th.arch; });
    sunSprite.visible=!th.night; moonSprite.visible=th.night;
    nightSky.visible=th.night; decoStars.visible=th.night;
    G.haloBase=th.halo;
    STAR_MAT = th.night ? STAR_MAT_NIGHT : STAR_MAT_DAY;
    decoStars.children.forEach(function(m){ m.material=STAR_MAT; });
    gates.forEach(function(g){ g.stars.forEach(function(st){ st.mesh.material=STAR_MAT; }); });
    app.setAttribute("data-mode", mode);
  }

  /* ---------- HUD ---------- */
  var toastTimer=0;
  function toast(text, kind){
    var el=$("toast");
    el.textContent=text;
    el.className="toast";
    void el.offsetWidth;
    el.className="toast show "+kind;
    clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){ el.className="toast "+kind; }, 1350);
  }
  function setPoints(bump){
    var el=$("pts");
    el.textContent=String(G.points);
    if(bump){ el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  }
  var markers=[];
  function buildRaceBar(){
    var tr=$("rtrack");
    markers.forEach(function(m){ if(m.el.parentNode) m.el.parentNode.removeChild(m.el); });
    markers=[];
    cpus.forEach(function(c){
      var el=document.createElement("span"); el.className="rm"; el.textContent=c.emoji; el.title=c.name;
      tr.appendChild(el); markers.push({el:el, cpu:c});
    });
    var me=document.createElement("span"); me.className="rm you"; me.textContent=BIRDS[G.birdIdx]; me.title="You";
    tr.appendChild(me); markers.push({el:me, cpu:null});
  }
  function updateRaceBar(){
    var w=$("rtrack").clientWidth;
    markers.forEach(function(m){
      var prog = m.cpu ? (m.cpu.s-CPU_START)/RACE_LEN : P.s/RACE_LEN;
      m.el.style.left = (clamp(prog,0,1)*w).toFixed(1)+"px";
    });
    $("rfill").style.width = (clamp(P.s/RACE_LEN,0,1)*100).toFixed(2)+"%";
  }
  function setQuestionCard(label, text, choices, small){
    $("qlabel").textContent=label;
    var qt=$("qtext"); qt.textContent=text; qt.className="qtext"+(small?" small":"");
    var grid=$("qgrid"), cells=grid.children;
    grid.hidden=!choices;
    for(var i=0;i<4;i++){
      cells[i].className="";
      cells[i].textContent = choices ? String(choices[i]) : "";
    }
  }
  var hintTimer=0;
  function showHint(html, ms){
    var el=$("hint"); el.innerHTML=html; el.classList.add("show");
    clearTimeout(hintTimer); hintTimer=setTimeout(function(){ el.classList.remove("show"); }, ms);
  }

  /* ---------- answer numbers that stay readable from far away ---------- */
  var ALS=[].slice.call(document.querySelectorAll("#alabels .al"));
  var alShown=false, projV=new T.Vector3();
  function hideAnswerLabels(){ if(alShown){ ALS.forEach(function(e){ e.hidden=true; }); alShown=false; } }
  function updateAnswerLabels(aim){
    var tg=gates[G.pg];
    if(G.state!=="racing" || !tg || !tg.labeled || tg.s-P.s<3){ hideAnswerLabels(); return; }
    camera.updateMatrixWorld();
    var W=window.innerWidth, H=window.innerHeight, pts=[], mx=0, my=0, i;
    for(i=0;i<4;i++){
      projV.copy(tg.stars[i].grp.position).project(camera);
      if(projV.z>1){ hideAnswerLabels(); return; }
      var x=(projV.x+1)/2*W, y=(1-projV.y)/2*H;
      pts.push([x,y]); mx+=x; my+=y;
    }
    mx/=4; my/=4;
    var focal=(H/2)/Math.tan(camera.fov*Math.PI/360);
    var starPx=STAR_R*focal/Math.max(tg.s-P.s,1);
    var d=clamp(starPx*0.95, 46, 100), font=d*0.46;
    var minX=d*0.68+10, minY=d*0.56+8;     /* far away, spread the labels so they never overlap */
    for(i=0;i<4;i++){
      var st=tg.stars[i], sxn=st.sx>0?1:-1, syn=st.sy>0?-1:1;
      var ox=sxn*Math.max(sxn*(pts[i][0]-mx), minX), oy=syn*Math.max(syn*(pts[i][1]-my), minY);
      var el=ALS[i];
      el.style.transform="translate("+(mx+ox).toFixed(1)+"px,"+(my+oy).toFixed(1)+"px) translate(-50%,-50%)";
      el.style.minWidth=d.toFixed(0)+"px"; el.style.height=d.toFixed(0)+"px"; el.style.fontSize=font.toFixed(0)+"px";
      el.classList.toggle("aim", i===aim);
      el.hidden=false;
    }
    alShown=true;
  }

  /* ---------- passing through a gate: you ---------- */
  function requeueFact(q){
    /* bring a missed fact back two or more gates later, on a gate nobody has reached yet */
    for(var j=G.pg+2;j<gates.length;j++){
      var g=gates[j], busy=g.labeled;
      for(var c=0;c<cpus.length && !busy;c++){ if(cpus[c].s>g.s-260) busy=true; }
      if(busy) continue;
      setGateQuestion(g, {op:q.op, a:q.a, b:q.b, ans:q.ans, text:q.text, choices:choicesFor(q.op,q.a,q.b,q.ans)});
      return;
    }
  }
  function resolvePlayer(gate){
    G.waves++;
    if(!gate.labeled) labelGate(gate);
    var q=gate.q, hit=hitSlot(gate,P.ox,P.oy), right=rightSlot(gate), cells=$("qgrid").children;
    if(right>=0) cells[right].className="right";
    if(hit>=0) gate.stars[hit].pulse=G.t;
    if(hit>=0 && hit===right){
      G.correct++; G.points+=PER_STAR;
      P.boostUntil=G.t+BOOST_T; P.slowUntil=-1;
      setPoints(true);
      burstInView();
      toast(pick(["+10 · Boost!","Star caught · +10","+10 · Zoom!"]), "good");
    } else {
      var fact=q.text+" = "+q.ans;
      G.missed.push(fact);
      requeueFact(q);
      {
        cells[hit].className="wrong";
        P.slowUntil=G.t+SLOW_T; P.shakeUntil=G.t+0.35; P.hurtUntil=G.t+0.4;
        toast(fact, "bad");
      }
    }
  }

  /* ---------- passing through a gate: the computer birds ---------- */
  function cpuDecide(b, gate){
    var right=rightSlot(gate), slot;
    if(Math.random()<b.acc) slot=right;
    else { do{ slot=Math.floor(Math.random()*4); } while(slot===right); }
    var st=gate.stars[slot];
    return {x:st.sx+(Math.random()-.5)*2.4, y:st.sy+(Math.random()-.5)*2.4};
  }
  function cpuResolve(b, gate){
    b.tries++;
    var hit=hitSlot(gate,b.ox,b.oy), right=rightSlot(gate);
    if(hit>=0) gate.stars[hit].pulse=G.t;
    if(hit>=0 && hit===right){
      b.caught++; b.boostUntil=G.t+BOOST_T; b.slowUntil=-1;
      var ahead=gate.s-P.s;
      if(ahead>-2 && ahead<520) burstAt(gate.stars[hit].grp.position);
    } else if(hit>=0){
      b.slowUntil=G.t+SLOW_T;
    }
  }

  /* ---------- race flow ---------- */
  function resetRace(){
    P.s=0; P.ox=0; P.oy=0; P.vx=0; P.vy=0; P.v=0;
    P.boostUntil=P.slowUntil=P.shakeUntil=P.hurtUntil=-1;
    G.points=0; G.correct=0; G.waves=0; G.missed=[];
    G.pg=0; G.labelAt=0; G.finalStretch=false;
    buildGates();
    cpus.forEach(function(c,i){
      c.s=CPU_START; c.v=0; c.ox=c.lane; c.oy=0; c.vx=c.vy=0;
      c.boostUntil=c.slowUntil=-1; c.finishedAt=null;
      c.gi=0; c.plan=null; c.decideDist=BASE*(1.6+Math.random()*1.8);
      c.caught=0; c.tries=0;
      c.acc=CPU_ACC[G.diff][i];
    });
    setPoints(false);
    $("clock").textContent="0.0s";
    buildRaceBar();
    updateRaceBar();
  }

  function beginCountdown(){
    fxStop();
    applyTheme(nextMode());
    setState("countdown");
    resetRace();
    setQuestionCard("Get ready · "+THEMES[G.mode].label+" flight", OPS[G.op].label+" · "+cap(G.diff), null, true);
    var o=$("overlay");
    o.hidden=false; o.className="overlay clear";
    o.innerHTML='<div class="count" id="countNum">3</div>';
    var n=3, el=$("countNum");
    var tick=setInterval(function(){
      n--;
      if(n>0) el.textContent=String(n);
      else if(n===0) el.textContent="FLY!";
      else { clearInterval(tick); startRace(); }
    },700);
  }

  function startRace(){
    setState("racing");
    G.startT=G.t;
    G.labelAt=G.t+0.3;
    var o=$("overlay"); o.hidden=true; o.innerHTML="";
    showHint(COARSE ? "Drag anywhere to steer · fly through the right star"
                    : "Steer with <kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> · fly through the right star", 6500);
    if(renderer.domElement.focus) renderer.domElement.focus();
  }

  function pause(){
    if(G.state!=="racing") return;
    setState("paused");
    clearKeys();
    var o=$("overlay"); o.hidden=false; o.className="overlay dim";
    o.innerHTML='<div class="panel" style="max-width:380px">'
      + '<h2>Paused</h2><p class="lede">Your bird is hovering. Everyone else waits too.</p>'
      + '<div class="btnrow"><button class="btn" id="resumeBtn" type="button">Keep flying</button>'
      + '<button class="btn ghost" id="quitBtn" type="button">Leave race</button></div></div>';
    $("resumeBtn").addEventListener("click", resume);
    $("quitBtn").addEventListener("click", function(){ setupPanel(); });
    $("resumeBtn").focus();
  }
  function resume(){
    if(G.state!=="paused") return;
    setState("racing");
    var o=$("overlay"); o.hidden=true; o.innerHTML="";
  }

  function ordinal(n){ return ["","1st","2nd","3rd","4th","5th"][n]; }
  function finishRace(){
    setState("finished");
    G.finishTime=G.t-G.startT;

    var racers=[{name:"You", emoji:BIRDS[G.birdIdx], you:true, prog:1, fin:G.finishTime, caught:G.correct, tries:G.waves}];
    cpus.forEach(function(c){
      racers.push({name:c.name, emoji:c.emoji, you:false, prog:clamp((c.s-CPU_START)/RACE_LEN,0,1), fin:c.finishedAt, caught:c.caught, tries:c.tries});
    });
    racers.sort(function(a,b){
      var fa=a.fin==null?Infinity:a.fin, fb=b.fin==null?Infinity:b.fin;
      if(fa!==fb) return fa-fb;
      return b.prog-a.prog;
    });
    var place=0; racers.forEach(function(r,i){ if(r.you) place=i+1; });
    var won=place===1;

    REC.flights++;
    if(won) REC.wins++;
    var key=G.op+":"+G.diff, ms=Math.round(G.finishTime*1000);
    var isBest=!REC.best[key] || ms<REC.best[key];
    if(isBest) REC.best[key]=ms;
    saveRec(REC);

    setQuestionCard(won?"First to the rainbow":"Across the line", won?"You win!":ordinal(place)+" place", null, true);
    fireworks();
    setTimeout(function(){ if(G.state==="finished") resultsPanel(racers, place, won, isBest); }, CALM?400:1900);
  }

  /* ---------- panels ---------- */
  function statHTML(k,v){ return '<div class="stat"><div class="k">'+esc(k)+'</div><div class="v">'+esc(String(v))+'</div></div>'; }
  function recordsHTML(){
    var best=REC.best[G.op+":"+G.diff];
    return statHTML("Flights", REC.flights) + statHTML("Wins", REC.wins)
         + statHTML("Best "+OPS[G.op].sym+" "+cap(G.diff), best ? (best/1000).toFixed(1)+"s" : "—");
  }
  function chip(attr, value, label, pressed){
    return '<button class="chip" type="button" '+attr+'="'+value+'" aria-pressed="'+pressed+'">'+label+'</button>';
  }

  function setupPanel(){
    setState("attract");
    fxStop();
    clearKeys();
    clearGates();
    applyTheme(nextMode());
    var th=THEMES[G.mode];
    var o=$("overlay"); o.hidden=false; o.className="overlay";
    o.innerHTML =
      '<div class="panel">'
      + '<h2>Starcatch <span class="rb">Valley</span></h2>'
      + '<p class="lede">You’re the bird. A math fact appears at the top; four stars float ahead with answers. Fly through the right one for ten points and a burst of speed. The four valley birds fly through the same stars, so beat them to the rainbow.</p>'
      + '<div class="mode'+(th.night?' night':'')+'"><i></i>'+th.label+' flight <span>· day and night take turns each round</span></div>'
      + '<fieldset><legend>Which facts?</legend><div class="chips">'
        + chip("data-op","add",'<span class="op">+</span>Adding',G.op==="add")
        + chip("data-op","sub",'<span class="op">−</span>Subtracting',G.op==="sub")
        + chip("data-op","mul",'<span class="op">×</span>Multiplying',G.op==="mul")
        + chip("data-op","div",'<span class="op">÷</span>Dividing',G.op==="div")
      + '</div></fieldset>'
      + '<fieldset><legend>How hard?</legend><div class="chips">'
        + chip("data-diff","easy","Easy",G.diff==="easy")
        + chip("data-diff","normal","Normal",G.diff==="normal")
        + chip("data-diff","hard","Hard",G.diff==="hard")
      + '</div><p class="note" id="diffNote"></p></fieldset>'
      + '<fieldset><legend>Your bird</legend><div class="chips">'
        + BIRDS.map(function(b,i){
            return '<button class="chip bird" type="button" data-bird="'+i+'" aria-pressed="'+(i===G.birdIdx)+'" aria-label="Fly as '+b+'">'+b+'</button>';
          }).join("")
      + '</div></fieldset>'
      + '<div class="howto"><span><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to steer</span>'
      +   '<span>On a tablet, drag to steer</span><span><kbd>P</kbd> pauses</span></div>'
      + '<div class="stats" id="stats">'+recordsHTML()+'</div>'
      + '<button class="btn" id="startBtn" type="button">Take off</button>'
      + '</div>';
    o.querySelectorAll("[data-op]").forEach(function(b){ b.addEventListener("click",function(){ G.op=b.getAttribute("data-op"); syncSetup(); }); });
    o.querySelectorAll("[data-diff]").forEach(function(b){ b.addEventListener("click",function(){ G.diff=b.getAttribute("data-diff"); syncSetup(); }); });
    o.querySelectorAll("[data-bird]").forEach(function(b){ b.addEventListener("click",function(){ G.birdIdx=+b.getAttribute("data-bird"); syncSetup(); }); });
    $("startBtn").addEventListener("click", beginCountdown);
    syncSetup();
  }
  function syncSetup(){
    var o=$("overlay");
    o.querySelectorAll("[data-op]").forEach(function(b){ b.setAttribute("aria-pressed", String(b.getAttribute("data-op")===G.op)); });
    o.querySelectorAll("[data-diff]").forEach(function(b){ b.setAttribute("aria-pressed", String(b.getAttribute("data-diff")===G.diff)); });
    o.querySelectorAll("[data-bird]").forEach(function(b){ b.setAttribute("aria-pressed", String(+b.getAttribute("data-bird")===G.birdIdx)); });
    var note=$("diffNote"); if(note) note.textContent=DIFF_NOTES[G.op][G.diff]+" "+TIME_NOTES[G.diff];
    var st=$("stats"); if(st) st.innerHTML=recordsHTML();
  }

  function resultsPanel(racers, place, won, isBest){
    var uniq=[]; G.missed.forEach(function(m){ if(uniq.indexOf(m)===-1) uniq.push(m); });
    var acc=G.waves?Math.round(G.correct/G.waves*100):0;
    var upcoming=nextMode();
    var o=$("overlay"); o.hidden=false; o.className="overlay dim";
    o.innerHTML =
      '<div class="panel">'
      + '<h2>'+(won?'You reached the <span class="rb">rainbow</span> first!':ordinal(place)+" to the rainbow")+(isBest?'<span class="newbest">New best time</span>':'')+'</h2>'
      + '<p class="score-big">'+G.points+' points <span>· '+G.correct+' stars × 10</span></p>'
      + '<p class="lede">'+G.finishTime.toFixed(1)+'s · '+G.correct+' of '+G.waves+' stars caught ('+acc+'%) · '+OPS[G.op].label.toLowerCase()+', '+G.diff+'</p>'
      + '<ol class="results">'
      +   racers.map(function(r,i){
            var res = (r.fin!=null ? r.fin.toFixed(1)+"s" : Math.round(r.prog*100)+"% of the way")
                    + " · "+r.caught+" of "+r.tries+" stars";
            return '<li class="'+(r.you?"you":"")+'"><span class="pos">'+ordinal(i+1)+'</span><span class="av">'+r.emoji+'</span>'
                 + '<span class="who">'+esc(r.name)+'</span><span class="res">'+res+'</span></li>';
          }).join("")
      + '</ol>'
      + (uniq.length ? '<div class="review"><h3>Facts to practice</h3><ul class="facts">'
          + uniq.slice(0,10).map(function(m){ return '<li>'+esc(m)+'</li>'; }).join("") + '</ul></div>' : '')
      + '<p class="nextnote">Next round is '+(upcoming==="day"?"in the daytime":"at night")+'.</p>'
      + '<div class="btnrow"><button class="btn" id="againBtn" type="button">Fly again</button>'
      + '<button class="btn ghost" id="setupBtn" type="button">Change setup</button></div>'
      + '</div>';
    $("againBtn").addEventListener("click", beginCountdown);
    $("setupBtn").addEventListener("click", setupPanel);
    $("againBtn").focus();
  }

  /* =========================================================
     Input
     ========================================================= */
  var KEYMAP={ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,1], ArrowDown:[0,-1], a:[-1,0], d:[1,0], w:[0,1], s:[0,-1]};
  function keyName(e){ return e.key && e.key.length===1 ? e.key.toLowerCase() : e.key; }
  function recomputeKeys(){
    var x=0, y=0;
    for(var k in input.keys){ if(input.keys[k] && KEYMAP[k]){ x+=KEYMAP[k][0]; y+=KEYMAP[k][1]; } }
    input.kx=clamp(x,-1,1); input.ky=clamp(y,-1,1);
  }
  function clearKeys(){ input.keys={}; input.kx=input.ky=0; input.touching=false; input.tx=input.ty=0; }
  window.addEventListener("keydown", function(e){
    var k=keyName(e);
    if(k==="Escape" || k==="p"){
      if(G.state==="racing"){ pause(); e.preventDefault(); }
      else if(G.state==="paused"){ resume(); e.preventDefault(); }
      return;
    }
    if(KEYMAP[k]){
      input.keys[k]=true; recomputeKeys();
      if(G.state==="racing" || G.state==="countdown" || G.state==="finished") e.preventDefault();
    }
  });
  window.addEventListener("keyup", function(e){
    var k=keyName(e);
    if(KEYMAP[k]){ input.keys[k]=false; recomputeKeys(); }
  });
  window.addEventListener("blur", function(){ clearKeys(); pause(); });
  document.addEventListener("visibilitychange", function(){ if(document.hidden){ clearKeys(); pause(); } });
  $("pauseBtn").addEventListener("click", function(){ if(G.state==="racing") pause(); else if(G.state==="paused") resume(); });

  var cv=renderer.domElement;
  cv.setAttribute("tabindex","0");
  cv.addEventListener("pointerdown", function(e){
    if(G.state!=="racing") return;
    input.touching=true; input.x0=e.clientX; input.y0=e.clientY; input.tx=input.ty=0;
    try{ cv.setPointerCapture(e.pointerId); }catch(err){}
  });
  cv.addEventListener("pointermove", function(e){
    if(!input.touching) return;
    input.tx=clamp((e.clientX-input.x0)/60,-1,1);
    input.ty=clamp(-(e.clientY-input.y0)/60,-1,1);
  });
  function endTouch(){ input.touching=false; input.tx=input.ty=0; }
  cv.addEventListener("pointerup", endTouch);
  cv.addEventListener("pointercancel", endTouch);

  /* =========================================================
     Main loop
     ========================================================= */
  var lastNow=performance.now();

  function steer(o, ix, iy, dt){
    o.vx += (ix*MAXV_X - o.vx)*Math.min(1, dt*7);
    o.vy += (iy*MAXV_Y - o.vy)*Math.min(1, dt*7);
    o.ox += o.vx*dt; o.oy += o.vy*dt;
    if(o.ox>LIM_X){ o.ox=LIM_X; o.vx=Math.min(0,o.vx); }
    if(o.ox<-LIM_X){ o.ox=-LIM_X; o.vx=Math.max(0,o.vx); }
    if(o.oy>LIM_Y){ o.oy=LIM_Y; o.vy=Math.min(0,o.vy); }
    if(o.oy<-LIM_Y){ o.oy=-LIM_Y; o.vy=Math.max(0,o.vy); }
  }

  function update(dt){
    var st=G.state, racing=(st==="racing"), live=(racing || st==="finished");

    /* ---- you ---- */
    var ix=0, iy=0;
    if(live){
      ix = input.touching ? input.tx : input.kx;
      iy = input.touching ? input.ty : input.ky;
    } else if(st==="attract"){
      ix = clamp((Math.sin(G.t*0.31)*6 - P.ox)*0.25, -0.6, 0.6);
      iy = clamp((Math.sin(G.t*0.23)*3 - P.oy)*0.25, -0.6, 0.6);
    } else if(st==="countdown"){
      ix = clamp(-P.ox*0.3,-1,1); iy = clamp(-P.oy*0.3,-1,1);
    }
    var target;
    if(st==="attract") target=BASE*0.55;
    else if(st==="countdown") target=0;
    else if(st==="finished") target = P.s>RACE_LEN+430 ? 0 : BASE*0.55;
    else target = BASE*(G.t<P.boostUntil ? BOOST_MULT : (G.t<P.slowUntil ? SLOW_MULT : 1));
    P.v += (target-P.v)*Math.min(1, dt*3);
    P.s += P.v*dt;
    if(st==="attract" && P.s>RACE_LEN-320) P.s=0;
    steer(P, ix, iy, dt);

    /* ---- camera = your bird ---- */
    var boosting = G.t<P.boostUntil;
    var bob = CALM ? 0 : Math.sin(G.t*7.5)*0.12;
    var px=cx(P.s)+P.ox, py=CRUISE_Y+P.oy+bob, pz=-P.s;
    if(!CALM && G.t<P.shakeUntil){ px+=(Math.random()-.5)*0.55; py+=(Math.random()-.5)*0.55; }
    camera.position.set(px,py,pz);
    camera.rotation.y = -Math.atan(dcx(P.s));
    camera.rotation.x = (P.vy/MAXV_Y)*0.05;
    camera.rotation.z = -(P.vx/MAXV_X)*0.2;
    var fovT = boosting ? (CALM?72:84) : 68;
    if(Math.abs(camera.fov-fovT)>0.05){ camera.fov += (fovT-camera.fov)*Math.min(1,dt*4); camera.updateProjectionMatrix(); }

    /* ---- sky that stays at a distance ---- */
    nightSky.position.set(px,0,pz);
    rings.forEach(function(r){ r.position.set(px,0,pz); });
    sunSprite.position.set(px+SUN_DIR.x*1500, py+SUN_DIR.y*1500, pz+SUN_DIR.z*1500);
    moonSprite.position.set(px+MOON_DIR.x*1500, py+MOON_DIR.y*1500, pz+MOON_DIR.z*1500);
    riverShimmer.map.offset.y -= dt*0.12;
    if(decoStars.visible) decoStars.children.forEach(function(m){ m.rotation.y += dt*m.userData.spin; });

    /* ---- you reach a gate ---- */
    if(racing){
      var tg=gates[G.pg];
      if(tg && P.s>=tg.s){ resolvePlayer(tg); G.pg++; G.labelAt=G.t+FEEDBACK; }
      else if(!tg && !G.finalStretch && G.t>=G.labelAt){
        G.finalStretch=true;
        setQuestionCard("Final stretch", "Fly for the rainbow!", null, true);
      }
    }

    /* ---- which star you're lined up with ---- */
    var aim=-1, tgt=gates[G.pg];
    if(racing && tgt && tgt.labeled){
      aim=hitSlot(tgt,P.ox,P.oy);
      var cl=$("qgrid").children;
      for(var a=0;a<4;a++) cl[a].classList.toggle("aim", a===aim);
    }

    /* ---- gate visuals ---- */
    for(var gi=0; gi<gates.length; gi++){
      var g=gates[gi], rel=g.s-P.s, show=(st!=="attract") && rel>-2 && rel<680;
      var isTarget=(gi===G.pg);
      if(isTarget && racing && !g.labeled && G.t>=G.labelAt) labelGate(g);
      if(show && g.seenAt<0) g.seenAt=G.t;
      var grow=g.seenAt<0 ? 0 : clamp((G.t-g.seenAt)/0.6,0,1);
      for(var si=0; si<4; si++){
        var sr=g.stars[si];
        sr.grp.visible=show;
        if(!show) continue;
        var pulse=Math.max(0,1-(G.t-sr.pulse)/0.4);
        sr.grp.scale.setScalar((0.01+0.99*(1-Math.pow(1-grow,3)))*(isTarget?1:0.8)*(1+0.45*pulse));
        sr.mesh.rotation.z += dt*0.5;
        sr.mesh.rotation.y = Math.sin(G.t*1.5+sr.phase)*0.35;
        sr.halo.material.opacity = isTarget ? (si===aim ? Math.min(0.95,G.haloBase*1.9+0.25) : G.haloBase*0.7) : G.haloBase*0.35;
        sr.halo.scale.setScalar(isTarget && si===aim ? 21 : 17);
      }
    }

    /* ---- computer birds: same gates, same rules ---- */
    for(var c=0;c<cpus.length;c++){
      var b=cpus[c], tx=b.lane, ty=0;
      if(st==="attract"){
        b.s = P.s + 46 + c*16;
      } else if(live){
        var bg=gates[b.gi];
        if(bg){
          if(!b.plan && bg.s-b.s<b.decideDist) b.plan=cpuDecide(b,bg);
          if(b.plan){ tx=b.plan.x; ty=b.plan.y; }
          if(b.s>=bg.s){
            cpuResolve(b,bg);
            b.gi++; b.plan=null; b.decideDist=BASE*(1.6+Math.random()*1.8);
          }
        }
        var m = G.t<b.boostUntil ? BOOST_MULT : (G.t<b.slowUntil ? SLOW_MULT : 1);
        b.v += (BASE*b.base*m - b.v)*Math.min(1,dt*3);
        b.s += b.v*dt;
        if(racing && b.finishedAt==null && b.s-CPU_START>=RACE_LEN) b.finishedAt=G.t-G.startT;
      }
      if(st!=="countdown") steer(b, clamp((tx-b.ox)*0.4,-1,1), clamp((ty-b.oy)*0.4,-1,1), dt);
      var bx=cx(b.s)+b.ox+Math.sin(G.t*0.7+b.phase)*0.5;
      var by=CRUISE_Y+b.oy+Math.sin(G.t*1.1+b.phase)*0.4;
      b.grp.position.set(bx,by,-b.s);
      b.grp.rotation.y=-Math.atan(dcx(b.s));
      b.grp.rotation.z=-(b.vx/MAXV_X)*0.5;
      var bBoost=G.t<b.boostUntil;
      var fl=Math.sin(G.t*(bBoost?15:9)+b.phase);
      b.L.inner.rotation.z=fl*0.55; b.R.inner.rotation.z=-fl*0.55;
      b.L.outer.rotation.z=fl*0.35; b.R.outer.rotation.z=-fl*0.35;
      b.trail.visible=bBoost && st!=="attract";
      var gap=b.s-P.s;
      b.label.visible = gap>6 && gap<300;
    }

    updateBursts(dt);
    updateAnswerLabels(aim);

    /* ---- HUD ---- */
    if(st!=="attract"){
      if(racing) $("clock").textContent=(G.t-G.startT).toFixed(1)+"s";
      updateRaceBar();
      $("boost").classList.toggle("on", boosting);
      if(boosting) $("boostBar").style.width=(clamp((P.boostUntil-G.t)/BOOST_T,0,1)*100).toFixed(1)+"%";
      $("speed").classList.toggle("on", boosting && !CALM);
      $("reticle").classList.toggle("boosting", boosting);
      $("hurt").classList.toggle("on", G.t<P.hurtUntil);
    } else {
      $("speed").classList.remove("on");
      $("hurt").classList.remove("on");
    }

    if(racing && P.s>=RACE_LEN) finishRace();
  }

  function frame(now){
    var rdt=Math.min(0.05,(now-lastNow)/1000); lastNow=now;
    var dt = G.state==="paused" ? 0 : rdt;
    G.t += dt;
    update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  /* =========================================================
     Boot
     ========================================================= */
  if(document.fonts && document.fonts.load){
    document.fonts.load('600 40px "Fredoka"').then(function(){
      cpus.forEach(function(c){ c.label.userData.redraw(); });
    }).catch(function(){});
  }
  setupPanel();
  requestAnimationFrame(frame);
})();
