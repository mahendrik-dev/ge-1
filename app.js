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

let W,raf;
const THEME=[
 {sky:["#8ecdf2","#e6f4fb"],far:"#7fb08d",bld:"#e2c79a",grass:"#6fae5a",road:"#4f5662",k:1},
 {sky:["#f4b678","#fde7c8"],far:"#a39c76",bld:"#d9b98a",grass:"#8fa54f",road:"#5a5148",k:1.1},
 {sky:["#aab7cc","#e3e8f0"],far:"#7e8ca3",bld:"#8d99ad",grass:"#6b8f6a",road:"#454b57",k:1.7}];
const NPCCOL=["#2a6f97","#7b2d8f","#e07a1f","#1b7f5c","#8a5a44"];
const KM={ArrowLeft:"l",a:"l",A:"l",ArrowRight:"r",d:"r",D:"r"};
const dlg=h=>{const d=$("dlg");d.innerHTML=h;d.scrollIntoView({block:"nearest"})};
const mt=()=>{$("mt").innerHTML=meters()};

function start(){S={ind:{P:5,K:5,R:5,H:5},flags:[],i:0,babak:0,log:[]};startBabak(1)}

function startBabak(b){
  cancelAnimationFrame(raf);
  const qs=story.keputusan.filter(q=>q.babak===b&&(!q.syarat||S.flags.includes(q.syarat)));
  W={b,qs,done:new Set(),x:40,busy:true,step:0,keys:{},npcX:qs.map((_,i)=>320+i*330)};
  W.end=W.npcX[qs.length-1]+330;
  S.babak=b;
  show(`<div id="mt"></div><canvas id="cv" width="640" height="280" role="img" aria-label="Jalan menuju babak ${b}. Berjalan dengan tombol panah atau A dan D."></canvas>
  <div class="ctl"><button id="bl" aria-label="Jalan ke kiri">◀</button><button id="br" aria-label="Jalan ke kanan">▶</button><button id="sk">Ke orang berikutnya</button></div><div id="dlg"></div>`);
  mt();bind();
  const t=story.babak[b-1];
  dlg(`<section class="card"><p class="meta">Babak ${b}</p><h2>${esc(t.judul)}</h2><p>${esc(t.intro)}</p>
  <p class="note">Berjalanlah dengan tombol panah atau A dan D. Hampiri setiap orang di jalan; kamu baru bisa melanjutkan perjalanan setelah menjawabnya.</p>
  <button class="main" id="ok">Mulai berjalan</button></section>`);
  $("ok").onclick=()=>{$("dlg").innerHTML="";W.busy=false};
  loop();
}

function limit(){const nx=W.qs.findIndex(q=>!W.done.has(q.id));return{nx,max:nx<0?W.end:W.npcX[nx]-55}}

function bind(){
  [["bl","l"],["br","r"]].forEach(([id,k])=>{
    const b=$(id);
    b.onpointerdown=e=>{e.preventDefault();W.keys[k]=true};
    b.onpointerup=b.onpointerleave=b.onpointercancel=()=>{if(W)W.keys[k]=false};
  });
  $("sk").onclick=()=>{if(!W.busy)W.x=limit().max};
}
document.addEventListener("keydown",e=>{if(W&&KM[e.key]){W.keys[KM[e.key]]=true;e.preventDefault()}});
document.addEventListener("keyup",e=>{if(W&&KM[e.key])W.keys[KM[e.key]]=false});

function loop(){
  if(!W||!$("cv"))return;
  if(!W.busy){
    const v=(W.keys.r?1:0)-(W.keys.l?1:0),{nx,max}=limit();
    W.x=Math.max(20,Math.min(max,W.x+v*2.6));
    if(v)W.step+=.25;
    if(W.x>=max-1){
      W.busy=true;
      if(nx>=0)ask(W.qs[nx]);
      else{W.b<story.babak.length?startBabak(W.b+1):finish();return}
    }
  }
  draw();
  raf=requestAnimationFrame(loop);
}

function person(g,x,y,col,st,label,mark){
  const l=Math.sin(st)*5;
  g.fillStyle="#222";g.fillRect(x-7,y-18,6,18+l);g.fillRect(x+1,y-18,6,18-l);
  g.fillStyle=col;g.fillRect(x-10,y-44,20,28);
  g.fillStyle="#e8b98f";g.beginPath();g.arc(x,y-53,9,0,7);g.fill();
  g.font="bold 12px sans-serif";g.textAlign="center";
  const w=g.measureText(label).width+10;
  g.fillStyle="rgba(20,33,61,.85)";g.fillRect(x-w/2,y-84,w,17);g.fillStyle="#fff";g.fillText(label,x,y-71);
  if(mark){g.fillStyle=mark==="!"?"#f5b700":"#2e9e5b";g.beginPath();g.arc(x,y-98,9,0,7);g.fill();
    g.fillStyle="#14213d";g.font="bold 13px sans-serif";g.fillText(mark,x,y-93)}
}

function draw(){
  const g=$("cv").getContext("2d"),T=THEME[W.b-1],cam=Math.max(0,W.x-220),gy=205,fy=gy+58;
  const sg=g.createLinearGradient(0,0,0,gy);sg.addColorStop(0,T.sky[0]);sg.addColorStop(1,T.sky[1]);
  g.fillStyle=sg;g.fillRect(0,0,640,280);
  g.fillStyle=T.far;
  for(let i=0;i<5;i++){const x=i*260-(cam*.25)%260;g.beginPath();g.ellipse(x+130,gy-8,170,75,0,Math.PI,0);g.fill()}
  const o=Math.floor(cam*.6/150);
  for(let i=0;i<6;i++){
    const idx=i+o,x=i*150-(cam*.6)%150,h=(55+(idx*37%5)*13)*T.k;
    g.fillStyle=T.bld;g.fillRect(x,gy-h,110,h);g.fillStyle="rgba(255,255,255,.55)";
    for(let r=0;r<h/28-1;r++)for(let k=0;k<3;k++)g.fillRect(x+14+k*30,gy-h+12+r*28,14,14);
  }
  g.fillStyle=T.grass;g.fillRect(0,gy-4,640,90);
  g.fillStyle=T.road;g.fillRect(0,gy+22,640,52);
  g.fillStyle="#f4f1e6";for(let x=-(cam%60);x<640;x+=60)g.fillRect(x,gy+46,30,4);
  const t0=Math.floor(cam/200);
  for(let j=t0;j<t0+5;j++){const x=j*200+90-cam;g.fillStyle="#6b4a2b";g.fillRect(x-4,gy-26,8,34);g.fillStyle="#2f7a3f";g.beginPath();g.arc(x,gy-34,22,0,7);g.fill()}
  const ex=W.end-cam,last=W.b>=story.babak.length;
  g.fillStyle="#c1121f";g.fillRect(ex-34,gy-50,8,124);g.fillRect(ex+26,gy-50,8,124);g.fillRect(ex-34,gy-50,68,16);
  g.fillStyle="#fff";g.font="bold 11px sans-serif";g.textAlign="center";g.fillText(last?"Akhir":"Babak "+(W.b+1),ex,gy-38);
  W.qs.forEach((q,i)=>{const x=W.npcX[i]-cam;if(x>-50&&x<690)person(g,x,fy,NPCCOL[i%5],0,q.npc.split(",")[0],W.done.has(q.id)?"✓":"!")});
  person(g,W.x-cam,fy,"#c1121f",W.step,"Kamu");
  g.textAlign="left";g.font="bold 13px sans-serif";g.fillStyle="rgba(20,33,61,.85)";g.fillRect(8,8,300,24);g.fillStyle="#fff";
  g.fillText(limit().nx<0?"Semua terjawab. Lanjutkan ke kanan.":`Orang yang sudah dihampiri: ${W.done.size} dari ${W.qs.length}`,16,25);
}

function ask(q){
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
  $("ok").onclick=()=>{W.done.add(q.id);$("dlg").innerHTML="";W.busy=false};
}

function endingKey(){
  const{P,K,R,H}=S.ind,avg=(P+K+R+H)/4;
  if(avg>=7&&Math.min(P,K,R,H)>=5)return"emas";
  if(avg<=3.5)return"hilang";
  if(P>=6&&H<=4)return"rukun";
  if(H>=6&&P<=4)return"tegak";
  return"tengah";
}

async function finish(){W=null;cancelAnimationFrame(raf);
  const key=endingKey(),e=story.ending[key],skor=Object.values(S.ind).reduce((a,b)=>a+b,0);
  api("finish",{ending:key,skor,flags:S.flags});
  show(meters()+`<section class="card"><p class="meta">Indonesia 2045</p><h1>${esc(e.judul)}</h1><p>${esc(e.teks)}</p></section>
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
