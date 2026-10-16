export function makeGroups(students,size,random=Math.random){
 if(!Number.isInteger(size)||size<1||size>students.length)throw new Error('Choose a group size between 1 and the number of students.');
 const shuffled=[...students];for(let i=shuffled.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
 const groups=[];for(let i=0;i<shuffled.length;i+=size)groups.push(shuffled.slice(i,i+size));return groups;
}
export function pickStudent(students,random=Math.random){if(!students.length)throw new Error('No students to choose from.');return students[Math.floor(random()*students.length)];}
export function groupColour(index){return `hsl(${Math.round(index*137.508)%360} 65% 55%)`;}
