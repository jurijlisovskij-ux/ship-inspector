const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const storeKey = 'shipInspectorMVP_v03';
let deferredPrompt = null;
let recordType = 'condition';
let state = loadState();

function defaultState(){return {inspection:null, records:[], workplan:[], nextRecordNo:1, nextWorkNo:1};}
function loadState(){try{return {...defaultState(), ...JSON.parse(localStorage.getItem(storeKey)||'{}')}}catch{return defaultState()}}
function saveState(){localStorage.setItem(storeKey, JSON.stringify(state)); renderAll();}
function today(){return new Date().toISOString().slice(0,10)}
function esc(s=''){return String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function fmtDate(s){if(!s)return '—'; const [y,m,d]=s.split('-'); return `${d}.${m}.${y}`}

function switchView(name){$$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===name));$$('.view').forEach(v=>v.classList.toggle('active',v.id===`view-${name}`)); window.scrollTo({top:0,behavior:'smooth'});}
$$('.tab').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
$$('.go-workplan').forEach(b=>b.addEventListener('click',()=>switchView('workplan')));

$('#newInspectionBtn').addEventListener('click',()=>{switchView('inspection');$('#vesselName').focus()});
$('#continueBtn').addEventListener('click',()=>switchView('inspection'));
$('#quickFindingBtn').addEventListener('click',()=>openRecordDialog('finding'));
$('#quickConditionBtn').addEventListener('click',()=>openRecordDialog('condition'));
$('#dateFrom').value=today();$('#dateTo').value=today();

$('#startInspectionBtn').addEventListener('click',()=>{
 const vessel=$('#vesselName').value.trim(); if(!vessel)return alert('Enter vessel name.');
 state.inspection={vessel, imo:$('#imo').value.trim(), port:$('#port').value.trim(), dateFrom:$('#dateFrom').value, dateTo:$('#dateTo').value, inspector:$('#inspector').value.trim(), reason:$('#reason').value.trim(), createdAt:new Date().toISOString()};
 state.records=[]; state.nextRecordNo=1; saveState();
});

$('#addRecordBtn').addEventListener('click',openRecordDialog);
function openRecordDialog(type='condition'){
 recordType=type; $('#recordForm').reset(); $('#recordCondition').value='Good'; $('#addToWorkPlan').checked=true; $('#photoPreview').innerHTML=''; toggleRecordType(); $('#recordDialog').showModal();
}
$('#recordTypeGroup').addEventListener('click',e=>{const b=e.target.closest('button[data-type]');if(!b)return;recordType=b.dataset.type;toggleRecordType()});
function toggleRecordType(){
 $$('#recordTypeGroup button').forEach(b=>b.classList.toggle('active',b.dataset.type===recordType));
 $('#conditionFields').hidden=recordType!=='condition'; $('#findingFields').hidden=recordType!=='finding';
}
$('#recordPhotos').addEventListener('change',async e=>{
 const files=[...e.target.files].slice(0,10); const urls=[];
 for(const f of files) urls.push(await compressImage(f,1200,.72));
 e.target._dataUrls=urls; $('#photoPreview').innerHTML=urls.map(u=>`<img src="${u}">`).join('');
});
async function compressImage(file,maxW=1200,quality=.72){return new Promise((resolve,reject)=>{const img=new Image();const fr=new FileReader();fr.onload=()=>img.src=fr.result;fr.onerror=reject;img.onload=()=>{const scale=Math.min(1,maxW/img.width);const c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext('2d').drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',quality));};fr.readAsDataURL(file);})}

$('#recordForm').addEventListener('submit',e=>{
 e.preventDefault(); if(!state.inspection)return;
 const rec={id:crypto.randomUUID(),no:state.nextRecordNo++,type:recordType,area:$('#recordArea').value,location:$('#recordLocation').value.trim(),description:$('#recordDescription').value.trim(),condition:recordType==='condition'?$('#recordCondition').value:null,priority:recordType==='finding'?$('#recordPriority').value:null,includeSummary:recordType==='finding'&&$('#includeSummary').checked,photos:$('#recordPhotos')._dataUrls||[],createdAt:new Date().toISOString()};
 if(!rec.description && !rec.location)return alert('Enter location or description.');
 state.records.push(rec);
 if(recordType==='finding' && $('#addToWorkPlan').checked){state.workplan.push({id:crypto.randomUUID(),no:state.nextWorkNo++,sourceRecordNo:rec.no,description:[rec.location,rec.description].filter(Boolean).join(' — '),responsible:'',dueDate:'',progress:0,remarks:'',createdAt:new Date().toISOString()});}
 $('#recordDialog').close(); saveState(); setTimeout(()=>openRecordDialog(recordType),80);
});

$$('[data-close]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.close).close()));
$('#printReportBtn').addEventListener('click',()=>{document.title=`${state.inspection?.vessel||'Vessel'} Superintendent Inspection`;window.print()});

$('#addWorkBtn').addEventListener('click',()=>openWorkDialog());
function openWorkDialog(item=null){$('#workForm').reset();$('#workDialogTitle').textContent=item?`Work No. ${item.no}`:'Add Work';$('#workId').value=item?.id||'';$('#workDescription').value=item?.description||'';$('#workResponsible').value=item?.responsible||'';$('#workDueDate').value=item?.dueDate||'';$('#workProgress').value=item?.progress??0;$('#workRemarks').value=item?.remarks||'';$('#workDialog').showModal();}
$('#workForm').addEventListener('submit',e=>{e.preventDefault();const id=$('#workId').value;const p=Math.max(0,Math.min(100,Number($('#workProgress').value||0)));if(id){const w=state.workplan.find(x=>x.id===id);Object.assign(w,{description:$('#workDescription').value.trim(),responsible:$('#workResponsible').value.trim(),dueDate:$('#workDueDate').value,progress:p,remarks:$('#workRemarks').value.trim(),updatedAt:new Date().toISOString()});}else{state.workplan.push({id:crypto.randomUUID(),no:state.nextWorkNo++,description:$('#workDescription').value.trim(),responsible:$('#workResponsible').value.trim(),dueDate:$('#workDueDate').value,progress:p,remarks:$('#workRemarks').value.trim(),createdAt:new Date().toISOString()});}$('#workDialog').close();saveState();});
$('#workSearch').addEventListener('input',renderWorkPlan);$('#workFilter').addEventListener('change',renderWorkPlan);

function renderAll(){renderInspection();renderDashboard();renderWorkPlan();renderReview();}
function renderDashboard(){const i=state.inspection;$('#dashInspectionTitle').textContent=i?`${i.vessel} — ${fmtDate(i.dateFrom)}`:'No inspection started';$('#dashStats').innerHTML=i?statsHtml():''}
function statsHtml(){const findings=state.records.filter(r=>r.type==='finding').length;const urgent=state.records.filter(r=>r.priority==='Urgent').length;const photos=state.records.reduce((n,r)=>n+(r.photos?.length||0),0);return `<span class="stat">Records ${state.records.length}</span><span class="stat">Findings ${findings}</span><span class="stat">Urgent ${urgent}</span><span class="stat">Photos ${photos}</span>`}
function renderInspection(){const i=state.inspection;$('#inspectionSetup').hidden=!!i;$('#inspectionWorkspace').hidden=!i;if(!i)return;$('#inspectionHeading').textContent=i.vessel;$('#inspectionMeta').textContent=`IMO ${i.imo||'—'} · ${i.port||'—'} · ${fmtDate(i.dateFrom)}${i.dateTo&&i.dateTo!==i.dateFrom?' – '+fmtDate(i.dateTo):''}`;$('#inspectionStats').innerHTML=statsHtml();const root=$('#recordsList');root.innerHTML='';if(!state.records.length){root.innerHTML='<p class="muted">No records yet. Add the first condition photo or finding.</p>';return;}[...state.records].reverse().forEach(r=>{const n=$('#recordTemplate').content.cloneNode(true);n.querySelector('.record-no').textContent=`#${String(r.no).padStart(3,'0')} · ${r.area}`;const badge=n.querySelector('.record-badge');badge.textContent=r.type==='condition'?(r.condition||'Condition'):(r.priority||'Finding');badge.className=`badge record-badge ${r.type==='condition'?'condition':(r.priority==='Urgent'?'urgent':'finding')}`;n.querySelector('.record-location').textContent=r.location||'No location';n.querySelector('.record-description').textContent=r.description||'';n.querySelector('.record-meta').innerHTML=`<span>${r.type==='condition'?'CONDITION / PHOTO':'FINDING'}</span><span>📷 ${r.photos?.length||0}</span>`;n.querySelector('.thumbs').innerHTML=(r.photos||[]).slice(0,4).map(u=>`<img src="${u}">`).join('');root.appendChild(n);});}
function renderWorkPlan(){const q=$('#workSearch').value.trim().toLowerCase();const f=$('#workFilter').value;const now=today();let list=state.workplan.filter(w=>!q||`${w.description} ${w.responsible} ${w.remarks}`.toLowerCase().includes(q));if(f==='incomplete')list=list.filter(w=>Number(w.progress)<100);if(f==='complete')list=list.filter(w=>Number(w.progress)===100);if(f==='overdue')list=list.filter(w=>w.dueDate&&w.dueDate<now&&Number(w.progress)<100);const root=$('#workPlanList');root.innerHTML='';if(!list.length){root.innerHTML='<article class="card"><p class="muted">No matching work items.</p></article>';return;}list.forEach(w=>{const n=$('#workTemplate').content.cloneNode(true);const card=n.querySelector('.work-card');if(w.dueDate&&w.dueDate<now&&Number(w.progress)<100)card.classList.add('overdue');n.querySelector('.work-no').textContent=`WORK No. ${w.no}`;n.querySelector('.work-description').textContent=w.description||'Untitled work';n.querySelector('.progress-big').textContent=`${Number(w.progress)||0}%`;n.querySelector('.work-meta').innerHTML=`<span>Responsible: ${esc(w.responsible||'—')}</span><span>Due: ${fmtDate(w.dueDate)}</span>${w.sourceRecordNo?`<span>Finding #${String(w.sourceRecordNo).padStart(3,'0')}</span>`:''}`;n.querySelector('.work-remarks').textContent=w.remarks||'';n.querySelector('.edit-work').addEventListener('click',()=>openWorkDialog(w));root.appendChild(n);});}

$('#exportExcelBtn').addEventListener('click',exportExcelXml);
function exportExcelXml(){
 const i=state.inspection||{}; const rows=state.workplan.map(w=>`<Row><Cell><Data ss:Type="Number">${w.no}</Data></Cell><Cell><Data ss:Type="String">${xml(w.description)}</Data></Cell><Cell><Data ss:Type="String">${xml(w.responsible)}</Data></Cell><Cell><Data ss:Type="String">${xml(w.dueDate)}</Data></Cell><Cell><Data ss:Type="Number">${Number(w.progress)||0}</Data></Cell><Cell><Data ss:Type="String">${xml(w.remarks)}</Data></Cell></Row>`).join('');
 const data=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Work Plan"><Table><Row><Cell ss:MergeAcross="5"><Data ss:Type="String">VESSEL WORK PLAN — ${xml(i.vessel||'')}</Data></Cell></Row><Row><Cell><Data ss:Type="String">No.</Data></Cell><Cell><Data ss:Type="String">Description of Work</Data></Cell><Cell><Data ss:Type="String">Responsible</Data></Cell><Cell><Data ss:Type="String">Due Date</Data></Cell><Cell><Data ss:Type="String">Progress %</Data></Cell><Cell><Data ss:Type="String">Remarks</Data></Cell></Row>${rows}</Table></Worksheet></Workbook>`;
 const blob=new Blob([data],{type:'application/vnd.ms-excel'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${(i.vessel||'Vessel').replace(/[^a-z0-9]+/gi,'_')}_Work_Plan.xls`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function xml(s=''){return String(s).replace(/[<>&'\"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','\"':'&quot;',"'":'&apos;'}[c]))}

function downloadText(filename,text,type='application/json'){
 const blob=new Blob([text],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
$('#exportProjectBtn').addEventListener('click',()=>{
 const i=state.inspection||{}; const payload={format:'ship-inspector-project',version:'0.3',exportedAt:new Date().toISOString(),state};
 downloadText(`${(i.vessel||'Vessel').replace(/[^a-z0-9]+/gi,'_')}_Inspection_Project.json`,JSON.stringify(payload,null,2));
});
$('#importProjectInput').addEventListener('change',async e=>{
 const f=e.target.files?.[0]; if(!f)return;
 try{const parsed=JSON.parse(await f.text()); const imported=parsed.state||parsed; if(!imported.inspection)throw new Error('No inspection in file'); state={...defaultState(),...imported}; saveState(); switchView('review'); alert('Inspection project imported.');}
 catch(err){alert('Could not import project: '+err.message)} finally{e.target.value='';}
});

function renderReview(){
 const root=$('#reviewSummary'); if(!root)return; const i=state.inspection;
 if(!i){root.innerHTML='<p class="muted">No project loaded.</p>'; return;}
 const findings=state.records.filter(r=>r.type==='finding').length;
 root.innerHTML=`<h3>${esc(i.vessel)}</h3><p>IMO ${esc(i.imo||'—')} · ${fmtDate(i.dateFrom)}</p><div class="stats"><span class="stat">Records ${state.records.length}</span><span class="stat">Findings ${findings}</span><span class="stat">Work ${state.workplan.length}</span></div>`;
}

$$('[data-voice-target]').forEach(btn=>btn.addEventListener('click',()=>startVoice(btn.dataset.voiceTarget,btn)));
function startVoice(targetId,btn){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!SR){alert('Voice dictation is not supported by this browser. Use the phone keyboard microphone instead.');return;}
 const rec=new SR(); rec.lang='en-US'; rec.interimResults=false; rec.maxAlternatives=1; btn.textContent='●';
 rec.onresult=e=>{const el=$('#'+targetId); const text=e.results[0][0].transcript; el.value=(el.value?el.value+' ':'')+text;};
 rec.onerror=()=>{}; rec.onend=()=>btn.textContent='🎤'; rec.start();
}

window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});$('#installBtn').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
renderAll();
