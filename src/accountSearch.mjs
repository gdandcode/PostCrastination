export function normalizeName(value){return String(value||'').toLowerCase().replace(/ł/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
export function nameDistance(a,b){
 const rows=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
 for(let i=0;i<=a.length;i++)rows[i][0]=i;for(let j=0;j<=b.length;j++)rows[0][j]=j;
 for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){
  rows[i][j]=Math.min(rows[i-1][j]+1,rows[i][j-1]+1,rows[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])rows[i][j]=Math.min(rows[i][j],rows[i-2][j-2]+1);
 }return rows[a.length][b.length];
}
export function matchesAccount(account,query){
 const terms=normalizeName(query).split(' ').filter(Boolean);if(!terms.length)return true;
 const words=normalizeName(`${account.fullName||''} ${account.username||''}`).split(' ').filter(Boolean);
 return terms.every(term=>words.some(word=>word.includes(term)||(term.length>=3&&nameDistance(term,word)<=(term.length>=6?2:1))));
}
export function filterAccounts(people,{query='',roles=[],years=[],classes=[],teachers=[]}={}){
 return people.filter(person=>matchesAccount(person,query)&&(!roles.length||roles.includes(person.role))&&(!years.length||years.includes(person.yearGroup||'unassigned'))&&(!classes.length&&!teachers.length||person.classes.some(c=>(!classes.length||classes.includes(c.id))&&(!teachers.length||teachers.includes(c.teacherId)))));
}
