const STORAGE_KEY = "safeserve_demo_v1";
const todayISO = () => new Date().toISOString().slice(0,10);
const plusDays = n => { const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); };
const seed = {
  inventory:[
    {id:1,name:"Fresh milk",category:"Dairy",quantity:12,unit:"litres",expiry:plusDays(1),location:"Chiller"},
    {id:2,name:"Whole wheat bread",category:"Bakery",quantity:18,unit:"packs",expiry:plusDays(4),location:"Dry storage"},
    {id:3,name:"Tomatoes",category:"Vegetables",quantity:8,unit:"kg",expiry:plusDays(2),location:"Vegetable rack"},
    {id:4,name:"Paneer",category:"Dairy",quantity:5,unit:"kg",expiry:plusDays(-1),location:"Chiller"}
  ],
  hygiene:[
    {id:1,title:"Clean food preparation surfaces",detail:"Before and after food preparation",done:true},
    {id:2,title:"Review refrigerator temperature record",detail:"Record the reading in the canteen log",done:false},
    {id:3,title:"Check food labels and date markings",detail:"Review stored and prepared food labels",done:false},
    {id:4,title:"Clean handwashing station",detail:"Check soap and hand-drying supplies",done:true},
    {id:5,title:"Verify waste bins are covered",detail:"Check bin condition and disposal area",done:false},
    {id:6,title:"Clean serving counter",detail:"Complete before service begins",done:false}
  ],
  issues:[
    {id:1,title:"Water dispenser area needs cleaning",description:"Customer reported that the area should be checked.",status:"Under Review",date:todayISO(),action:"Staff inspection pending"},
    {id:2,title:"Menu display is difficult to read",description:"A student suggested improving the menu display.",status:"Reported",date:todayISO(),action:""}
  ],
  waste:[
    {id:1,food:"Cooked rice",quantity:1.2,unit:"kg",reason:"Over-preparation",date:todayISO()},
    {id:2,food:"Chopped vegetables",quantity:0.6,unit:"kg",reason:"Preparation waste",date:todayISO()},
    {id:3,food:"Bread",quantity:0.4,unit:"kg",reason:"Expired",date:todayISO()}
  ]
};
let data = loadData();
let activeView = "dashboard";
let currentFormType = "";

function loadData(){try{const saved=localStorage.getItem(STORAGE_KEY);return saved?JSON.parse(saved):structuredClone(seed)}catch{return structuredClone(seed)}}
function saveData(){localStorage.setItem(STORAGE_KEY,JSON.stringify(data));renderAll()}
function escapeHTML(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function dateDiff(date){const a=new Date(todayISO()+"T00:00:00"),b=new Date(date+"T00:00:00");return Math.round((b-a)/86400000)}
function expiryStatus(item){const days=dateDiff(item.expiry);if(days<0)return {label:"Expired",cls:"danger"};if(days<=3)return {label:days===0?"Expires today":`In ${days} day${days===1?"":"s"}`,cls:"warning"};return {label:"In date",cls:"good"}}
function formatDate(date){return new Date(date+"T00:00:00").toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}
function setView(view){activeView=view;document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));document.getElementById(view+"View").classList.remove("hidden");document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));document.getElementById("breadcrumbCurrent").textContent=view[0].toUpperCase()+view.slice(1);document.getElementById("sidebar").classList.remove("open");renderAll()}
function renderAll(){renderDashboard();renderInventory();renderHygiene();renderIssues();renderWaste();document.getElementById("inventoryNavCount").textContent=data.inventory.length;document.getElementById("issueNavCount").textContent=data.issues.filter(i=>i.status!=="Resolved").length}
function renderDashboard(){
 const attention=data.inventory.filter(i=>dateDiff(i.expiry)<=3).length,pending=data.hygiene.filter(t=>!t.done).length,open=data.issues.filter(i=>i.status!=="Resolved").length,total=data.waste.reduce((s,w)=>s+Number(w.quantity),0);
 document.getElementById("statInventory").textContent=data.inventory.length;document.getElementById("statExpiry").textContent=attention;document.getElementById("statHygiene").textContent=pending;document.getElementById("statIssues").textContent=open;document.getElementById("wasteTotal").textContent=total.toFixed(1)+" kg";
 const soon=data.inventory.filter(i=>dateDiff(i.expiry)<=3).sort((a,b)=>a.expiry.localeCompare(b.expiry)).slice(0,4);
 document.getElementById("expiryPreview").innerHTML=soon.length?tableHTML(["Food item","Quantity","Expiry","Status"],soon.map(i=>{const s=expiryStatus(i);return `<tr><td class="food-name">${escapeHTML(i.name)}</td><td>${i.quantity} ${escapeHTML(i.unit)}</td><td>${formatDate(i.expiry)}</td><td><span class="status ${s.cls}">${s.label}</span></td></tr>`})):empty("No items need expiry attention right now.");
 document.getElementById("hygienePreview").innerHTML=data.hygiene.slice(0,4).map(t=>`<div class="task-row ${t.done?"done":""}"><span class="task-check ${t.done?"done":""}">${t.done?"✓":""}</span><span>${escapeHTML(t.title)}</span></div>`).join("");
 const recent=data.issues.slice().sort((a,b)=>b.id-a.id).slice(0,3);
 document.getElementById("issuePreview").innerHTML=recent.length?recent.map(i=>`<div class="issue-line"><div><strong>${escapeHTML(i.title)}</strong><small>${formatDate(i.date)}</small></div><span class="status ${statusClass(i.status)}">${escapeHTML(i.status)}</span></div>`).join(""):empty("No concerns have been reported.");
}
function tableHTML(headers,rows){return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`}
function empty(msg){return `<div class="empty-state">${msg}</div>`}
function renderInventory(){
 const q=(document.getElementById("inventorySearch")?.value||"").toLowerCase(),filter=document.getElementById("inventoryFilter")?.value||"all";
 let items=data.inventory.filter(i=>i.name.toLowerCase().includes(q)||i.category.toLowerCase().includes(q));
 if(filter==="attention")items=items.filter(i=>dateDiff(i.expiry)<=3);if(filter==="good")items=items.filter(i=>dateDiff(i.expiry)>3);
 const rows=items.map(i=>{const s=expiryStatus(i);return `<tr><td class="food-name">${escapeHTML(i.name)}<br><span class="muted-cell">${escapeHTML(i.category)}</span></td><td>${i.quantity} ${escapeHTML(i.unit)}</td><td>${formatDate(i.expiry)}</td><td>${escapeHTML(i.location)}</td><td><span class="status ${s.cls}">${s.label}</span></td><td><button class="text-btn" data-delete-inventory="${i.id}">Remove</button></td></tr>`});
 document.getElementById("inventoryTable").innerHTML=items.length?tableHTML(["Food item","Quantity","Expiry date","Storage","Status",""],rows):empty("No inventory items match this view.");
}
function renderHygiene(){
 const done=data.hygiene.filter(t=>t.done).length,pct=data.hygiene.length?Math.round(done/data.hygiene.length*100):0;
 document.getElementById("hygieneProgressText").textContent=`${pct}% complete · ${done}/${data.hygiene.length} tasks`;document.getElementById("hygieneProgressBar").style.width=pct+"%";
 document.getElementById("hygieneList").innerHTML=data.hygiene.map(t=>`<label class="hygiene-card ${t.done?"completed":""}"><input type="checkbox" data-task="${t.id}" ${t.done?"checked":""}><span><strong>${escapeHTML(t.title)}</strong><small>${escapeHTML(t.detail)}</small></span></label>`).join("");
}
function statusClass(s){return s==="Resolved"?"resolved":s==="Under Review"?"review":"warning"}
function renderIssues(){
 const reported=data.issues.filter(i=>i.status==="Reported").length,review=data.issues.filter(i=>i.status==="Under Review").length,resolved=data.issues.filter(i=>i.status==="Resolved").length;
 document.getElementById("issueSummary").innerHTML=[["Reported",reported],["Under review",review],["Resolved",resolved]].map(([l,n])=>`<div class="summary-box"><strong>${n}</strong><small>${l}</small></div>`).join("");
 document.getElementById("issuesList").innerHTML=data.issues.length?data.issues.slice().sort((a,b)=>b.id-a.id).map(i=>`<article class="issue-card"><div class="issue-symbol">⚑</div><div class="issue-detail"><strong>${escapeHTML(i.title)}</strong><p>${escapeHTML(i.description)}</p><small>Reported ${formatDate(i.date)}${i.action?" · Action: "+escapeHTML(i.action):""}</small></div><div class="issue-controls"><span class="status ${statusClass(i.status)}">${escapeHTML(i.status)}</span><select aria-label="Update issue status" data-issue-status="${i.id}"><option ${i.status==="Reported"?"selected":""}>Reported</option><option ${i.status==="Under Review"?"selected":""}>Under Review</option><option ${i.status==="Resolved"?"selected":""}>Resolved</option></select></div></article>`).join(""):empty("No issues yet. Use Report concern to add the first one.");
}
function renderWaste(){
 const total=data.waste.reduce((s,w)=>s+Number(w.quantity),0),count=data.waste.length,avg=count?total/count:0;
 document.getElementById("wasteStats").innerHTML=[["Total recorded",total.toFixed(1)+" kg"],["Waste entries",count],["Average per entry",avg.toFixed(2)+" kg"]].map(([l,n])=>`<div class="summary-box"><strong>${n}</strong><small>${l}</small></div>`).join("");
 const reasons={};data.waste.forEach(w=>reasons[w.reason]=(reasons[w.reason]||0)+Number(w.quantity));const max=Math.max(1,...Object.values(reasons));
 document.getElementById("wasteReasons").innerHTML=Object.keys(reasons).length?Object.entries(reasons).sort((a,b)=>b[1]-a[1]).map(([r,v])=>`<div class="reason-row"><span>${escapeHTML(r)}</span><div class="bar-track"><span style="width:${v/max*100}%"></span></div><strong>${v.toFixed(1)} kg</strong></div>`).join(""):empty("No waste reasons recorded yet.");
 document.getElementById("wasteLogs").innerHTML=data.waste.length?data.waste.slice().sort((a,b)=>b.id-a.id).map(w=>`<div class="waste-log"><div><strong>${escapeHTML(w.food)}</strong><small>${escapeHTML(w.reason)} · ${formatDate(w.date)}</small></div><b>${Number(w.quantity).toFixed(1)} ${escapeHTML(w.unit)}</b></div>`).join(""):empty("No waste logs yet.");
}
function showModal(type){
 currentFormType=type;const config={
 stock:{title:"Add inventory item",fields:[["name","Food item name","text",true],["category","Category","select",true,["Dairy","Bakery","Vegetables","Fruits","Grains","Other"]],["quantity","Quantity","number",true],["unit","Unit","select",true,["kg","litres","packs","pieces","boxes"]],["expiry","Expiry date","date",true],["location","Storage location","text",true]]},
 issue:{title:"Report a concern",fields:[["title","Concern title","text",true],["description","Describe the concern","textarea",true],["action","Initial follow-up note","text",false]]},
 waste:{title:"Log food waste",fields:[["food","Food item","text",true],["quantity","Quantity discarded","number",true],["unit","Unit","select",true,["kg","litres","pieces"]],["reason","Reason","select",true,["Over-preparation","Expired","Preparation waste","Storage issue","Other"]],["date","Date recorded","date",true]]}
 }[type];
 document.getElementById("modalTitle").textContent=config.title;
 document.getElementById("formFields").innerHTML=`<div class="form-grid">${config.fields.map(([name,label,kind,required,opts])=>`<div class="field ${kind==="textarea"?"full":""}"><label for="f_${name}">${label}${required?" *":""}</label>${kind==="select"?`<select id="f_${name}" name="${name}" ${required?"required":""}>${opts.map(o=>`<option>${o}</option>`).join("")}</select>`:kind==="textarea"?`<textarea id="f_${name}" name="${name}" rows="3" ${required?"required":""}></textarea>`:`<input id="f_${name}" name="${name}" type="${kind}" ${kind==="number"?'min="0.1" step="0.1"':""} ${kind==="date"&&name==="date"?`value="${todayISO()}"`:""} ${required?"required":""}>`}</div>`).join("")}</div>`;
 document.getElementById("modalBackdrop").classList.remove("hidden");
}
function closeModal(){document.getElementById("modalBackdrop").classList.add("hidden");document.getElementById("recordForm").reset()}
function toast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}
document.addEventListener("click",e=>{
 const nav=e.target.closest("[data-view]");if(nav){setView(nav.dataset.view);return}
 const action=e.target.closest("[data-action]");if(action){showModal(action.dataset.action==="add-stock"?"stock":action.dataset.action==="add-issue"?"issue":"waste");return}
 const del=e.target.closest("[data-delete-inventory]");if(del){data.inventory=data.inventory.filter(i=>i.id!==Number(del.dataset.deleteInventory));saveData();toast("Inventory item removed.");}
});
document.addEventListener("change",e=>{
 if(e.target.matches("[data-task]")){const t=data.hygiene.find(t=>t.id===Number(e.target.dataset.task));if(t)t.done=e.target.checked;saveData()}
 if(e.target.matches("[data-issue-status]")){const i=data.issues.find(i=>i.id===Number(e.target.dataset.issueStatus));if(i){i.status=e.target.value;if(i.status==="Resolved"&&!i.action)i.action="Marked resolved by staff";saveData();toast("Issue status updated.")}}
 if(e.target.id==="inventoryFilter")renderInventory();
});
document.getElementById("inventorySearch").addEventListener("input",renderInventory);
document.getElementById("closeModal").addEventListener("click",closeModal);document.getElementById("cancelModal").addEventListener("click",closeModal);
document.getElementById("modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal()});
document.getElementById("recordForm").addEventListener("submit",e=>{
 e.preventDefault();const form=Object.fromEntries(new FormData(e.target).entries());const id=Date.now();
 if(currentFormType==="stock"){data.inventory.push({id,name:form.name.trim(),category:form.category,quantity:Number(form.quantity),unit:form.unit,expiry:form.expiry,location:form.location.trim()})}
 if(currentFormType==="issue"){data.issues.push({id,title:form.title.trim(),description:form.description.trim(),status:"Reported",date:todayISO(),action:form.action.trim()})}
 if(currentFormType==="waste"){data.waste.push({id,food:form.food.trim(),quantity:Number(form.quantity),unit:form.unit,reason:form.reason,date:form.date})}
 saveData();closeModal();toast("Record saved successfully.");
});
document.getElementById("resetTasks").addEventListener("click",()=>{data.hygiene.forEach(t=>t.done=false);saveData();toast("Checklist reset for demo.")});
document.getElementById("mobileMenu").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
document.getElementById("todayLabel").textContent=new Date().toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
renderAll();
