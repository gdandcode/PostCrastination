export const MODULE_BOARD={columns:12,rows:6,minWidth:3,minHeight:3};
export function clampModule(module){const w=Math.min(12,Math.max(3,Math.round(Number(module.w)||3))),h=Math.min(6,Math.max(3,Math.round(Number(module.h)||3)));return {...module,w,h,x:Math.min(13-w,Math.max(1,Math.round(Number(module.x)||1))),y:Math.min(7-h,Math.max(1,Math.round(Number(module.y)||1)))};}
export function modulesOverlap(a,b){const first=clampModule(a),second=clampModule(b);return !(first.x+first.w<=second.x||second.x+second.w<=first.x||first.y+first.h<=second.y||second.y+second.h<=first.y);}
export function moduleCollides(candidate,modules){return modules.some(m=>m.id!==candidate.id&&modulesOverlap(candidate,m));}
export function planModulePlacement(id,modules,catalog){
 const widget=catalog.find(w=>w.id===id);if(!widget)return {ok:false,reason:'This module is not available.'};
 if(modules.some(m=>m.id===id))return {ok:false,reason:`${widget.name} is already on your board. You cannot add it twice.`};
 const base=clampModule({id,...widget.defaultLayout}),minW=Math.min(base.w,Math.max(3,widget.minWidth||3)),minH=Math.min(base.h,Math.max(3,widget.minHeight||3));
 const sizes=[];for(let h=base.h;h>=minH;h--)for(let w=base.w;w>=minW;w--)sizes.push({w,h});sizes.sort((a,b)=>b.w*b.h-a.w*a.h||b.w-a.w);
 for(const size of sizes){const positions=[{x:Math.min(base.x,13-size.w),y:Math.min(base.y,7-size.h)}];for(let y=1;y<=7-size.h;y++)for(let x=1;x<=13-size.w;x++)positions.push({x,y});
 for(const position of positions){const module={id,...size,...position};if(!moduleCollides(module,modules)){const reduced=size.w!==base.w||size.h!==base.h;return {ok:true,module,reduced,message:reduced?`${widget.name} added at ${size.w} × ${size.h} to fit the space (preset: ${base.w} × ${base.h}).`:`${widget.name} added at its preset size (${base.w} × ${base.h}).`};}}
 }
 return {ok:false,reason:`Not enough usable space for ${widget.name}. It needs at least ${minW} × ${minH}. Move, resize or remove another module first.`};
}
