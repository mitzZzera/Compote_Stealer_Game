import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
const root=resolve('.'),out=resolve(root,'dist');
if(!out.startsWith(root+sep)||out===root)throw new Error('Invalid build output path');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const file of ['index.html','style.css','favicon.svg','src'])await cp(resolve(root,file),resolve(out,file),{recursive:true});
console.log('Built Compote Stealer → dist/ (static, no runtime dependencies)');
