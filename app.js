const IND={P:"Persatuan",K:"Keadilan",R:"Kepercayaan",H:"Hukum"};
const root=document.getElementById("app"),$=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let story,user,S;
const show=h=>{root.innerHTML=h;window.scrollTo(0,0)};

async function api(action,d={}){
  if(!API_URL)return demo(action,d);
  try{ // text/plain menghindari preflight CORS pada Apps Script
    const r=await fetch(API_URL,{method:"POST",body:JSON.stringify({action,token:user&&user.token,...d})});
    return await r.json();
  }catch(e){return{ok:false,error:"Tidak dapat terhubung ke server. Coba lagi."}}
}
function demo(action,d){
  const db=JSON.parse(localStorage.getItem("jw_demo")||'{"u":{}}');
  if(action==="login"||action==="register"){
    if(!d.username)return{ok:false,error:"Isi username."};
    return{ok:true,username:d.username};
  }
  if(action==="finish"){
    const u=db.u[user.username]=db.u[user.username]||{endings:[],best:0};
    if(!u.endings.includes(d.ending))u.endings.push(d.ending);
    u.best=Math.max(u.best,d.skor);
    localStorage.setItem("jw_demo",JSON.stringify(db));
    return{ok:true};
  }
  if(action==="leaderboard")
    return{ok:true,rows:Object.entries(db.u).map(([n,v])=>({username:n,endings:v.endings.length,best:v.best})).sort((a,b)=>b.endings-a.endings||b.best-a.best)};
  return{ok:true};
}

function meters(){
  return'<div class="meters">'+Object.keys(IND).map(k=>`<div class="m${S.ind[k]<=3?" low":""}"><span>${IND[k]}</span><div class="bar" role="img" aria-label="${IND[k]} ${S.ind[k]} dari 10"><i style="width:${S.ind[k]*10}%"></i></div></div>`).join("")+"</div>";
}

function showLogin(msg=""){
  show(`<section class="card"><h1>Jalan Warga</h1>
  <p>Setiap pilihanmu ikut membentuk Indonesia. Waktu bermain sekitar 60 menit.</p>
  ${API_URL?"":'<p class="note">Mode demo: data tersimpan di peramban ini saja.</p>'}
  <label>Username<input id="u" autocomplete="username"></label>
  ${API_URL?'<label>Kata sandi<input id="p" type="password" autocomplete="current-password"></label>':""}
  <p class="err" role="alert">${esc(msg)}</p>
  <div class="row"><button class="main" id="bin">Masuk</button>${API_URL?'<button id="bup">Daftar</button>':""}</div></section>`);
  const go=async a=>{
    const r=await api(a,{username:$("u").value.trim(),password:API_URL?$("p").value:""});
    if(r.ok){user=r;if(!story)story=await(await fetch("data/story.json")).json();menu()}else showLogin(r.error||"Gagal masuk.");
  };
  $("bin").onclick=()=>go("login");
  if(API_URL)$("bup").onclick=()=>go("register");
}

function menu(){
  show(`<section class="card"><h1>Halo, ${esc(user.username)}</h1>
  <p>Kamu akan menghadapi 14 keputusan dalam tiga babak. Perhatikan empat ukuran di atas layar: Persatuan, Keadilan, Kepercayaan, dan Hukum.</p>
  <button class="main" id="go">Mulai bermain</button><button id="lb">Lihat papan peringkat</button></section>`);
  $("go").onclick=start;$("lb").onclick=board;
}

let W,G,RN,raf,tt;
const CX=[0,110,220],GX=[55,165,275];
const TH=[{sky:0x8ecdf2,grass:0x6fae5a},{sky:0xf4b678,grass:0x8fa54f},{sky:0xaab7cc,grass:0x6b8f6a}];
const NPCCOL=[0x2a6f97,0x7b2d8f,0xe07a1f,0x1b7f5c,0x8a5a44];
const PX=[-22,8,26,-8,16],PZ=[-18,-24,12,22,-6];
const STAR=[[-15,28,0],[30,-30,1],[95,8,2],[140,-22,3],[228,26,4]];
const SILA=["Ketuhanan Yang Maha Esa","Kemanusiaan yang Adil dan Beradab","Persatuan Indonesia","Kerakyatan yang Dipimpin oleh Hikmat Kebijaksanaan dalam Permusyawaratan/Perwakilan","Keadilan Sosial bagi Seluruh Rakyat Indonesia"];
const PRED=[[85,"Negarawan Muda","Pilihanmu menjaga persatuan, keadilan, kepercayaan, dan hukum sekaligus."],[70,"Warga Teladan","Sebagian besar pilihanmu menguatkan bangsa."],[50,"Warga Peduli","Kamu sudah peduli, tetapi beberapa pilihan masih bisa diperbaiki."],[30,"Warga Pemula","Perjalananmu baru dimulai; ada banyak pelajaran dari pilihan-pilihanmu."],[0,"Masih Belajar","Coba main lagi dan lihat bagaimana pilihan lain mengubah Indonesia."]];
const KM={ArrowUp:"u",w:"u",W:"u",ArrowDown:"d",s:"d",S:"d",ArrowLeft:"l",a:"l",A:"l",ArrowRight:"r",d:"r",D:"r"};
const qsOf=b=>story.keputusan.filter(q=>q.babak===b&&(!q.syarat||S.flags.includes(q.syarat)));
const complete=b=>qsOf(b).every(q=>W.done.has(q.id));
const curQ=()=>qsOf(W.b).find(q=>!W.done.has(q.id));
const zoneOf=x=>x<GX[0]?1:x<GX[1]?2:3;
const idxOf=q=>story.keputusan.filter(k=>k.babak===q.babak).indexOf(q);
const npcPos=q=>[CX[q.babak-1]+PX[idxOf(q)],PZ[idxOf(q)]];
const dlg=h=>{const d=$("dlg");d.innerHTML=h;d.scrollIntoView({block:"nearest"})};
const mt=()=>{$("mt").innerHTML=meters()};
const toast=m=>{const e=$("ts");if(!e)return;e.textContent=m;e.hidden=false;clearTimeout(tt);tt=setTimeout(()=>e.hidden=true,3500)};
const sky=i=>{G.sc.background.setHex(TH[i].sky);G.sc.fog.color.setHex(TH[i].sky)};
function beep(f=880){try{const a=W.ac,o=a.createOscillator(),g=a.createGain();o.frequency.value=f;g.gain.value=.08;o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.12)}catch(e){}}

function lab(t,bg,w=256){
  const c=document.createElement("canvas");c.width=w;c.height=64;const g=c.getContext("2d");
  g.fillStyle=bg;g.fillRect(0,8,w,48);g.fillStyle="#fff";g.font="bold 28px sans-serif";g.textAlign="center";g.textBaseline="middle";g.fillText(t,w/2,33,w-16);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));
  s.scale.set(w/42,1.5,1);return s;
}
function person(col,name){
  const g=new THREE.Group(),mk=(geo,c,y)=>{const m=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color:c,flatShading:true}));m.position.y=y;g.add(m);return m};
  mk(new THREE.CylinderGeometry(.45,.5,1.3,8),col,1.45);
  mk(new THREE.SphereGeometry(.38,10,8),0xe8b98f,2.4);
  g.legs=[-.2,.2].map(x=>{const l=mk(new THREE.BoxGeometry(.25,.8,.3),0x222222,.4);l.position.x=x;return l});
  if(name){const s=lab(name,"rgba(20,33,61,.88)");s.position.y=3.6;g.add(s)}
  return g;
}

function build(){
  RN=new THREE.WebGLRenderer({antialias:true});RN.setPixelRatio(Math.min(devicePixelRatio,2));RN.domElement.id="cv";
  RN.domElement.setAttribute("role","img");RN.domElement.setAttribute("aria-label","Dunia 3D. Berjalan dengan tombol panah atau W A S D.");
  const sc=new THREE.Scene();sc.background=new THREE.Color(TH[0].sky);sc.fog=new THREE.Fog(TH[0].sky,45,120);
  G={sc,col:[],stars:[],bars:[],npc:{},cam:new THREE.PerspectiveCamera(60,1.6,.1,200)};
  sc.add(new THREE.HemisphereLight(0xffffff,0x667766,.95));
  const sun=new THREE.DirectionalLight(0xffffff,.55);sun.position.set(30,60,20);sc.add(sun);
  const L=(c,o)=>new THREE.MeshLambertMaterial(Object.assign({color:c,flatShading:true},o));
  const add=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);sc.add(o);return o};
  const bld=(x,z,w,h,d,c,rf)=>{add(new THREE.BoxGeometry(w,h,d),L(c),x,h/2,z);
    if(rf){const r=add(new THREE.ConeGeometry(Math.max(w,d)*.75,h*.4,4),L(rf),x,h+h*.2,z);r.rotation.y=Math.PI/4}
    G.col.push([x,z,w/2,d/2])};
  const tree=(x,z)=>{add(new THREE.CylinderGeometry(.3,.4,2,6),L(0x6b4a2b),x,1,z);add(new THREE.ConeGeometry(1.8,4,7),L(0x2f7a3f),x,4,z);G.col.push([x,z,.6,.6])};
  for(let z=0;z<3;z++){add(new THREE.PlaneGeometry(110,100),L(TH[z].grass),CX[z],0,0).rotation.x=-Math.PI/2}
  add(new THREE.PlaneGeometry(330,6),L(0x4f5662),110,.03,0).rotation.x=-Math.PI/2;
  const rsv=STAR.map(s=>[s[0],s[1]]);story.keputusan.forEach(q=>rsv.push(npcPos(q)));
  let sd=7;const rnd=()=>(sd=sd*16807%2147483647)/2147483647;
  for(let z=0;z<3;z++)for(let i=0;i<18;i++){const x=CX[z]+(rnd()-.5)*100,zz=(rnd()-.5)*60;
    if(Math.abs(zz)>6&&!rsv.some(r=>Math.hypot(r[0]-x,r[1]-zz)<7))tree(x,zz)}
  bld(0,-38,30,8,10,0xe2c79a,0xb5523b);bld(-30,38,8,4,8,0xd9c9a3,0x8c4a2f);bld(30,38,8,4,8,0xd9c9a3,0x8c4a2f);
  add(new THREE.CylinderGeometry(.15,.15,12,6),L(0xcccccc),-12,6,-26);
  add(new THREE.PlaneGeometry(3,1),L(0xc1121f,{side:2}),-10.5,11.5,-26);add(new THREE.PlaneGeometry(3,1),L(0xffffff,{side:2}),-10.5,10.5,-26);
  bld(110,-38,24,7,10,0xd9b98a,0x8c4a2f);bld(95,38,7,4,7,0xe6d3a3,0xa0522d);bld(140,40,8,4,8,0xe6d3a3,0xa0522d);bld(80,-38,7,4,7,0xe6d3a3,0xa0522d);bld(126,32,6,3,6,0xf0f0f0,0xe07a1f);
  bld(195,-40,12,22,12,0x8d99ad);bld(215,-40,14,30,12,0x7b8798);bld(240,-40,12,18,12,0x9aa6b8);bld(220,40,30,12,12,0xd8d2c4,0x6b5b4b);
  [208,214,226,232].forEach(x=>add(new THREE.CylinderGeometry(.8,.8,12,8),L(0xffffff),x,6,33.5));
  GX.forEach((gx,i)=>{
    [-5,5].forEach(z=>add(new THREE.BoxGeometry(1,9,1),L(0xc1121f),gx,4.5,z));
    add(new THREE.BoxGeometry(1,1.5,11),L(0xc1121f),gx,9,0);
    const l=lab(i<2?"Babak "+(i+2):"Akhir perjalanan","#c1121f");l.position.set(gx,11.5,0);sc.add(l);
    G.bars.push(add(new THREE.PlaneGeometry(10,8),L(0xc1121f,{transparent:true,opacity:.35,side:2}),gx,4,0));
    G.bars[i].rotation.y=Math.PI/2;
  });
  STAR.forEach(([x,z,s])=>G.stars.push({m:add(new THREE.OctahedronGeometry(.8),L(0xffc400,{emissive:0x664400}),x,1.8,z),s}));
  story.keputusan.forEach(q=>{const[x,z]=npcPos(q),g=person(NPCCOL[idxOf(q)%5],q.npc.split(",")[0]);g.position.set(x,0,z);sc.add(g);G.npc[q.id]={g,x,z,mk:null,st:null}});
  G.pl=person(0xc1121f);sc.add(G.pl);
  addEventListener("resize",resize);
}
function resize(){const s=$("stage");if(!s||!RN)return;const w=s.clientWidth;RN.setSize(w,Math.round(w/1.6),false)}

function start(){
  S={ind:{P:5,K:5,R:5,H:5},flags:[],i:0,babak:1,log:[],bintang:[]};
  if(typeof THREE==="undefined")return show('<section class="card"><h1>Gagal memuat 3D</h1><p class="err">Library three.js tidak termuat. Periksa koneksi internet lalu muat ulang halaman.</p></section>');
  try{if(!G)build()}catch(e){return show('<section class="card"><h1>Perangkat tidak mendukung 3D</h1><p class="err">Peramban ini tidak mendukung WebGL.</p></section>')}
  cancelAnimationFrame(raf);
  W={b:1,done:new Set(),x:-42,z:0,yaw:Math.PI/2,keys:{},busy:true,t:0,ac:null};
  show(`<div id="mt"></div><div id="stage"><div id="hud"><div id="cp"><span id="ar">▲</span><span id="tg"></span></div><div id="st"></div><div id="ts" hidden></div></div></div>
  <div class="ctl"><button id="bl" aria-label="Belok kiri">◀</button><button id="bu" aria-label="Maju">▲</button><button id="bd" aria-label="Mundur">▼</button><button id="br" aria-label="Belok kanan">▶</button><button id="sk">Antar ke tujuan</button></div><div id="dlg"></div>`);
  $("stage").prepend(RN.domElement);resize();
  G.stars.forEach(s=>s.m.visible=true);Object.values(G.npc).forEach(n=>n.st=null);
  sky(0);G.cam.position.set(-49.5,4.2,0);
  mt();bind();syncMarks();introB(1);
  raf=requestAnimationFrame(loop);
}

function introB(b){
  const t=story.babak[b-1];
  dlg(`<section class="card"><p class="meta">Babak ${b}</p><h2>${esc(t.judul)}</h2><p>${esc(t.intro)}</p>
  <p class="note">Berjalan: W A S D atau tombol panah (atau tombol di bawah layar). Temui orang bertanda ! dan kumpulkan 5 Bintang Sila yang tersebar di dunia ini.</p>
  <button class="main" id="ok">${b==1?"Mulai berjalan":"Lanjutkan"}</button></section>`);
  $("ok").onclick=()=>{try{W.ac=W.ac||new AudioContext()}catch(e){}$("dlg").innerHTML="";W.busy=false};
}

function syncMarks(){
  const cur=curQ();
  story.keputusan.forEach(q=>{
    const n=G.npc[q.id];n.g.visible=qsOf(q.babak).includes(q);
    const st=W.done.has(q.id)?"✓":cur===q?"!":"…",bg={"✓":"#2e9e5b","!":"#d99a00","…":"#6b7280"}[st];
    if(n.st!==st){n.st=st;if(n.mk)n.g.remove(n.mk);n.mk=lab(st,bg,64);n.mk.position.y=5;n.g.add(n.mk)}
  });
  G.bars.forEach((b,i)=>b.visible=!complete(i+1));
}

function bind(){
  [["bl","l"],["bu","u"],["bd","d"],["br","r"]].forEach(([id,k])=>{
    const b=$(id);
    b.onpointerdown=e=>{e.preventDefault();W.keys[k]=true};
    b.onpointerup=b.onpointerleave=b.onpointercancel=()=>{if(W)W.keys[k]=false};
  });
  $("sk").onclick=()=>{if(W.busy)return;const c=curQ();W.yaw=Math.PI/2;if(c){const n=G.npc[c.id];W.x=n.x-5;W.z=n.z}else{W.x=GX[W.b-1]-4;W.z=0}};
}
document.addEventListener("keydown",e=>{if(W&&KM[e.key]){W.keys[KM[e.key]]=true;e.preventDefault()}});
document.addEventListener("keyup",e=>{if(W&&KM[e.key])W.keys[KM[e.key]]=false});

function hud(){
  const cur=curQ();let tx,tz,nm;
  if(cur){const n=G.npc[cur.id];tx=n.x;tz=n.z;nm=cur.npc.split(",")[0]}
  else{tx=GX[W.b-1];tz=0;nm=W.b<3?"Gerbang ke Babak "+(W.b+1):"Gerbang akhir"}
  $("ar").style.transform=`rotate(${-(Math.atan2(tx-W.x,tz-W.z)-W.yaw)}rad)`;
  $("tg").textContent=`${nm} (${Math.hypot(tx-W.x,tz-W.z)|0} m)`;
  $("st").textContent="★ "+S.bintang.length+"/5";
}

function loop(ts){
  if(!W||!RN.domElement.isConnected)return;
  const dt=Math.min(.05,(ts-(W.last||ts))/1000);W.last=ts;W.t+=dt;
  const z=zoneOf(W.x);
  if(z>W.b){W.b=z;W.busy=true;sky(z-1);syncMarks();introB(z)}
  let mv=0;
  if(!W.busy){
    const k=W.keys;mv=(k.u?1:0)-(k.d?.5:0);
    W.yaw+=((k.l?1:0)-(k.r?1:0))*2.2*dt;
    W.x+=Math.sin(W.yaw)*mv*9*dt;W.z+=Math.cos(W.yaw)*mv*9*dt;
    for(const c of G.col){const dx=W.x-c[0],dz=W.z-c[1],ox=c[2]+.6-Math.abs(dx),oz=c[3]+.6-Math.abs(dz);
      if(ox>0&&oz>0){if(ox<oz)W.x+=Math.sign(dx)*ox;else W.z+=Math.sign(dz)*oz}}
    let g=0;while(g<3&&complete(g+1))g++;
    W.x=Math.max(-48,Math.min(g<3?GX[g]-1.6:GX[2]+3,W.x));W.z=Math.max(-46,Math.min(46,W.z));
    if(g===3&&W.x>=GX[2]-1){W.busy=true;finish();return}
    const cur=curQ();
    if(cur){const n=G.npc[cur.id];if(Math.hypot(n.x-W.x,n.z-W.z)<3.6){W.busy=true;n.g.rotation.y=Math.atan2(W.x-n.x,W.z-n.z);ask(cur)}}
    G.stars.forEach(s=>{if(s.m.visible&&Math.hypot(s.m.position.x-W.x,s.m.position.z-W.z)<1.8){s.m.visible=false;S.bintang.push(s.s);toast("Bintang Sila "+(s.s+1)+": "+SILA[s.s]);beep(1046)}});
  }
  const p=G.pl,sw=mv?Math.sin(W.t*10)*.7:0;
  p.position.set(W.x,0,W.z);p.rotation.y=W.yaw;p.legs[0].rotation.x=sw;p.legs[1].rotation.x=-sw;
  G.cam.position.lerp(new THREE.Vector3(W.x-Math.sin(W.yaw)*7.5,4.2,W.z-Math.cos(W.yaw)*7.5),1-Math.exp(-6*dt));
  G.cam.lookAt(W.x,2,W.z);
  G.stars.forEach(s=>{s.m.rotation.y=W.t*2;s.m.position.y=1.8+Math.sin(W.t*2+s.s)*.25});
  hud();RN.render(G.sc,G.cam);
  raf=requestAnimationFrame(loop);
}

function ask(q){
  beep(520);
  dlg(`<section class="card"><p class="npc">${esc(q.npc)}</p><p>${esc(q.teks)}</p>
  ${q.opsi.map((o,i)=>`<button data-i="${i}">${esc(o.t)}</button>`).join("")}</section>`);
  $("dlg").querySelectorAll("[data-i]").forEach(b=>b.onclick=()=>choose(q,+b.dataset.i));
}

function choose(q,i){
  const o=q.opsi[i],d=[];
  for(const k in o.e){S.ind[k]=Math.max(0,Math.min(10,S.ind[k]+o.e[k]));d.push(`${IND[k]} ${o.e[k]>0?"+":"−"}${Math.abs(o.e[k])}`)}
  if(o.f)S.flags.push(o.f);
  S.log.push({q:q.id,t:o.t,u:o.u});
  api("log",{pertanyaan:q.id,jawaban:i,efek:o.e,skor:S.ind});
  mt();
  dlg(`<section class="card fb"><p class="meta">Pilihanmu: ${esc(o.t)}</p><p>${esc(o.u)}</p><p class="note">${d.join(", ")}</p><button class="main" id="ok">Lanjutkan perjalanan</button></section>`);
  $("ok").onclick=()=>{
    W.done.add(q.id);$("dlg").innerHTML="";W.busy=false;syncMarks();
    if(complete(W.b)){beep(660);toast(W.b<3?"Gerbang ke Babak "+(W.b+1)+" terbuka. Berjalanlah ke arah timur (kanan).":"Semua terjawab. Menuju gerbang akhir.")}
  };
}

function endingKey(){
  const{P,K,R,H}=S.ind,avg=(P+K+R+H)/4;
  if(avg>=7&&Math.min(P,K,R,H)>=5)return"emas";
  if(avg<=3.5)return"hilang";
  if(P>=6&&H<=4)return"rukun";
  if(H>=6&&P<=4)return"tegak";
  return"tengah";
}

async function finish(){
  W=null;cancelAnimationFrame(raf);
  const key=endingKey(),e=story.ending[key],ind=Object.values(S.ind).reduce((a,b)=>a+b,0),skor=ind*2+S.bintang.length*4,pr=PRED.find(p=>skor>=p[0]);
  api("finish",{ending:key,skor,flags:S.flags});
  show(meters()+`<section class="card"><p class="meta">Indonesia 2045</p><h1>${esc(pr[1])}</h1><p>${esc(pr[2])}</p>
  <p><strong>Skor akhir: ${skor} dari 100</strong><br><span class="note">Indikator ${ind} × 2, ditambah ${S.bintang.length} bintang × 4</span></p>
  <p class="note">Bintang Sila: ${S.bintang.length?S.bintang.map(i=>"★ "+esc(SILA[i])).join("; "):"belum ada"}</p></section>
  <section class="card"><h2>${esc(e.judul)}</h2><p>${esc(e.teks)}</p></section>
  <section class="card fb"><h2>Refleksi</h2><p>Pilihan mana yang terasa paling sulit? Jika diulang, apa yang akan kamu ubah, dan mengapa?</p>
  <ol class="rk">${S.log.map(l=>`<li>${esc(l.t)}<br><span class="note">${esc(l.u)}</span></li>`).join("")}</ol>
  <button class="main" id="again">Main lagi untuk menemukan ending lain</button><button id="lb">Lihat papan peringkat</button></section>`);
  $("again").onclick=start;$("lb").onclick=board;
}

async function board(){
  const r=await api("leaderboard");
  show(`<section class="card"><h1>Papan peringkat</h1><p class="note">Diurutkan menurut jumlah ending berbeda yang ditemukan.</p>
  ${r.ok?`<ol class="rk">${r.rows.slice(0,20).map(x=>`<li>${esc(x.username)}: ${esc(x.endings)} ending, skor terbaik ${esc(x.best)}</li>`).join("")}</ol>`:`<p class="err">${esc(r.error||"Gagal memuat.")}</p>`}
  <button class="main" id="back">Kembali</button></section>`);
  $("back").onclick=menu;
}

showLogin();
