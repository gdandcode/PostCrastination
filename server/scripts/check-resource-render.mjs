import assert from 'node:assert/strict';
import {transformWithOxc} from 'vite';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import React from 'react';import {renderToString} from 'react-dom/server';
const original=(await readFile(new URL('../../src/Resources.jsx',import.meta.url),'utf8')).replace("import {communityRequest} from './communityApi';",'const communityRequest=async()=>({classes:[]});').replace("import {encodeFiles} from './SchoolShared';",'const encodeFiles=async()=>[];');
const root={classes:[{id:'class',name:'Maths',subject:'Maths'}]},folder={classInfo:{id:'class',name:'Maths',editable:true},path:[],entries:[{id:'entry',name:'Revision',kind:'folder'}]};
for(const [name,data,cls] of [['root',root,null],['class',folder,'class'],['opening class with previous root data',root,'class'],['returning to root with previous folder data',folder,null],['loading',null,'class']]){
 const source=original.replace('[data,setData]=useState(null)',`[data,setData]=useState(${JSON.stringify(data)})`).replace('[loading,setLoading]=useState(true)',`[loading,setLoading]=useState(${data===null})`).replace('[classId,setClassId]=useState(null)',`[classId,setClassId]=useState(${JSON.stringify(cls)})`);
 const file=new URL('../../.resource-render-fixture.mjs',import.meta.url);await writeFile(file,(await transformWithOxc(source,'Resources.jsx',{jsx:{runtime:'classic'}})).code);
 try{const {default:Page}=await import(file.href+'?case='+encodeURIComponent(name));const html=renderToString(React.createElement(Page,{user:{}}));assert.match(html,/Resources/);assert.match(html,/All classes/);console.log('PASS: '+name);}finally{await unlink(file);}
}
