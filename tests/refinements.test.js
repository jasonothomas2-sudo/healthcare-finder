const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const leave=fs.readFileSync(path.join(__dirname,'../leave/index.html'),'utf8');
const watch=fs.readFileSync(path.join(__dirname,'../watch/index.html'),'utf8');
const ctx={URLSearchParams}; vm.createContext(ctx);
vm.runInContext(leave.slice(leave.indexOf('function validateLeaveDays('),leave.indexOf('function renderReturn(){')),ctx);
for(const raw of ['1','2','365']) test('accepts whole days '+raw,()=>assert.equal(ctx.validateLeaveDays(raw,false).value,Number(raw)));
for(const raw of ['1.5','0','-2','366','NaN','Infinity']) test('rejects invalid return days '+raw,()=>assert.ok(ctx.validateLeaveDays(raw,false).error));
test('blank is incomplete; bad native numeric input is invalid',()=>{
 assert.equal(ctx.validateLeaveDays('',false).error,''); assert.ok(ctx.validateLeaveDays('',true).error);
 assert.equal(ctx.validateLeaveDays('1.5',false).error,'Enter a whole number of days, such as 1 or 2.');
});
for(const [url,saved,expected] of [['?start=2026-11-09','balance','return'],['?mode=balance&start=2026-11-09','return','balance'],['?mode=return','balance','return'],['?mode=bad&start=2026-11-09','balance','return'],['','balance','balance'],['','garbage','return']]){
 test('opening mode '+url+' saved '+saved,()=>assert.equal(ctx.openingMode(url,saved),expected));
}
test('invalid restored days replace an existing result and remove actions',()=>{
 const num={value:'1.5',validity:{badInput:false},setAttribute(k,v){this[k]=v;},setCustomValidity(v){this.error=v;}};
 const error={}; const output={innerHTML:'<button>Copy result</button>'};
 const c={numEl:num,startEl:{value:'2026-11-05'},syncDateFields(){},nudgeBox:{},resBox:output,
  document:{getElementById(){return error;}},parseDate(v){return new Date(v+'T00:00:00');},idleCard(msg){return msg;}};
 vm.createContext(c);
 vm.runInContext(leave.slice(leave.indexOf('function validateLeaveDays('),leave.indexOf("resBox.addEventListener('click'")),c);
 c.renderReturn(); assert.equal(num['aria-invalid'],'true'); assert.equal(output.innerHTML,num.error); assert.doesNotMatch(output.innerHTML,/button/);
});
test('selected-date summary renders the chosen watch for every rota slot and boundary date',()=>{
 const elements={selectedSummary:{},viewRoster:{addEventListener(){}}};
 const c={S:require('../shift.js'),SLOT_HOURS:require('../shift.js').SLOT_HOURS,document:{getElementById:id=>elements[id]},fmtDate:d=>d.toDateString(),revealRoster(){}};
 vm.createContext(c); vm.runInContext(watch.slice(watch.indexOf('function renderSelectedSummary(){'),watch.indexOf('function revealRoster(){')),c);
 for(const w of ['A','B','C','D']) for(const d of [new Date(2026,10,5),new Date(2026,11,31),new Date(2027,0,1)]){
  c.selectedWatch=w;c.selectedDate=d;c.renderSelectedSummary();
  const slot=c.S.watchSlotForDate(w,d);assert.ok(elements.selectedSummary.innerHTML.includes('Watch '+w+' · '+slot));assert.ok(elements.selectedSummary.innerHTML.includes(c.SLOT_HOURS[slot]));
 }
});
test('balance bar reflects status and hides in Return mode or while full result is visible',()=>{
 const bar={}, preview={}, body={classList:{toggle(k,v){this[k]=v;}}};
 const c={balancePreviewText:'Complete your details',balanceResultVisible:false,modeBalance:{hidden:false},document:{body,getElementById:id=>id==='balanceBar'?bar:preview}};
 vm.createContext(c);vm.runInContext(leave.slice(leave.indexOf('function updateBalanceBar(){'),leave.indexOf("document.getElementById('viewBalance').addEventListener")),c);
 for(const status of ['Complete your details','Check your details','28 days','-12 days','84 days']){
  c.balancePreviewText=status;c.updateBalanceBar();assert.equal(preview.textContent,status);assert.equal(bar.hidden,false);
 }
 c.balanceResultVisible=true;c.updateBalanceBar();assert.equal(bar.hidden,true);
 c.balanceResultVisible=false;c.modeBalance.hidden=true;c.updateBalanceBar();assert.equal(bar.hidden,true);
});
test('full rendering refreshes the selected-date summary with other views',()=>{
 const calls=[],c={};
 for(const name of ['renderSelectedSummary','renderWatchPicker','renderNow','renderForecast','renderRange','renderWeekStrip','renderDayDetail','syncDateField','renderCal'])c[name]=()=>calls.push(name);
 vm.createContext(c);vm.runInContext(watch.match(/function renderAll\(\)\{[^\n]+/)[0],c);c.renderAll();
 assert.ok(calls.includes('renderSelectedSummary'));assert.ok(calls.includes('renderDayDetail'));
});
